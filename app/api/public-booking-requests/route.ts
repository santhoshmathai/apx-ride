import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { sendOutbox } from '../../email-service';

const OPERATOR_EMAIL = 'apxride.bookings@gmail.com';
const ALLOWED_ORIGINS = new Set([
  'https://apxride.com',
  'https://www.apxride.com',
  'https://apx-ride.hellosanthoshmathai.chatgpt.site',
]);

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

function error(origin: string, message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: cors(origin) });
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function wholeNumber(value: unknown, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : fallback;
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
  const gateway = req.headers.get('x-apx-public-gateway') || '';
  if (!['production', 'staging'].includes(gateway)) return error(origin, 'Public booking gateway required.', 403);
  const production = gateway === 'production';
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error(origin, 'Invalid request format.', 415);
  if (Number(req.headers.get('content-length') || 0) > 12000) return error(origin, 'Request is too large.', 413);
  const raw = await req.text();
  if (raw.length > 12000) return error(origin, 'Request is too large.', 413);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw) as Record<string, unknown>; }
  catch { return error(origin, 'Invalid request format.', 400); }

  const email = text(input.email, 200).toLowerCase();
  if (!production && email !== OPERATOR_EMAIL) return error(origin, 'Online booking requests are in staging test mode.', 503);
  if (text(input.website, 200)) return error(origin, 'Request could not be submitted.', 400);
  if (input.privacy !== true) return error(origin, 'Please accept the privacy notice.', 400);

  const hirerName = text(input.hirerName, 120);
  const passengerName = text(input.passengerName, 120);
  const phone = text(input.phone, 40);
  const pickup = text(input.pickup, 300);
  const dropoff = text(input.dropoff, 300);
  const pickupAtInput = text(input.pickupAt, 40);
  // datetime-local may include seconds on some browsers. Store minutes consistently.
  const pickupAtMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/.exec(pickupAtInput);
  const pickupAt = pickupAtMatch?.[1] || '';
  const flightNumber = text(input.flightNumber, 60);
  const notes = text(input.notes, 800);
  const passengers = wholeNumber(input.passengers, 7, -1);
  const largeBags = wholeNumber(input.largeBags, 4, -1);
  const smallBags = wholeNumber(input.smallBags, 4, -1);
  if (!passengerName) return error(origin, 'Please enter the passenger name.', 400);
  if (!phone) return error(origin, 'Please enter a contact phone number.', 400);
  if (!pickup) return error(origin, 'Please enter the pickup address.', 400);
  if (!dropoff) return error(origin, 'Please enter the destination address.', 400);
  if (!pickupAt || Number.isNaN(Date.parse(pickupAt))) return error(origin, 'Please choose a valid pickup date and time.', 400);
  if (passengers < 1) return error(origin, 'Please enter 1 to 7 passengers.', 400);
  if (largeBags < 0) return error(origin, 'Please enter 0 to 4 large suitcases.', 400);
  if (smallBags < 0) return error(origin, 'Please enter 0 to 4 small bags.', 400);

  const organisation = await env.DB.prepare('SELECT id,owner_user_id FROM organisations WHERE lower(owner_email)=?').bind(OPERATOR_EMAIL).first<{ id: string; owner_user_id: string }>();
  if (!organisation) return error(origin, 'The booking operator is not ready. Sign in to the portal with the bookings account and open Booking Requests first.', 503);
  const settings = await env.DB.prepare('SELECT public_bookings_enabled,acknowledgement_template FROM public_booking_settings WHERE organisation_id=?').bind(organisation.id).first<{ public_bookings_enabled: number; acknowledgement_template: string }>();
  if (!settings) return error(origin, 'The booking operator is not ready.', 503);
  if (production && !settings.public_bookings_enabled) return error(origin, 'Online booking requests are temporarily unavailable.', 503);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (!production) {
    const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM booking_requests WHERE organisation_id=? AND source='PUBLIC_WEBSITE_TEST' AND created_at>=?").bind(organisation.id, since).first<{ count: number }>();
    if ((recent?.count || 0) >= 3) return error(origin, 'Test request limit reached. Please try again later.', 429);
  }

  const now = new Date().toISOString();
  const reference = `${production ? 'APX-RQ' : 'APX-TEST'}-${now.slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const combinedNotes = [flightNumber ? `Flight: ${flightNumber}` : '', notes].filter(Boolean).join(' · ');
  const source = production ? 'PUBLIC_WEBSITE' : 'PUBLIC_WEBSITE_TEST';
  const created = await env.DB.prepare('INSERT INTO booking_requests(organisation_id,owner_id,reference,hirer_name,passenger_name,responded_by,email,phone,pickup,dropoff,pickup_at,passengers,large_bags,small_bags,fleet_tier,quoted_fare,notes,source,status,decision_reason,created_at,updated_at,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(organisation.id, organisation.owner_user_id, reference, hirerName, passengerName, '', email, phone, pickup, dropoff, pickupAt, passengers, largeBags, smallBags, '7-seater', 0, combinedNotes, source, 'RECEIVED', '', now, now, '').run();
  const requestId = Number(created.meta.last_row_id);
  await env.DB.prepare('INSERT INTO booking_request_events(organisation_id,request_id,actor_email,event_type,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(organisation.id, requestId, 'public-website', 'REQUEST_CREATED', '', 'RECEIVED', production ? 'Request received from public website' : 'Test request from public website', now).run();
  const message = (settings.acknowledgement_template || 'Thank you {passenger}. We received request {reference} and will confirm availability shortly.')
    .replaceAll('{passenger}', passengerName).replaceAll('{reference}', reference).replaceAll('{pickup}', pickup).replaceAll('{dropoff}', dropoff).replaceAll('{pickupAt}', pickupAt).replaceAll('{fare}', '0.00');
  const notification = await env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(organisation.id, requestId, 'EMAIL', email, 'REQUEST_RECEIVED', `APX RIDE booking request received — ${reference}`, message, 'PREPARED', 0, '', now, '').run();
  const delivery = await sendOutbox(Number(notification.meta.last_row_id), organisation.id);
  return NextResponse.json({ reference, notificationStatus: delivery.status, testMode: !production }, { status: 201, headers: cors(origin) });
}
