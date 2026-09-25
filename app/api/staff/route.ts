import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';

export async function GET() {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const rows = await env.DB.prepare("SELECT id,email,role,active,created_at,CASE WHEN access_subject IS NULL THEN 0 ELSE 1 END AS identity_verified FROM portal_staff WHERE organisation_id=? AND owner_id=? ORDER BY CASE role WHEN 'OWNER_ADMIN' THEN 0 ELSE 1 END,email").bind(user.organisationId, user.ownerId).all();
  return NextResponse.json(rows.results);
}

export async function POST(req: Request) {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Valid driver email required' }, { status: 400 });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare("INSERT INTO portal_staff(id,organisation_id,owner_id,email,role,active,created_at,updated_at) VALUES(?,?,?,?, 'DRIVER',1,?,?)").bind(id, user.organisationId, user.ownerId, email, now, now).run();
  } catch { return NextResponse.json({ error: 'Email already provisioned' }, { status: 409 }); }
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, 'PROVISION_DRIVER', 'portal_staff', id, `Provisioned ${email}`, now).run();
  return NextResponse.json({ id, email, role: 'DRIVER' }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { id?: unknown; active?: unknown };
  if (typeof body.id !== 'string' || typeof body.active !== 'boolean') return NextResponse.json({ error: 'Invalid staff update' }, { status: 400 });
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE portal_staff SET active=?,updated_at=? WHERE id=? AND organisation_id=? AND owner_id=? AND role='DRIVER'").bind(body.active ? 1 : 0, now, body.id, user.organisationId, user.ownerId).run();
  if (result.meta.changes !== 1) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, body.active ? 'ENABLE_DRIVER' : 'DISABLE_DRIVER', 'portal_staff', body.id, body.active ? 'Driver enabled' : 'Driver disabled', now).run();
  return NextResponse.json({ ok: true });
}
