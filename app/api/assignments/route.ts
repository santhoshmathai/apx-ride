import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { addAssignmentEvent, scheduleConflicts, transitionAssignment, type AssignmentRow } from '../../assignment-workflow';
import { driverEligibilitySelect, eligibilityReasons, type DriverEligibilityRow } from '../../driver-eligibility';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

async function admin() { if (!cloudflareAuthEnabled()) return null; const user = await getPortalPrincipal(); return user?.role === 'OWNER_ADMIN' ? user : null; }

export async function GET(req: Request) {
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const bookingId = Number(new URL(req.url).searchParams.get('bookingId'));
  const drivers = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.organisation_id=? AND s.owner_id=? AND p.id IS NOT NULL ORDER BY s.email`).bind(user.organisationId, user.ownerId).all<Record<string, unknown> & DriverEligibilityRow>();
  const history = Number.isSafeInteger(bookingId) && bookingId > 0 ? await env.DB.prepare(`SELECT a.*,s.email,s.role,p.full_name,v.registration FROM booking_assignments a JOIN portal_staff s ON s.id=a.driver_staff_id LEFT JOIN driver_profiles p ON p.staff_id=s.id LEFT JOIN driver_vehicles v ON v.driver_profile_id=p.id WHERE a.owner_id=? AND a.booking_id=? ORDER BY a.created_at DESC`).bind(user.ownerId, bookingId).all() : { results: [] };
  const events = Number.isSafeInteger(bookingId) && bookingId > 0 ? await env.DB.prepare('SELECT * FROM assignment_events WHERE owner_id=? AND booking_id=? ORDER BY created_at DESC,id DESC').bind(user.ownerId, bookingId).all() : { results: [] };
  const booking = Number.isSafeInteger(bookingId) && bookingId > 0 ? await env.DB.prepare('SELECT id,pickup_at,fare FROM bookings WHERE id=? AND owner_id=?').bind(bookingId, user.ownerId).first<{ id: number; pickup_at: string; fare: number }>() : null;
  const mapped = await Promise.all(drivers.results.map(async (driver) => ({ ...driver, eligible: eligibilityReasons(driver).length === 0, eligibility_reasons: eligibilityReasons(driver), conflicts: booking ? await scheduleConflicts(user.ownerId, String(driver.id), booking.id, booking.pickup_at) : [] })));
  return NextResponse.json({ drivers: mapped, history: history.results, events: events.results, booking });
}

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { action?: unknown; bookingId?: unknown; driverId?: unknown; assignmentId?: unknown; agreedPayment?: unknown; paymentStatus?: unknown; paymentDate?: unknown; paymentNotes?: unknown; note?: unknown };
  const action = String(body.action || 'OFFER'); const bookingId = Number(body.bookingId); const now = new Date().toISOString();
  if (action === 'OFFER') {
    const driverId = typeof body.driverId === 'string' ? body.driverId : ''; const payment = Number(body.agreedPayment);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0 || !driverId || !Number.isFinite(payment) || payment < 0) return NextResponse.json({ error: 'Booking, Driver and agreed payment are required' }, { status: 400 });
    const booking = await env.DB.prepare('SELECT id,pickup_at FROM bookings WHERE id=? AND owner_id=?').bind(bookingId, user.ownerId).first<{ id: number; pickup_at: string }>();
    const driver = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=? AND s.owner_id=?`).bind(driverId, user.organisationId, user.ownerId).first<Record<string, unknown> & DriverEligibilityRow>();
    if (!booking || !driver) return NextResponse.json({ error: 'Booking or Driver not found' }, { status: 404 });
    const reasons = eligibilityReasons(driver); if (reasons.length) return NextResponse.json({ error: `Driver is not eligible: ${reasons.join('; ')}`, reasons }, { status: 409 });
    const conflicts = await scheduleConflicts(user.ownerId, driverId, bookingId, booking.pickup_at); if (conflicts.length) return NextResponse.json({ error: 'Schedule conflict prevents this offer', conflicts }, { status: 409 });
    const current = await env.DB.prepare('SELECT * FROM booking_assignments WHERE owner_id=? AND booking_id=? AND active=1').bind(user.ownerId, bookingId).first<AssignmentRow>();
    if (current) await transitionAssignment(current, user.email, 'REASSIGNMENT_REQUIRED', 'Replaced by a new Driver offer');
    const result = await env.DB.prepare("INSERT INTO booking_assignments(owner_id,organisation_id,booking_id,driver_staff_id,status,active,driver_agreed_payment,payment_status,offered_at,created_at,updated_at) VALUES(?,?,?,?, 'OFFERED',1,?,'PENDING',?,?,?)").bind(user.ownerId, user.organisationId, bookingId, driverId, payment, now, now, now).run();
    const row = await env.DB.prepare('SELECT * FROM booking_assignments WHERE id=?').bind(Number(result.meta.last_row_id)).first<AssignmentRow>();
    if (row) await env.DB.prepare('INSERT INTO assignment_events(owner_id,assignment_id,booking_id,driver_staff_id,actor_email,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.ownerId, row.id, bookingId, driverId, user.email, '', 'OFFERED', String(body.note || '').slice(0, 1000), now).run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  }
  const assignmentId = Number(body.assignmentId); const row = await env.DB.prepare('SELECT * FROM booking_assignments WHERE id=? AND owner_id=?').bind(assignmentId, user.ownerId).first<AssignmentRow>();
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (action === 'CONFIRM' && row.status === 'ACKNOWLEDGED') await transitionAssignment(row, user.email, 'ASSIGNED', String(body.note || ''));
  else if (action === 'CANCEL' && row.active) await transitionAssignment(row, user.email, 'ASSIGNMENT_CANCELLED', String(body.note || ''));
  else if (action === 'REASSIGN' && row.active) await transitionAssignment(row, user.email, 'REASSIGNMENT_REQUIRED', String(body.note || 'Reassignment requested by Admin'));
  else if (action === 'CUSTOMER_CANCEL' && row.active) await transitionAssignment(row, user.email, 'CUSTOMER_CANCELLED', String(body.note || ''));
  else if (action === 'ADMIN_NEXT' && row.active) {
    const next: Record<string,string> = { ASSIGNED: 'EN_ROUTE', EN_ROUTE: 'ARRIVED', ARRIVED: 'PASSENGER_ONBOARD', PASSENGER_ONBOARD: 'COMPLETED' };
    if (!next[row.status]) return NextResponse.json({ error: 'No next operational status is available' }, { status: 409 });
    await transitionAssignment(row, user.email, next[row.status], String(body.note || 'Updated by Owner/Admin'));
  }
  else if (action === 'PAYMENT') {
    const payment = Number(body.agreedPayment); const status = String(body.paymentStatus || '').toUpperCase();
    if (!Number.isFinite(payment) || payment < 0 || !['PENDING','APPROVED','PAID'].includes(status)) return NextResponse.json({ error: 'Valid Driver payment and status required' }, { status: 400 });
    await env.DB.prepare('UPDATE booking_assignments SET driver_agreed_payment=?,payment_status=?,payment_date=?,payment_notes=?,updated_at=? WHERE id=? AND owner_id=?').bind(payment, status, status === 'PAID' ? String(body.paymentDate || now.slice(0, 10)) : String(body.paymentDate || ''), String(body.paymentNotes || '').slice(0, 500), now, row.id, user.ownerId).run();
    await addAssignmentEvent(row, user.email, row.status, `Driver payment updated: £${payment.toFixed(2)} · ${status}${body.paymentNotes ? ` · ${String(body.paymentNotes).slice(0, 300)}` : ''}`);
  } else return NextResponse.json({ error: 'Invalid assignment transition' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
