import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';

const columns = [
  ['reference', 'Booking reference'], ['booking_received_at', 'Booking received'], ['responded_by', 'Booking taken/responded by'],
  ['responded_at', 'Response recorded'], ['pickup_at', 'Journey date/time'], ['passenger_name', 'Hirer/passenger'],
  ['phone', 'Contact telephone'], ['customer_email', 'Contact email'], ['pickup', 'Pickup'], ['dropoff', 'Destination'],
  ['fare', 'Agreed fare GBP'], ['driver_name', 'Driver name'], ['driver_licence', 'Driver licence number'],
  ['vehicle_registration', 'Vehicle registration'], ['vehicle_licence', 'PH vehicle licence number'],
  ['dispatched_by', 'Dispatched by'], ['dispatched_at', 'Dispatch recorded'], ['status', 'Status'],
  ['retention_until', 'Retain until'], ['created_at', 'Created'], ['updated_at', 'Last updated'],
] as const;

function csvValue(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export async function GET(req: Request) {
  const user = await getPortalAdmin();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  const where = Number.isSafeInteger(id) && id > 0 ? 'owner_id=? AND id=?' : 'owner_id=?';
  const data = await env.DB.prepare(`SELECT 'APX-' || printf('%05d',id) AS reference,* FROM bookings WHERE ${where} ORDER BY pickup_at DESC`)
    .bind(...(where.includes('id=?') ? [user.userId, id] : [user.userId])).all<Record<string, unknown>>();
  const lines = [columns.map(([, label]) => csvValue(label)).join(','), ...data.results.map((row) => columns.map(([key]) => csvValue(row[key])).join(','))];
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(user.userId, user.email, 'EXPORT_COUNCIL_BOOKING_REGISTER', 'booking', id > 0 ? String(id) : 'all', `Exported ${data.results.length} booking record(s)`, new Date().toISOString()).run();
  return new NextResponse('\ufeff' + lines.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="apx-ride-council-booking-register${id > 0 ? `-${id}` : ''}.csv"`, 'cache-control': 'no-store' } });
}
