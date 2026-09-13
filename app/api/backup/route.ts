import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser, isApprovedEmail } from '../../chatgpt-auth';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !isApprovedEmail(user.email)) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const [bookings, expenses, records, settings, audit] = await Promise.all([
    env.DB.prepare('SELECT * FROM bookings WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM expenses WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM compliance_records WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM settings WHERE owner_id=?').bind(user.userId).all(),
    env.DB.prepare('SELECT * FROM audit_events WHERE owner_id=?').bind(user.userId).all(),
  ]);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), controller: 'APX RIDE', bookings: bookings.results, expenses: expenses.results, complianceRecords: records.results, settings: settings.results, auditTrail: audit.results }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="apx-ride-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  });
}
