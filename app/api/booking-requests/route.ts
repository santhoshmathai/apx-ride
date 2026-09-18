import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser, isApprovedEmail } from '../../chatgpt-auth';

type PortalUser = { userId: string; email: string };
type RequestRow = Record<string, unknown> & { id: number; status: string; reference: string; passenger_name: string; email: string; phone: string; pickup: string; dropoff: string; pickup_at: string; passengers: number; large_bags: number; small_bags: number; fleet_tier: string; quoted_fare: number; notes: string; assigned_booking_id?: number | null };

async function authorised(): Promise<PortalUser | null> {
  const user = await getChatGPTUser();
  return user && isApprovedEmail(user.email) ? user : null;
}

function organisationId(userId: string) { return `org_${userId}`; }
function organisationSlug(userId: string) { return `apx-${userId.replace(/[^a-z0-9]/gi, '').slice(-12).toLowerCase()}`; }

async function ensureOrganisation(user: PortalUser) {
  const id = organisationId(user.userId);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO organisations(id,name,slug,owner_user_id,owner_email,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id, 'APX RIDE', organisationSlug(user.userId), user.userId, user.email, now, now),
    env.DB.prepare('INSERT OR IGNORE INTO organisation_members(organisation_id,user_id,email,role,created_at) VALUES(?,?,?,?,?)').bind(id, user.userId, user.email, 'OWNER', now),
    env.DB.prepare('INSERT OR IGNORE INTO public_booking_settings(organisation_id,public_key,public_bookings_enabled,acknowledgement_template,confirmation_template,unavailable_template,cancellation_template,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, crypto.randomUUID(), 0, 'Thank you {passenger}. We received request {reference} and will confirm availability shortly.', 'Your APX RIDE booking {reference} is confirmed for {pickupAt}, from {pickup} to {dropoff}. Confirmed fare: £{fare}.', 'We are sorry, but a driver is not available for request {reference}. {reason}', 'Your APX RIDE booking request {reference} has been cancelled. {reason}', now),
  ]);
  return id;
}

function requiredText(value: unknown, max = 300) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; }
function render(template: string, row: RequestRow, fare: number, reason: string) {
  return template.replaceAll('{passenger}', row.passenger_name).replaceAll('{reference}', row.reference).replaceAll('{pickup}', row.pickup).replaceAll('{dropoff}', row.dropoff).replaceAll('{pickupAt}', new Date(row.pickup_at).toLocaleString('en-GB')).replaceAll('{fare}', fare.toFixed(2)).replaceAll('{reason}', reason || 'Please contact APX RIDE if you need assistance.');
}

export async function GET() {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const orgId = await ensureOrganisation(user);
  const [requests, organisation, settings, prepared, notifications] = await Promise.all([
    env.DB.prepare('SELECT * FROM booking_requests WHERE organisation_id=? ORDER BY created_at DESC').bind(orgId).all(),
    env.DB.prepare('SELECT id,name,slug,owner_email FROM organisations WHERE id=?').bind(orgId).first(),
    env.DB.prepare('SELECT public_bookings_enabled,acknowledgement_template,confirmation_template,unavailable_template,cancellation_template FROM public_booking_settings WHERE organisation_id=?').bind(orgId).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM notification_outbox WHERE organisation_id=? AND status='PREPARED'").bind(orgId).first<{ count: number }>(),
    env.DB.prepare('SELECT id,request_id,booking_id,channel,recipient,template_key,subject,status,attempts,last_error,created_at,sent_at FROM notification_outbox WHERE organisation_id=? ORDER BY created_at DESC LIMIT 50').bind(orgId).all(),
  ]);
  return NextResponse.json({ requests: requests.results, organisation, publicBookingsEnabled: Boolean(settings?.public_bookings_enabled), preparedNotifications: prepared?.count || 0, notificationTemplates: settings, notifications: notifications.results });
}

export async function PUT(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const orgId = await ensureOrganisation(user);
  const body = await req.json() as Record<string, unknown>;
  const acknowledgement = requiredText(body.acknowledgementTemplate, 2000), confirmation = requiredText(body.confirmationTemplate, 2000), unavailable = requiredText(body.unavailableTemplate, 2000), cancellation = requiredText(body.cancellationTemplate, 2000);
  if (!acknowledgement || !confirmation || !unavailable || !cancellation) return NextResponse.json({ error: 'All four notification templates are required.' }, { status: 400 });
  await env.DB.prepare('UPDATE public_booking_settings SET acknowledgement_template=?,confirmation_template=?,unavailable_template=?,cancellation_template=?,updated_at=? WHERE organisation_id=?').bind(acknowledgement, confirmation, unavailable, cancellation, new Date().toISOString(), orgId).run();
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const orgId = await ensureOrganisation(user);
  const body = await req.json() as Record<string, unknown>;
  const passengerName = requiredText(body.passengerName, 120), email = requiredText(body.email, 200), phone = requiredText(body.phone, 40), pickup = requiredText(body.pickup), dropoff = requiredText(body.dropoff), pickupAt = requiredText(body.pickupAt, 40);
  if (!passengerName || !email || !phone || !pickup || !dropoff || !pickupAt || !email.includes('@')) return NextResponse.json({ error: 'Passenger, email, phone, journey and pickup time are required.' }, { status: 400 });
  const now = new Date().toISOString();
  const reference = `APX-RQ-${now.slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const result = await env.DB.prepare('INSERT INTO booking_requests(organisation_id,owner_id,reference,passenger_name,email,phone,pickup,dropoff,pickup_at,passengers,large_bags,small_bags,fleet_tier,quoted_fare,notes,source,status,decision_reason,created_at,updated_at,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(orgId, user.userId, reference, passengerName, email, phone, pickup, dropoff, pickupAt, numberValue(body.passengers, 1) || 1, numberValue(body.largeBags), numberValue(body.smallBags), requiredText(body.fleetTier, 60) || 'Saloon', numberValue(body.quotedFare), requiredText(body.notes, 1000), 'PORTAL', 'RECEIVED', '', now, now, '').run();
  const requestId = Number(result.meta.last_row_id);
  const settings = await env.DB.prepare('SELECT acknowledgement_template FROM public_booking_settings WHERE organisation_id=?').bind(orgId).first<{ acknowledgement_template: string }>();
  const createdRequest = { id: requestId, status: 'RECEIVED', reference, passenger_name: passengerName, email, phone, pickup, dropoff, pickup_at: pickupAt, passengers: numberValue(body.passengers, 1) || 1, large_bags: numberValue(body.largeBags), small_bags: numberValue(body.smallBags), fleet_tier: requiredText(body.fleetTier, 60) || 'Saloon', quoted_fare: numberValue(body.quotedFare), notes: requiredText(body.notes, 1000) } as RequestRow;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO booking_request_events(organisation_id,request_id,actor_email,event_type,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(orgId, requestId, user.email, 'REQUEST_CREATED', '', 'RECEIVED', 'Request recorded in portal', now),
    env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(orgId, requestId, 'EMAIL', email, 'REQUEST_RECEIVED', `APX RIDE request received — ${reference}`, render(settings?.acknowledgement_template || 'Thank you {passenger}. We received request {reference} and will confirm availability shortly.', createdRequest, Number(createdRequest.quoted_fare), ''), 'PREPARED', 0, '', now, ''),
  ]);
  return NextResponse.json({ id: requestId, reference }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const orgId = await ensureOrganisation(user);
  const body = await req.json() as Record<string, unknown>;
  const id = Number(body.id), action = requiredText(body.action, 40).toUpperCase();
  const row = await env.DB.prepare('SELECT * FROM booking_requests WHERE id=? AND organisation_id=?').bind(id, orgId).first<RequestRow>();
  if (!row) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  const transitions: Record<string, string> = { REVIEW: 'UNDER_REVIEW', MORE_INFO: 'MORE_INFORMATION_REQUIRED', UNAVAILABLE: 'DRIVER_UNAVAILABLE', DECLINE: 'DECLINED', CANCEL: 'CUSTOMER_CANCELLED' };
  const now = new Date().toISOString();
  const reason = requiredText(body.reason, 500);

  if (action === 'ACCEPT') {
    if (row.status === 'ACCEPTED' || row.assigned_booking_id) return NextResponse.json({ error: 'This request has already been accepted.' }, { status: 409 });
    const fare = numberValue(body.fare, Number(row.quoted_fare) || 0);
    const booking = await env.DB.prepare('INSERT INTO bookings(owner_id,passenger_name,customer_email,phone,pickup,dropoff,pickup_at,operator,driver_call_sign,driver_name,driver_licence,booking_type,passengers,large_bags,small_bags,fleet_tier,distance,fare,base_fare,airport_fee,toll_fee,tariff,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(user.userId, row.passenger_name, row.email, row.phone, row.pickup, row.dropoff, row.pickup_at, requiredText(body.operator, 80) || 'APX RIDE', '', '', '', requiredText(body.bookingType, 20) || 'CASH', row.passengers || 1, row.large_bags || 0, row.small_bags || 0, requiredText(body.fleetTier, 60) || row.fleet_tier || 'Saloon', 0, fare, 0, 0, 0, 'day', 'upcoming', [row.notes, `Created from ${row.reference}`].filter(Boolean).join(' · '), now, now).run();
    const bookingId = Number(booking.meta.last_row_id);
    const settings = await env.DB.prepare('SELECT confirmation_template FROM public_booking_settings WHERE organisation_id=?').bind(orgId).first<{ confirmation_template: string }>();
    await env.DB.batch([
      env.DB.prepare("UPDATE booking_requests SET status='ACCEPTED',quoted_fare=?,fleet_tier=?,assigned_booking_id=?,decision_reason=?,updated_at=?,decided_at=? WHERE id=? AND organisation_id=?").bind(fare, requiredText(body.fleetTier, 60) || row.fleet_tier, bookingId, reason, now, now, id, orgId),
      env.DB.prepare('INSERT INTO booking_request_events(organisation_id,request_id,actor_email,event_type,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(orgId, id, user.email, 'REQUEST_ACCEPTED', row.status, 'ACCEPTED', reason, now),
      env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,booking_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(orgId, id, bookingId, 'EMAIL', row.email, 'BOOKING_CONFIRMED', `APX RIDE booking confirmed — ${row.reference}`, render(settings?.confirmation_template || 'Your APX RIDE booking {reference} is confirmed for {pickupAt}, from {pickup} to {dropoff}. Confirmed fare: £{fare}.', row, fare, reason), 'PREPARED', 0, '', now, ''),
    ]);
    return NextResponse.json({ ok: true, bookingId, status: 'ACCEPTED' });
  }

  const next = transitions[action];
  if (!next) return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  if ((action === 'UNAVAILABLE' || action === 'DECLINE' || action === 'CANCEL' || action === 'MORE_INFO') && !reason) return NextResponse.json({ error: 'Please provide a customer-facing reason or message.' }, { status: 400 });
  if (action === 'CANCEL' && row.assigned_booking_id) await env.DB.prepare("UPDATE bookings SET status='archived',updated_at=? WHERE id=? AND owner_id=?").bind(now, row.assigned_booking_id, user.userId).run();
  const templateKey = action === 'UNAVAILABLE' ? 'DRIVER_UNAVAILABLE' : action === 'DECLINE' ? 'REQUEST_DECLINED' : action === 'CANCEL' ? 'BOOKING_CANCELLED' : action === 'MORE_INFO' ? 'MORE_INFORMATION_REQUIRED' : '';
  await env.DB.batch([
    env.DB.prepare('UPDATE booking_requests SET status=?,decision_reason=?,updated_at=?,decided_at=? WHERE id=? AND organisation_id=?').bind(next, reason, now, ['UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'].includes(next) ? '' : now, id, orgId),
    env.DB.prepare('INSERT INTO booking_request_events(organisation_id,request_id,actor_email,event_type,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(orgId, id, user.email, `REQUEST_${action}`, row.status, next, reason, now),
  ]);
  if (templateKey) {
    const settings = await env.DB.prepare('SELECT unavailable_template,cancellation_template FROM public_booking_settings WHERE organisation_id=?').bind(orgId).first<{ unavailable_template: string; cancellation_template: string }>();
    const chosen = action === 'UNAVAILABLE' ? settings?.unavailable_template : action === 'CANCEL' ? settings?.cancellation_template : '{passenger}, {reason}';
    await env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,booking_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(orgId, id, row.assigned_booking_id || null, 'EMAIL', row.email, templateKey, `APX RIDE booking update — ${row.reference}`, render(chosen || '{passenger}, {reason}', row, Number(row.quoted_fare) || 0, reason), 'PREPARED', 0, '', now, '').run();
  }
  return NextResponse.json({ ok: true, status: next });
}
