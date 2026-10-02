import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { addAssignmentEvent, scheduleConflicts, transitionAssignment, type AssignmentRow } from '../../assignment-workflow';
import { driverEligibilitySelect, driverOnlyEligibilityReasons, vehicleEligibilityReasons, type AssignmentVehicleRow, type DriverEligibilityRow } from '../../driver-eligibility';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

async function admin() { if (!cloudflareAuthEnabled()) return null; const user = await getPortalPrincipal(); return user?.role === 'OWNER_ADMIN' ? user : null; }

const mappedVehiclesSql = `SELECT v.id,v.registration,v.vehicle_make,v.vehicle_model,v.vehicle_colour,v.vehicle_category,
  v.active AS vehicle_active,v.approved AS vehicle_approved,v.private_hire_vehicle_licence_number,
  v.private_hire_vehicle_licence_expiry,v.mot_expiry,v.insurance_expiry,v.v5_document_status
  FROM driver_profiles p JOIN driver_vehicles v ON v.organisation_id=p.organisation_id
  WHERE p.staff_id=? AND p.organisation_id=? AND p.owner_id=? AND (
    EXISTS (SELECT 1 FROM driver_vehicle_assignments a WHERE a.organisation_id=p.organisation_id AND a.driver_profile_id=p.id AND a.vehicle_id=v.id AND a.active=1 AND a.approved=1 AND (a.valid_from='' OR a.valid_from<=date('now')) AND (a.valid_until='' OR a.valid_until>=date('now')))
    OR (v.driver_profile_id=p.id AND NOT EXISTS (SELECT 1 FROM driver_vehicle_assignments a2 WHERE a2.organisation_id=p.organisation_id AND a2.driver_profile_id=p.id))
  )`;

async function exactDriverVehicle(driverId: string, vehicleId: string, organisationId: string, ownerId: string) {
  const driver = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=? AND s.owner_id=?`).bind(driverId, organisationId, ownerId).first<Record<string, unknown> & DriverEligibilityRow>();
  if (!driver) return null;
  const vehicle = await env.DB.prepare(`${mappedVehiclesSql} AND v.id=?`).bind(driverId, organisationId, ownerId, vehicleId).first<AssignmentVehicleRow>();
  if (!vehicle) return null;
  return { driver, vehicle, reasons: [...driverOnlyEligibilityReasons(driver), ...vehicleEligibilityReasons(vehicle)] };
}

export async function GET(req: Request) {
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const bookingId = Number(new URL(req.url).searchParams.get('bookingId'));
  const drivers = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.organisation_id=? AND s.owner_id=? AND (s.role='DRIVER' OR p.id IS NOT NULL) ORDER BY s.email`).bind(user.organisationId, user.ownerId).all<Record<string, unknown> & DriverEligibilityRow>();
  const history = Number.isSafeInteger(bookingId) && bookingId > 0 ? await env.DB.prepare(`SELECT a.*,s.email,s.role,COALESCE(NULLIF(a.driver_name_snapshot,''),p.full_name) AS full_name,COALESCE(NULLIF(a.vehicle_registration_snapshot,''),v.registration) AS registration FROM booking_assignments a JOIN portal_staff s ON s.id=a.driver_staff_id LEFT JOIN driver_profiles p ON p.staff_id=s.id LEFT JOIN driver_vehicles v ON v.id=a.vehicle_id WHERE a.owner_id=? AND a.booking_id=? ORDER BY a.created_at DESC`).bind(user.ownerId, bookingId).all() : { results: [] };
  const events = Number.isSafeInteger(bookingId) && bookingId > 0 ? await env.DB.prepare('SELECT * FROM assignment_events WHERE owner_id=? AND booking_id=? ORDER BY created_at DESC,id DESC').bind(user.ownerId, bookingId).all() : { results: [] };
  const booking = Number.isSafeInteger(bookingId) && bookingId > 0 ? await env.DB.prepare('SELECT id,pickup_at,fare FROM bookings WHERE id=? AND owner_id=?').bind(bookingId, user.ownerId).first<{ id: number; pickup_at: string; fare: number }>() : null;
  const mapped = await Promise.all(drivers.results.map(async (driver) => {
    const vehicles = await env.DB.prepare(`${mappedVehiclesSql} ORDER BY v.registration`).bind(String(driver.id), user.organisationId, user.ownerId).all<AssignmentVehicleRow>();
    const mappedVehicles = vehicles.results.map((vehicle) => ({ ...vehicle, eligible: [...driverOnlyEligibilityReasons(driver), ...vehicleEligibilityReasons(vehicle)].length === 0, eligibility_reasons: vehicleEligibilityReasons(vehicle) }));
    const driverReasons = driverOnlyEligibilityReasons(driver);
    return { ...driver, eligible: driverReasons.length === 0 && mappedVehicles.some((vehicle) => vehicle.eligible), eligibility_reasons: driverReasons.length ? driverReasons : (mappedVehicles.length ? [] : ['An active approved vehicle is not mapped']), conflicts: booking ? await scheduleConflicts(user.ownerId, String(driver.id), booking.id, booking.pickup_at) : [], vehicles: mappedVehicles, is_current_user: String(driver.id) === user.userId };
  }));
  return NextResponse.json({ drivers: mapped, history: history.results, events: events.results, booking });
}

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { action?: unknown; bookingId?: unknown; driverId?: unknown; vehicleId?: unknown; assignmentId?: unknown; agreedPayment?: unknown; paymentStatus?: unknown; paymentDate?: unknown; paymentNotes?: unknown; note?: unknown };
  const action = String(body.action || 'OFFER'); const bookingId = Number(body.bookingId); const now = new Date().toISOString();
  if (action === 'OFFER' || action === 'DIRECT_ASSIGN' || action === 'DIRECT_ASSIGN_START') {
    const driverId = typeof body.driverId === 'string' ? body.driverId : ''; const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId : ''; const payment = Number(body.agreedPayment);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0 || !driverId || !vehicleId || !Number.isFinite(payment) || payment < 0) return NextResponse.json({ error: 'Booking, Driver, vehicle and agreed payment are required' }, { status: 400 });
    const direct = action === 'DIRECT_ASSIGN' || action === 'DIRECT_ASSIGN_START';
    if (direct && driverId !== user.userId) return NextResponse.json({ error: 'Direct assignment is available only for the signed-in Owner/Admin Driver profile' }, { status: 403 });
    const booking = await env.DB.prepare('SELECT id,pickup_at FROM bookings WHERE id=? AND owner_id=?').bind(bookingId, user.ownerId).first<{ id: number; pickup_at: string }>();
    const selection = await exactDriverVehicle(driverId, vehicleId, user.organisationId, user.ownerId);
    if (!booking || !selection) return NextResponse.json({ error: 'Booking, Driver or mapped vehicle not found' }, { status: 404 });
    const { driver, vehicle, reasons } = selection; if (reasons.length) return NextResponse.json({ error: `Driver or vehicle is not eligible: ${reasons.join('; ')}`, reasons }, { status: 409 });
    const conflicts = await scheduleConflicts(user.ownerId, driverId, bookingId, booking.pickup_at); if (conflicts.length) return NextResponse.json({ error: 'Schedule conflict prevents this offer', conflicts }, { status: 409 });
    const current = await env.DB.prepare('SELECT * FROM booking_assignments WHERE owner_id=? AND booking_id=? AND active=1').bind(user.ownerId, bookingId).first<AssignmentRow>();
    if (current) await transitionAssignment(current, user.email, 'REASSIGNMENT_REQUIRED', 'Replaced by a new Driver offer');
    const initialStatus = direct ? 'ASSIGNED' : 'OFFERED';
    const result = await env.DB.prepare("INSERT INTO booking_assignments(owner_id,organisation_id,booking_id,driver_staff_id,vehicle_id,driver_name_snapshot,driver_licence_snapshot,vehicle_registration_snapshot,vehicle_licence_snapshot,status,active,driver_agreed_payment,payment_status,offered_at,assigned_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,'PENDING',?,?,?,?)").bind(user.ownerId,user.organisationId,bookingId,driverId,vehicleId,String(driver.full_name||''),String(driver.private_hire_licence_number||''),String(vehicle.registration||''),String(vehicle.private_hire_vehicle_licence_number||''),initialStatus,payment,now,direct?now:'',now,now).run();
    const row = await env.DB.prepare('SELECT * FROM booking_assignments WHERE id=?').bind(Number(result.meta.last_row_id)).first<AssignmentRow>();
    if (row) {
      await env.DB.prepare('INSERT INTO assignment_events(owner_id,assignment_id,booking_id,driver_staff_id,actor_email,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.ownerId,row.id,bookingId,driverId,user.email,'',initialStatus,`${String(body.note||'').slice(0,800)}${body.note?' · ':''}${vehicle.registration} · ${vehicle.private_hire_vehicle_licence_number}`,now).run();
      if (direct) await env.DB.prepare('UPDATE bookings SET assigned_driver_user_id=?,driver_name=?,driver_licence=?,vehicle_registration=?,vehicle_licence=?,dispatched_by=?,dispatched_at=?,updated_at=? WHERE id=? AND owner_id=?').bind(driverId,row.driver_name_snapshot,row.driver_licence_snapshot,row.vehicle_registration_snapshot,row.vehicle_licence_snapshot,user.email,now,now,bookingId,user.ownerId).run();
      if (action === 'DIRECT_ASSIGN_START') await transitionAssignment(row,user.email,'EN_ROUTE','Owner/Admin Driver and vehicle confirmed before journey start');
    }
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  }
  const assignmentId = Number(body.assignmentId); const row = await env.DB.prepare('SELECT * FROM booking_assignments WHERE id=? AND owner_id=?').bind(assignmentId, user.ownerId).first<AssignmentRow>();
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (action === 'CONFIRM' && row.status === 'ACKNOWLEDGED') await transitionAssignment(row, user.email, 'ASSIGNED', String(body.note || ''));
  else if (action === 'BACK_TO_ACTIVE' && row.status === 'EN_ROUTE' && row.active) await transitionAssignment(row,user.email,'ASSIGNED',String(body.note||'Journey returned to active before arrival'));
  else if (action === 'START_JOURNEY' && row.status === 'ASSIGNED' && row.active) {
    const booking = await env.DB.prepare('SELECT pickup_at FROM bookings WHERE id=? AND owner_id=?').bind(row.booking_id,user.ownerId).first<{pickup_at:string}>();
    const selection = await exactDriverVehicle(row.driver_staff_id,row.vehicle_id,user.organisationId,user.ownerId);
    if (!booking || !selection) return NextResponse.json({ error: 'The assigned Driver or vehicle mapping no longer exists. Reassign the journey.' }, { status: 409 });
    if (selection.reasons.length) return NextResponse.json({ error: `Journey cannot start: ${selection.reasons.join('; ')}`, reasons: selection.reasons }, { status: 409 });
    const conflicts = await scheduleConflicts(user.ownerId,row.driver_staff_id,row.booking_id,booking.pickup_at); if(conflicts.length)return NextResponse.json({error:'Journey cannot start because the Driver has a schedule or availability conflict',conflicts},{status:409});
    await transitionAssignment(row,user.email,'EN_ROUTE',String(body.note||'Driver and vehicle revalidated before journey start'));
  }
  else if (action === 'CANCEL' && row.active) await transitionAssignment(row, user.email, 'ASSIGNMENT_CANCELLED', String(body.note || ''));
  else if (action === 'REASSIGN' && row.active) await transitionAssignment(row, user.email, 'REASSIGNMENT_REQUIRED', String(body.note || 'Reassignment requested by Admin'));
  else if (action === 'CUSTOMER_CANCEL' && row.active) await transitionAssignment(row, user.email, 'CUSTOMER_CANCELLED', String(body.note || ''));
  else if (action === 'ADMIN_NEXT' && row.active) {
    const next: Record<string,string> = { EN_ROUTE: 'ARRIVED', ARRIVED: 'PASSENGER_ONBOARD', PASSENGER_ONBOARD: 'COMPLETED' };
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
