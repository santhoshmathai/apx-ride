import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';

export async function GET() {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const drivers = await env.DB.prepare("SELECT id,email,active FROM portal_staff WHERE organisation_id=? AND owner_id=? AND role='DRIVER' ORDER BY email").bind(user.organisationId, user.ownerId).all();
  return NextResponse.json(drivers.results);
}

export async function POST(req: Request) {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { bookingId?: unknown; driverId?: unknown };
  const bookingId = Number(body.bookingId);
  const driverId = body.driverId;
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0 || (driverId !== null && (typeof driverId !== 'string' || !driverId))) return NextResponse.json({ error: 'Invalid assignment' }, { status: 400 });
  if (driverId) {
    const driver = await env.DB.prepare("SELECT id FROM portal_staff WHERE id=? AND organisation_id=? AND owner_id=? AND role='DRIVER' AND active=1").bind(driverId, user.organisationId, user.ownerId).first();
    if (!driver) return NextResponse.json({ error: 'Driver not approved' }, { status: 400 });
  }
  const result = await env.DB.prepare("UPDATE bookings SET assigned_driver_user_id=?,updated_at=? WHERE id=? AND owner_id=? AND status NOT IN ('completed','cancelled','canceled')").bind(driverId, new Date().toISOString(), bookingId, user.ownerId).run();
  if (result.meta.changes !== 1) return NextResponse.json({ error: 'Booking not found or no longer assignable' }, { status: 404 });
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, driverId ? 'ASSIGN_DRIVER' : 'UNASSIGN_DRIVER', 'booking', String(bookingId), driverId ? `Assigned driver ${driverId}` : 'Unassigned driver', new Date().toISOString()).run();
  return NextResponse.json({ ok: true });
}
