import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';

export async function GET() {
  const user = await getPortalAdmin();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const [bookings, expenses, records, revisions, availability, messages, documents, settings, audit, organisation, bookingRequests, bookingRequestEvents, notificationOutbox] = await Promise.all([
    env.DB.prepare('SELECT * FROM bookings WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM expenses WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM compliance_records WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM record_revisions WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM unavailable_periods WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM message_logs WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM compliance_documents WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM settings WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM audit_events WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM organisations WHERE owner_user_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM booking_requests WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM booking_request_events WHERE organisation_id=?').bind(`org_${user.userId}`).all(),
    env.DB.prepare('SELECT * FROM notification_outbox WHERE organisation_id=?').bind(`org_${user.userId}`).all(),
  ]);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), controller: 'APX RIDE', bookings: bookings.results, expenses: expenses.results, complianceRecords: records.results, recordRevisions: revisions.results, unavailablePeriods: availability.results, messageLogs: messages.results, documentIndex: documents.results, settings: settings.results, auditTrail: audit.results, organisation: organisation.results, bookingRequests: bookingRequests.results, bookingRequestEvents: bookingRequestEvents.results, notificationOutbox: notificationOutbox.results }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="apx-ride-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  });
}
