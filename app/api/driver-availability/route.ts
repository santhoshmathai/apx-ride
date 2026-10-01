import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { startDate?: unknown; endDate?: unknown; startTime?: unknown; endTime?: unknown; reason?: unknown }; const startDate=String(body.startDate||''),endDate=String(body.endDate||''),start=String(body.startTime||''),end=String(body.endTime||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<startDate||!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||(startDate===endDate&&end<=start))return NextResponse.json({error:'Start Date, End Date, Start Time and End Time must form a valid range'},{status:400});
  const result = await env.DB.prepare('INSERT INTO driver_availability(owner_id,organisation_id,driver_staff_id,unavailable_date,unavailable_until,full_day,start_time,end_time,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(user.ownerId,user.organisationId,user.userId,startDate,endDate,0,start,end,String(body.reason||'').slice(0,300),new Date().toISOString()).run(); return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
export async function DELETE(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 }); const id = Number(new URL(req.url).searchParams.get('id'));
  const result = await env.DB.prepare('DELETE FROM driver_availability WHERE id=? AND owner_id=? AND driver_staff_id=?').bind(id, user.ownerId, user.userId).run(); return result.meta.changes === 1 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Availability entry not found' }, { status: 404 });
}
