import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';

async function authorised() {
  const user = await getPortalAdmin();
  if (!user) return null;
  return user;
}

function retentionDate(eventDate: string) {
  const date = new Date(`${eventDate || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 12);
  return date.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const type = new URL(req.url).searchParams.get('type');
  const result = type
    ? await env.DB.prepare('SELECT * FROM compliance_records WHERE owner_id=? AND record_type=? ORDER BY event_date DESC,id DESC').bind(user.userId, type).all()
    : await env.DB.prepare('SELECT * FROM compliance_records WHERE owner_id=? ORDER BY event_date DESC,id DESC').bind(user.userId).all();
  return NextResponse.json(result.results);
}

export async function POST(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = (await req.json()) as { eventDate?: string; recordType?: string; reference?: string; status?: string; data?: Record<string, unknown> };
  const now = new Date().toISOString();
  const eventDate = String(body.eventDate || now.slice(0, 10));
  const type = String(body.recordType || 'record');
  const reference = String(body.reference || `${type.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`);
  const result = await env.DB.prepare('INSERT INTO compliance_records(owner_id,record_type,reference,event_date,status,data_json,retention_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(user.userId, type, reference, eventDate, String(body.status || 'ACTIVE'), JSON.stringify(body.data || {}), retentionDate(eventDate), now, now).run();
  const id = String(result.meta.last_row_id);
  const snapshot = JSON.stringify({ reference, eventDate, status: String(body.status || 'ACTIVE'), data: body.data || {}, retentionUntil: retentionDate(eventDate) });
  await env.DB.prepare('INSERT INTO record_revisions(owner_id,record_id,revision_number,snapshot_json,actor_email,created_at) VALUES(?,?,?,?,?,?)')
    .bind(user.userId, Number(id), 1, snapshot, user.email, now).run();
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(user.userId, user.email, 'CREATE', type, id, `Created ${reference}`, now).run();
  return NextResponse.json({ id, reference }, { status: 201 });
}

export async function PUT(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = (await req.json()) as { id: number; eventDate?: string; reference?: string; status?: string; data?: Record<string, unknown> };
  const existing = await env.DB.prepare('SELECT * FROM compliance_records WHERE id=? AND owner_id=?').bind(Number(body.id), user.userId).first<Record<string, unknown>>();
  if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  const eventDate = String(body.eventDate || existing.event_date);
  const now = new Date().toISOString();
  const revision = await env.DB.prepare('SELECT COALESCE(MAX(revision_number),0)+1 AS next_revision FROM record_revisions WHERE owner_id=? AND record_id=?').bind(user.userId, Number(body.id)).first<{ next_revision: number }>();
  const nextSnapshot = JSON.stringify({ reference: String(body.reference || existing.reference), eventDate, status: String(body.status || existing.status), data: body.data || {}, retentionUntil: retentionDate(eventDate) });
  await env.DB.prepare('INSERT INTO record_revisions(owner_id,record_id,revision_number,snapshot_json,actor_email,created_at) VALUES(?,?,?,?,?,?)')
    .bind(user.userId, Number(body.id), revision?.next_revision || 1, nextSnapshot, user.email, now).run();
  await env.DB.prepare('UPDATE compliance_records SET reference=?,event_date=?,status=?,data_json=?,retention_until=?,updated_at=? WHERE id=? AND owner_id=?')
    .bind(String(body.reference || existing.reference), eventDate, String(body.status || existing.status), JSON.stringify(body.data || {}), retentionDate(eventDate), now, Number(body.id), user.userId).run();
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(user.userId, user.email, 'UPDATE', String(existing.record_type), String(body.id), `Updated ${String(body.reference || existing.reference)}`, now).run();
  return NextResponse.json({ ok: true });
}
