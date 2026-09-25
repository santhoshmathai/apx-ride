import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { driverEligibilitySelect, eligibilityReasons, type DriverEligibilityRow } from '../../driver-eligibility';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';

export async function GET() {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const drivers = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.organisation_id=? AND s.owner_id=? AND p.id IS NOT NULL ORDER BY s.email`).bind(user.organisationId, user.ownerId).all<Record<string, unknown> & DriverEligibilityRow>();
  return NextResponse.json(drivers.results.map((driver) => ({ ...driver, eligible: eligibilityReasons(driver).length === 0, eligibility_reasons: eligibilityReasons(driver) })));
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
    const driver = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=? AND s.owner_id=?`).bind(driverId, user.organisationId, user.ownerId).first<Record<string, unknown> & DriverEligibilityRow>();
    if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 400 });
    const reasons = eligibilityReasons(driver);
    if (reasons.length) return NextResponse.json({ error: `Driver is not eligible for assignment: ${reasons.join('; ')}`, reasons }, { status: 409 });
  }
  const result = await env.DB.prepare("UPDATE bookings SET assigned_driver_user_id=?,updated_at=? WHERE id=? AND owner_id=? AND status NOT IN ('completed','cancelled','canceled')").bind(driverId, new Date().toISOString(), bookingId, user.ownerId).run();
  if (result.meta.changes !== 1) return NextResponse.json({ error: 'Booking not found or no longer assignable' }, { status: 404 });
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, driverId ? 'ASSIGN_DRIVER' : 'UNASSIGN_DRIVER', 'booking', String(bookingId), driverId ? `Assigned driver ${driverId}` : 'Unassigned driver', new Date().toISOString()).run();
  return NextResponse.json({ ok: true });
}
