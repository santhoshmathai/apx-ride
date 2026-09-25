import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

export async function GET() {
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const rows = await env.DB.prepare("SELECT s.id,s.email,s.role,s.active,s.created_at,s.last_login_at,CASE WHEN s.access_subject IS NULL THEN 0 ELSE 1 END AS identity_verified,CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS has_driver_profile,COALESCE(p.approved_for_assignment,0) AS approved_for_assignment FROM portal_staff s LEFT JOIN driver_profiles p ON p.staff_id=s.id AND p.organisation_id=s.organisation_id WHERE s.organisation_id=? AND s.owner_id=? ORDER BY CASE s.role WHEN 'OWNER_ADMIN' THEN 0 ELSE 1 END,s.email").bind(user.organisationId, user.ownerId).all();
  return NextResponse.json(rows.results);
}

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Valid driver email required' }, { status: 400 });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO portal_staff(id,organisation_id,owner_id,email,role,active,created_at,updated_at) VALUES(?,?,?,?, 'DRIVER',1,?,?)").bind(id, user.organisationId, user.ownerId, email, now, now),
      env.DB.prepare("INSERT INTO driver_profiles(id,organisation_id,owner_id,staff_id,active,approved_for_assignment,created_at,updated_at) VALUES(?,?,?,?,1,0,?,?)").bind(crypto.randomUUID(), user.organisationId, user.ownerId, id, now, now),
    ]);
  } catch { return NextResponse.json({ error: 'Email already provisioned' }, { status: 409 }); }
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, 'PROVISION_DRIVER', 'portal_staff', id, `Provisioned ${email}`, now).run();
  return NextResponse.json({ id, email, role: 'DRIVER' }, { status: 201 });
}

export async function PATCH(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
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

export async function DELETE(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  if (!cloudflareAuthEnabled()) return NextResponse.json({ error: 'Not available in Sites mode' }, { status: 404 });
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Driver ID required' }, { status: 400 });
  const member = await env.DB.prepare("SELECT id,email,active,access_subject FROM portal_staff WHERE id=? AND organisation_id=? AND owner_id=? AND role='DRIVER'").bind(id, user.organisationId, user.ownerId).first<{ id: string; email: string; active: number; access_subject: string | null }>();
  if (!member) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  if (member.active) return NextResponse.json({ error: 'Disable the Driver before deleting them' }, { status: 409 });
  if (member.access_subject) return NextResponse.json({ error: 'A Driver who has logged in must be retained as a disabled historical record' }, { status: 409 });
  const assignment = await env.DB.prepare('SELECT id FROM bookings WHERE assigned_driver_user_id=? LIMIT 1').bind(id).first();
  if (assignment) return NextResponse.json({ error: 'This Driver has assignment history and must be retained as disabled' }, { status: 409 });
  const profile = await env.DB.prepare('SELECT id FROM driver_profiles WHERE staff_id=? AND organisation_id=?').bind(id, user.organisationId).first<{ id: string }>();
  if (profile) await env.DB.batch([
    env.DB.prepare('DELETE FROM driver_vehicles WHERE driver_profile_id=? AND organisation_id=?').bind(profile.id, user.organisationId),
    env.DB.prepare('DELETE FROM driver_profiles WHERE id=? AND organisation_id=?').bind(profile.id, user.organisationId),
  ]);
  const result = await env.DB.prepare("DELETE FROM portal_staff WHERE id=? AND organisation_id=? AND owner_id=? AND role='DRIVER' AND active=0 AND access_subject IS NULL").bind(id, user.organisationId, user.ownerId).run();
  if (result.meta.changes !== 1) return NextResponse.json({ error: 'This Driver has assignment history and must be retained as disabled' }, { status: 409 });
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, 'DELETE_UNUSED_DRIVER', 'portal_staff', id, `Deleted unused Driver ${member.email}`, now).run();
  return NextResponse.json({ ok: true });
}
