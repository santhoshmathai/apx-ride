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
      'SELECT * FROM bookings WHERE owner_id=? ORDER BY pickup_at DESC',
    )
      .bind(user.userId)
      .all();
    return NextResponse.json(data.results);
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
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO bookings(owner_id,hirer_name,passenger_name,customer_email,phone,pickup,dropoff,pickup_at,booking_received_at,responded_by,responded_at,operator,driver_call_sign,driver_name,driver_licence,booking_type,passengers,large_bags,small_bags,fleet_tier,distance,fare,base_fare,airport_fee,toll_fee,tariff,status,notes,retention_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        user.userId,
        b.hirerName || b.passengerName || 'Unnamed hirer',
        b.passengerName || 'Unnamed passenger',
        b.customerEmail || '',
        b.phone || '',
        b.pickup || '',
        b.dropoff || '',
        b.pickupAt || now,
        b.bookingReceivedAt || now,
        user.email,
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
    await env.DB.prepare(
      `UPDATE bookings SET hirer_name=?,passenger_name=?,customer_email=?,phone=?,pickup=?,dropoff=?,pickup_at=?,booking_received_at=?,operator=?,driver_call_sign=?,driver_name=?,driver_licence=?,booking_type=?,passengers=?,large_bags=?,small_bags=?,fleet_tier=?,distance=?,fare=?,notes=?,retention_until=?,updated_at=? WHERE id=? AND owner_id=?`,
    )
      .bind(
        b.hirerName || b.passengerName || 'Unnamed hirer',
        b.passengerName || 'Unnamed passenger',
        b.customerEmail || '',
        b.phone || '',
        b.pickup || '',
        b.dropoff || '',
        b.pickupAt || new Date().toISOString(),
        b.bookingReceivedAt || new Date().toISOString(),
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
