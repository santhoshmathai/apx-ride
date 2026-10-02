import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { addAssignmentEvent, scheduleConflicts, transitionAssignment, type AssignmentRow } from '../../assignment-workflow';
import { driverEligibilitySelect, driverOnlyEligibilityReasons, vehicleEligibilityReasons, type AssignmentVehicleRow, type DriverEligibilityRow } from '../../driver-eligibility';
import { getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

const transitions: Record<string, { from: string[]; to: string }> = {
  ACCEPT: { from: ['OFFERED'], to: 'ACKNOWLEDGED' }, DECLINE: { from: ['OFFERED'], to: 'DRIVER_DECLINED' },
  EN_ROUTE: { from: ['ASSIGNED'], to: 'EN_ROUTE' }, ARRIVED: { from: ['EN_ROUTE'], to: 'ARRIVED' },
  ONBOARD: { from: ['ARRIVED'], to: 'PASSENGER_ONBOARD' }, COMPLETE: { from: ['PASSENGER_ONBOARD'], to: 'COMPLETED' },
  NO_SHOW: { from: ['ARRIVED'], to: 'NO_SHOW' }, INCIDENT: { from: ['ACKNOWLEDGED','ASSIGNED','EN_ROUTE','ARRIVED','PASSENGER_ONBOARD'], to: 'INCIDENT_REPORTED' },
};
export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { assignmentId?: unknown; action?: unknown; note?: unknown }; const id = Number(body.assignmentId); const action = String(body.action || '');
  const row = await env.DB.prepare('SELECT * FROM booking_assignments WHERE id=? AND owner_id=? AND driver_staff_id=?').bind(id, user.ownerId, user.userId).first<AssignmentRow>();
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (action === 'ASSISTANCE') {
    const now = new Date().toISOString(); await env.DB.prepare('INSERT INTO assignment_events(owner_id,assignment_id,booking_id,driver_staff_id,actor_email,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.ownerId, row.id, row.booking_id, user.userId, user.email, row.status, row.status, `ADMIN ASSISTANCE REQUESTED: ${String(body.note || '').slice(0, 900)}`, now).run(); return NextResponse.json({ ok: true });
  }
  if (action === 'RECORD_COLLECTION') {
    if (!['ACKNOWLEDGED','ASSIGNED','EN_ROUTE','ARRIVED','PASSENGER_ONBOARD','COMPLETED'].includes(row.status)) return NextResponse.json({ error: 'Collection cannot be recorded for this assignment state' }, { status: 409 });
    const method = String((body as Record<string, unknown>).method || '').toUpperCase(); const collected = (body as Record<string, unknown>).collected === true;
    if (!['CASH','CARD','ACCOUNT'].includes(method)) return NextResponse.json({ error: 'Collection method must be cash, card or account' }, { status: 400 });
    const now = new Date().toISOString(); const receipt = row.receipt_number || `APX-RCT-${String(row.booking_id).padStart(5,'0')}-${String(row.id).padStart(4,'0')}`;
    await env.DB.prepare('UPDATE booking_assignments SET collection_method=?,collection_status=?,collected_at=?,receipt_number=?,updated_at=? WHERE id=? AND owner_id=? AND driver_staff_id=?').bind(method, collected ? 'COLLECTED' : 'NOT_COLLECTED', collected ? now : '', receipt, now, row.id, user.ownerId, user.userId).run();
    await addAssignmentEvent(row, user.email, row.status, `Customer payment collection recorded: ${method} · ${collected ? 'COLLECTED' : 'NOT COLLECTED'} · ${receipt}`);
    return NextResponse.json({ ok: true, receiptNumber: receipt });
  }
  const transition = transitions[action]; if (!transition || !transition.from.includes(row.status) || !row.active) return NextResponse.json({ error: 'This action is not available for the current assignment state' }, { status: 409 });
  const note = String(body.note || '').trim(); if (['DECLINE','NO_SHOW','INCIDENT'].includes(action) && !note) return NextResponse.json({ error: 'Please provide a reason or incident note' }, { status: 400 });
  if (action === 'EN_ROUTE') {
    const driver = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=? AND s.owner_id=?`).bind(user.userId,user.organisationId,user.ownerId).first<Record<string,unknown>&DriverEligibilityRow>();
    const vehicle = await env.DB.prepare(`SELECT v.id,v.registration,v.vehicle_make,v.vehicle_model,v.vehicle_colour,v.vehicle_category,v.active AS vehicle_active,v.approved AS vehicle_approved,v.private_hire_vehicle_licence_number,v.private_hire_vehicle_licence_expiry,v.mot_expiry,v.insurance_expiry,v.v5_document_status FROM driver_vehicles v JOIN driver_profiles p ON p.organisation_id=v.organisation_id AND p.staff_id=? WHERE v.id=? AND v.organisation_id=? AND p.owner_id=? AND (EXISTS (SELECT 1 FROM driver_vehicle_assignments a WHERE a.organisation_id=p.organisation_id AND a.driver_profile_id=p.id AND a.vehicle_id=v.id AND a.active=1 AND a.approved=1 AND (a.valid_from='' OR a.valid_from<=date('now')) AND (a.valid_until='' OR a.valid_until>=date('now'))) OR (v.driver_profile_id=p.id AND NOT EXISTS (SELECT 1 FROM driver_vehicle_assignments a2 WHERE a2.organisation_id=p.organisation_id AND a2.driver_profile_id=p.id)))`).bind(user.userId,row.vehicle_id,user.organisationId,user.ownerId).first<AssignmentVehicleRow>();
    if (!driver || !vehicle) return NextResponse.json({ error: 'The assigned Driver or vehicle mapping no longer exists. Ask the Admin to reassign the journey.' }, { status: 409 });
    const reasons=[...driverOnlyEligibilityReasons(driver),...vehicleEligibilityReasons(vehicle)];
    if(reasons.length)return NextResponse.json({error:`Journey cannot start: ${reasons.join('; ')}`,reasons},{status:409});
    const booking=await env.DB.prepare('SELECT pickup_at FROM bookings WHERE id=? AND owner_id=?').bind(row.booking_id,user.ownerId).first<{pickup_at:string}>();
    if(!booking)return NextResponse.json({error:'Booking not found'},{status:404});
    const conflicts=await scheduleConflicts(user.ownerId,user.userId,row.booking_id,booking.pickup_at);
    if(conflicts.length)return NextResponse.json({error:'Journey cannot start because you have a schedule or availability conflict',conflicts},{status:409});
  }
  await transitionAssignment(row, user.email, transition.to, note); return NextResponse.json({ ok: true });
}
