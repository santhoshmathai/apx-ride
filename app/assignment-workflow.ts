import { env } from 'cloudflare:workers';

export const ACTIVE_ASSIGNMENT_STATUSES = ['OFFERED', 'ACKNOWLEDGED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PASSENGER_ONBOARD'];
export const TERMINAL_ASSIGNMENT_STATUSES = ['COMPLETED', 'DRIVER_DECLINED', 'ASSIGNMENT_CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW', 'REASSIGNMENT_REQUIRED', 'INCIDENT_REPORTED'];

export type AssignmentRow = {
  id: number; booking_id: number; driver_staff_id: string; status: string; active: number;
  driver_agreed_payment: number; payment_status: string; payment_date: string; payment_notes: string;
  collection_method: string; collection_status: string; collected_at: string; receipt_number: string;
};

export async function addAssignmentEvent(row: AssignmentRow, actorEmail: string, toStatus: string, note = '') {
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO assignment_events(owner_id,assignment_id,booking_id,driver_staff_id,actor_email,from_status,to_status,note,created_at) VALUES((SELECT owner_id FROM booking_assignments WHERE id=?),?,?,?,?,?,?,?,?)')
    .bind(row.id, row.id, row.booking_id, row.driver_staff_id, actorEmail, row.status, toStatus, note.slice(0, 1000), now).run();
}

export async function transitionAssignment(row: AssignmentRow, actorEmail: string, toStatus: string, note = '') {
  const now = new Date().toISOString(); const terminal = TERMINAL_ASSIGNMENT_STATUSES.includes(toStatus);
  await addAssignmentEvent(row, actorEmail, toStatus, note);
  await env.DB.prepare('UPDATE booking_assignments SET status=?,active=?,acknowledged_at=CASE WHEN ?=\'ACKNOWLEDGED\' THEN ? ELSE acknowledged_at END,assigned_at=CASE WHEN ?=\'ASSIGNED\' THEN ? ELSE assigned_at END,completed_at=CASE WHEN ?=\'COMPLETED\' THEN ? ELSE completed_at END,updated_at=? WHERE id=?')
    .bind(toStatus, terminal ? 0 : 1, toStatus, now, toStatus, now, toStatus, now, now, row.id).run();
  if (terminal) await env.DB.prepare('UPDATE bookings SET assigned_driver_user_id=NULL,status=CASE WHEN ?=\'COMPLETED\' THEN \'complete\' WHEN ? IN (\'CUSTOMER_CANCELLED\',\'ASSIGNMENT_CANCELLED\') THEN \'cancelled\' ELSE status END,updated_at=? WHERE id=?').bind(toStatus, toStatus, now, row.booking_id).run();
  else await env.DB.prepare('UPDATE bookings SET assigned_driver_user_id=?,status=CASE WHEN ?=\'COMPLETED\' THEN \'complete\' ELSE status END,updated_at=? WHERE id=?').bind(row.driver_staff_id, toStatus, now, row.booking_id).run();
}

export async function scheduleConflicts(ownerId: string, driverId: string, bookingId: number, pickupAt: string) {
  const pickup = new Date(pickupAt).getTime();
  if (!Number.isFinite(pickup)) return ['Booking pickup time is invalid'];
  const from = new Date(pickup - 2 * 60 * 60 * 1000).toISOString(); const to = new Date(pickup + 2 * 60 * 60 * 1000).toISOString();
  const jobs = await env.DB.prepare(`SELECT b.id,b.pickup_at,b.pickup,b.dropoff,a.status FROM booking_assignments a JOIN bookings b ON b.id=a.booking_id WHERE a.owner_id=? AND a.driver_staff_id=? AND a.active=1 AND a.booking_id<>? AND a.status IN ('OFFERED','ACKNOWLEDGED','ASSIGNED','EN_ROUTE','ARRIVED','PASSENGER_ONBOARD') AND b.pickup_at BETWEEN ? AND ?`).bind(ownerId, driverId, bookingId, from, to).all<{ id: number; pickup_at: string; pickup: string; dropoff: string; status: string }>();
  const date = pickupAt.slice(0, 10); const time = pickupAt.slice(11, 16);
  const unavailable = await env.DB.prepare("SELECT reason FROM driver_availability WHERE owner_id=? AND driver_staff_id=? AND unavailable_date=? AND (full_day=1 OR (? >= start_time AND ? < end_time))").bind(ownerId, driverId, date, time, time).all<{ reason: string }>();
  return [
    ...jobs.results.map((job) => `Overlaps booking APX-${String(job.id).padStart(5, '0')} at ${new Date(job.pickup_at).toLocaleString('en-GB')} (${job.status})`),
    ...unavailable.results.map((entry) => `Driver unavailable${entry.reason ? `: ${entry.reason}` : ''}`),
  ];
}
