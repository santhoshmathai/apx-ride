import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalPrincipal } from '../../portal-auth';

export async function POST(req: Request) {
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { date?: unknown; fullDay?: unknown; startTime?: unknown; endTime?: unknown; reason?: unknown }; const date = String(body.date || ''); const fullDay = body.fullDay !== false; const start = String(body.startTime || ''); const end = String(body.endTime || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (!fullDay && (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end))) return NextResponse.json({ error: 'Valid availability date and time required' }, { status: 400 });
  const result = await env.DB.prepare('INSERT INTO driver_availability(owner_id,organisation_id,driver_staff_id,unavailable_date,full_day,start_time,end_time,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.ownerId, user.organisationId, user.userId, date, fullDay ? 1 : 0, fullDay ? '' : start, fullDay ? '' : end, String(body.reason || '').slice(0, 300), new Date().toISOString()).run(); return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
export async function DELETE(req: Request) {
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 }); const id = Number(new URL(req.url).searchParams.get('id'));
  const result = await env.DB.prepare('DELETE FROM driver_availability WHERE id=? AND owner_id=? AND driver_staff_id=?').bind(id, user.ownerId, user.userId).run(); return result.meta.changes === 1 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Availability entry not found' }, { status: 404 });
}
