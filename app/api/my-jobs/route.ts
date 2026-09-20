import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalPrincipal } from '../../portal-auth';

export async function GET() {
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const jobs = await env.DB.prepare(`SELECT id,passenger_name,phone,pickup,dropoff,pickup_at,passengers,large_bags,small_bags,fleet_tier,status,notes
    FROM bookings WHERE owner_id=? AND assigned_driver_user_id=? AND status NOT IN ('cancelled','canceled') ORDER BY pickup_at DESC LIMIT 100`).bind(user.ownerId, user.userId).all();
  return NextResponse.json(jobs.results);
}
