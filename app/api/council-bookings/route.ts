import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';

const columns = [
  ['reference', 'Booking reference'], ['booking_received_at', 'Booking received'], ['responded_by', 'Booking taken/responded by'],
  ['responded_at', 'Response recorded'], ['pickup_at', 'Journey date/time'], ['hirer_name', 'Hirer'], ['passenger_name', 'Passenger'],
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
  const where = Number.isSafeInteger(id) && id > 0 ? 'b.owner_id=? AND b.id=?' : 'b.owner_id=?';
  const data = await env.DB.prepare(`SELECT 'APX-' || printf('%05d',b.id) AS reference,b.*,
      latest.driver_name_snapshot AS assignment_driver_name,
      latest.driver_licence_snapshot AS assignment_driver_licence,
      latest.vehicle_registration_snapshot AS assignment_vehicle_registration,
      latest.vehicle_licence_snapshot AS assignment_vehicle_licence
    FROM bookings b
    LEFT JOIN booking_assignments latest ON latest.id=(
      SELECT history.id FROM booking_assignments history
      WHERE history.owner_id=b.owner_id AND history.booking_id=b.id
      ORDER BY history.id DESC LIMIT 1
    )
    WHERE ${where} ORDER BY b.pickup_at DESC`)
    .bind(...(where.includes('id=?') ? [user.userId, id] : [user.userId])).all<Record<string, unknown>>();
  const rows: Record<string, unknown>[] = data.results.map((row) => ({ ...row,
    driver_name: row.assignment_driver_name || row.driver_name || '',
    driver_licence: row.assignment_driver_licence || row.driver_licence || '',
    vehicle_registration: row.assignment_vehicle_registration || row.vehicle_registration || '',
    vehicle_licence: row.assignment_vehicle_licence || row.vehicle_licence || '',
  }));
  const lines = [columns.map(([, label]) => csvValue(label)).join(','), ...rows.map((row) => columns.map(([key]) => csvValue(row[key])).join(','))];
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(user.userId, user.email, 'EXPORT_COUNCIL_BOOKING_REGISTER', 'booking', id > 0 ? String(id) : 'all', `Exported ${rows.length} booking record(s)`, new Date().toISOString()).run();
  return new NextResponse('\ufeff' + lines.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="apx-ride-council-booking-register${id > 0 ? `-${id}` : ''}.csv"`, 'cache-control': 'no-store' } });
}
