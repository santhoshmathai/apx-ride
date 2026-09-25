import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

async function authenticatedOwner(): Promise<string> {
  const user = await getPortalAdmin();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user.userId;
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
    const ownerId = await authenticatedOwner();
    await ready();
    const data = await env.DB.prepare(
      'SELECT * FROM bookings WHERE owner_id=? ORDER BY pickup_at DESC',
    )
      .bind(ownerId)
      .all();
    return NextResponse.json(data.results);
  } catch (error) {
    return authError(error);
  }
}

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const b = (await req.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO bookings(owner_id,passenger_name,customer_email,phone,pickup,dropoff,pickup_at,operator,driver_call_sign,driver_name,driver_licence,booking_type,passengers,large_bags,small_bags,fleet_tier,distance,fare,base_fare,airport_fee,toll_fee,tariff,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        ownerId,
        b.passengerName || 'Unnamed passenger',
        b.customerEmail || '',
        b.phone || '',
        b.pickup || '',
        b.dropoff || '',
        b.pickupAt || now,
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
        now,
        now,
      )
      .run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const ownerId = await authenticatedOwner();
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
        ownerId,
      )
      .run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const b = (await req.json()) as Record<string, unknown>;
    await env.DB.prepare(
      `UPDATE bookings SET passenger_name=?,customer_email=?,phone=?,pickup=?,dropoff=?,pickup_at=?,operator=?,driver_call_sign=?,driver_name=?,driver_licence=?,booking_type=?,passengers=?,large_bags=?,small_bags=?,fleet_tier=?,distance=?,fare=?,base_fare=?,airport_fee=?,toll_fee=?,tariff=?,notes=?,updated_at=? WHERE id=? AND owner_id=?`,
    )
      .bind(
        b.passengerName || 'Unnamed passenger',
        b.customerEmail || '',
        b.phone || '',
        b.pickup || '',
        b.dropoff || '',
        b.pickupAt || new Date().toISOString(),
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
        b.notes || '',
        new Date().toISOString(),
        b.id,
        ownerId,
      )
      .run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const url = new URL(req.url);
    await env.DB.prepare(
      "UPDATE bookings SET status='archived',updated_at=? WHERE id=? AND owner_id=?",
    )
      .bind(
        new Date().toISOString(),
        Number(url.searchParams.get('id')),
        ownerId,
      )
      .run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
