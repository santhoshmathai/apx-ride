import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser, isApprovedEmail } from '../../chatgpt-auth';

const schema = `CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL, passenger_name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', pickup TEXT NOT NULL, dropoff TEXT NOT NULL, pickup_at TEXT NOT NULL, operator TEXT NOT NULL DEFAULT 'APX RIDE', passengers INTEGER NOT NULL DEFAULT 1, large_bags INTEGER NOT NULL DEFAULT 0, small_bags INTEGER NOT NULL DEFAULT 0, fleet_tier TEXT NOT NULL DEFAULT 'Saloon', distance REAL NOT NULL DEFAULT 0, fare REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'upcoming', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;

async function authenticatedOwner(): Promise<string> {
  const user = await getChatGPTUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  if (!isApprovedEmail(user.email)) throw new Error('ACCESS_DENIED');
  return user.userId;
}

function authError(error: unknown) {
  if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (error instanceof Error && error.message === 'ACCESS_DENIED') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  throw error;
}

async function ready() {
  await env.DB.prepare(schema).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bookings_owner_pickup ON bookings(owner_id, pickup_at)').run();
}

export async function GET() {
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const data = await env.DB.prepare('SELECT * FROM bookings WHERE owner_id=? ORDER BY pickup_at DESC').bind(ownerId).all();
    return NextResponse.json(data.results);
  } catch (error) {
    return authError(error);
  }
}

export async function POST(req: Request) {
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const b = await req.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const result = await env.DB.prepare(`INSERT INTO bookings(owner_id,passenger_name,phone,pickup,dropoff,pickup_at,operator,passengers,large_bags,small_bags,fleet_tier,distance,fare,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(ownerId,b.passengerName||'Unnamed passenger',b.phone||'',b.pickup||'',b.dropoff||'',b.pickupAt||now,b.operator||'APX RIDE',b.passengers||1,b.largeBags||0,b.smallBags||0,b.fleetTier||'Saloon',b.distance||0,b.fare||0,b.status||'upcoming',b.notes||'',now,now).run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const b = await req.json() as { id: number; status: string };
    await env.DB.prepare('UPDATE bookings SET status=?,updated_at=? WHERE id=? AND owner_id=?').bind(b.status,new Date().toISOString(),b.id,ownerId).run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const ownerId = await authenticatedOwner();
    await ready();
    const url = new URL(req.url);
    await env.DB.prepare("UPDATE bookings SET status='archived',updated_at=? WHERE id=? AND owner_id=?").bind(new Date().toISOString(),Number(url.searchParams.get('id')),ownerId).run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
