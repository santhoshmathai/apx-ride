import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

async function authenticatedOwner() {
  const user = await getPortalAdmin();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}

function retentionDate(pickupAt: unknown) {
  const date = new Date(String(pickupAt || ''));
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString();
}

async function audit(ownerId: string, actorEmail: string, action: string, id: number, summary: string) {
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(ownerId, actorEmail, action, 'booking', String(id), summary, new Date().toISOString()).run();
}

function authError(error: unknown) {
  if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }
  if (error instanceof Error && error.message === 'ACCESS_DENIED') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  throw error;
}

async function ready() {
  return;
}

export async function GET() {
  try {
    const user = await authenticatedOwner();
    await ready();
    const data = await env.DB.prepare(
      `SELECT b.*,a.id AS active_assignment_id,a.status AS assignment_status,
         latest.driver_name_snapshot AS assignment_driver_name,
         latest.driver_licence_snapshot AS assignment_driver_licence,
         latest.vehicle_registration_snapshot AS assignment_vehicle_registration,
         latest.vehicle_licence_snapshot AS assignment_vehicle_licence
       FROM bookings b
       LEFT JOIN booking_assignments a ON a.id=(
         SELECT ba.id FROM booking_assignments ba
         WHERE ba.owner_id=b.owner_id AND ba.booking_id=b.id AND ba.active=1
         ORDER BY ba.id DESC LIMIT 1
       )
       LEFT JOIN booking_assignments latest ON latest.id=(
         SELECT history.id FROM booking_assignments history
         WHERE history.owner_id=b.owner_id AND history.booking_id=b.id
         ORDER BY history.id DESC LIMIT 1
       )
       WHERE b.owner_id=? ORDER BY b.pickup_at DESC`,
    )
      .bind(user.userId)
      .all();
    return NextResponse.json((data.results as Record<string, unknown>[]).map((row) => ({
      ...row,
      driver_name: row.assignment_driver_name || row.driver_name || '',
      driver_licence: row.assignment_driver_licence || row.driver_licence || '',
      vehicle_registration: row.assignment_vehicle_registration || row.vehicle_registration || '',
      vehicle_licence: row.assignment_vehicle_licence || row.vehicle_licence || '',
    })));
  } catch (error) {
    return authError(error);
  }
}

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const user = await authenticatedOwner();
    await ready();
    const b = (await req.json()) as Record<string, unknown>;
    const hirerName = String(b.hirerName || '').trim(), passengerName = String(b.passengerName || '').trim();
    if (!hirerName && !passengerName) return NextResponse.json({ error: 'Enter either a Hirer name or a Passenger name.' }, { status: 400 });
    const now = new Date().toISOString();
    const respondedBy = typeof b.respondedBy === 'string' && b.respondedBy.trim() ? b.respondedBy.trim().slice(0,254) : user.email;
    const bookingReceivedAt = typeof b.bookingReceivedAt === 'string' && b.bookingReceivedAt ? b.bookingReceivedAt : now;
    const result = await env.DB.prepare(
      `INSERT INTO bookings(owner_id,hirer_name,passenger_name,customer_email,phone,pickup,dropoff,pickup_at,booking_received_at,responded_by,responded_at,operator,driver_call_sign,driver_name,driver_licence,booking_type,passengers,large_bags,small_bags,fleet_tier,distance,fare,base_fare,airport_fee,toll_fee,tariff,status,notes,retention_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        user.userId,
        hirerName || passengerName,
        passengerName || hirerName,
        b.customerEmail || '',
        b.phone || '',
        b.pickup || '',
        b.dropoff || '',
        b.pickupAt || now,
        bookingReceivedAt,
        respondedBy,
        now,
        b.operator || 'APX RIDE',
        b.driverCallSign || '',
        b.driverName || '',
        b.driverLicence || '',
        b.bookingType || 'CASH',
        b.passengers || 1,
        b.largeBags || 0,
        b.smallBags || 0,
        b.fleetTier || 'Saloon',
        b.distance || 0,
        b.fare || 0,
        b.baseFare || 0,
        b.airportFee || 0,
        b.tollFee || 0,
        b.tariff || 'day',
        b.status || 'upcoming',
        b.notes || '',
        retentionDate(b.pickupAt || now),
        now,
        now,
      )
      .run();
    await audit(user.userId, user.email, 'CREATE_BOOKING', Number(result.meta.last_row_id), 'Created booking record');
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const user = await authenticatedOwner();
    await ready();
    const b = (await req.json()) as {
      id: number;
      status: string;
      paymentMethod?: string;
      accountStatus?: string;
    };
    const existing = await env.DB.prepare('SELECT status FROM bookings WHERE id=? AND owner_id=?').bind(b.id,user.userId).first<{status:string}>();
    if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (b.status === 'in_progress' && existing.status !== 'in_progress') return NextResponse.json({ error: 'Confirm an eligible Driver and vehicle through the assignment workflow before starting the journey.' }, { status: 409 });
    if (b.status === 'complete' && existing.status !== 'complete') {
      const completed = await env.DB.prepare("SELECT id FROM booking_assignments WHERE owner_id=? AND booking_id=? AND status='COMPLETED' LIMIT 1").bind(user.userId,b.id).first();
      if (!completed) return NextResponse.json({ error: 'Complete the auditable assignment workflow before completing the booking.' }, { status: 409 });
    }
    await env.DB.prepare(
      'UPDATE bookings SET status=?,payment_method=COALESCE(?,payment_method),account_status=COALESCE(?,account_status),updated_at=? WHERE id=? AND owner_id=?',
    )
      .bind(
        b.status,
        b.paymentMethod || null,
        b.accountStatus || null,
        new Date().toISOString(),
        b.id,
        user.userId,
      )
      .run();
    await audit(user.userId, user.email, 'UPDATE_BOOKING_STATUS', b.id, `Status changed to ${b.status}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const user = await authenticatedOwner();
    await ready();
    const b = (await req.json()) as Record<string, unknown>;
    const hirerName = String(b.hirerName || '').trim(), passengerName = String(b.passengerName || '').trim();
    if (!hirerName && !passengerName) return NextResponse.json({ error: 'Enter either a Hirer name or a Passenger name.' }, { status: 400 });
    const respondedBy = typeof b.respondedBy === 'string' && b.respondedBy.trim() ? b.respondedBy.trim().slice(0,254) : user.email;
    const bookingReceivedAt = typeof b.bookingReceivedAt === 'string' && b.bookingReceivedAt ? b.bookingReceivedAt : new Date().toISOString();
    await env.DB.prepare(
      `UPDATE bookings SET hirer_name=?,passenger_name=?,customer_email=?,phone=?,pickup=?,dropoff=?,pickup_at=?,booking_received_at=?,responded_by=?,operator=?,booking_type=?,passengers=?,large_bags=?,small_bags=?,fleet_tier=?,distance=?,fare=?,notes=?,retention_until=?,updated_at=? WHERE id=? AND owner_id=?`,
    )
      .bind(
        hirerName || passengerName,
        passengerName || hirerName,
        b.customerEmail || '',
        b.phone || '',
        b.pickup || '',
        b.dropoff || '',
        b.pickupAt || new Date().toISOString(),
        bookingReceivedAt,
        respondedBy,
        b.operator || 'APX RIDE',
        b.bookingType || 'CASH',
        b.passengers || 1,
        b.largeBags || 0,
        b.smallBags || 0,
        b.fleetTier || 'Saloon',
        b.distance || 0,
        b.fare || 0,
        b.notes || '',
        retentionDate(b.pickupAt),
        new Date().toISOString(),
        b.id,
        user.userId,
      )
      .run();
    await audit(user.userId, user.email, 'UPDATE_BOOKING', Number(b.id), 'Updated booking details');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const user = await authenticatedOwner();
    await ready();
    const url = new URL(req.url);
    await env.DB.prepare(
      "UPDATE bookings SET status='archived',updated_at=? WHERE id=? AND owner_id=?",
    )
      .bind(
        new Date().toISOString(),
        Number(url.searchParams.get('id')),
        user.userId,
      )
      .run();
    await audit(user.userId, user.email, 'ARCHIVE_BOOKING', Number(url.searchParams.get('id')), 'Archived booking record');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
