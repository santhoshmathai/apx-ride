import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { transitionAssignment, type AssignmentRow } from '../../assignment-workflow';
import { getPortalPrincipal } from '../../portal-auth';

const transitions: Record<string, { from: string[]; to: string }> = {
  ACCEPT: { from: ['OFFERED'], to: 'ACKNOWLEDGED' }, DECLINE: { from: ['OFFERED'], to: 'DRIVER_DECLINED' },
  EN_ROUTE: { from: ['ASSIGNED'], to: 'EN_ROUTE' }, ARRIVED: { from: ['EN_ROUTE'], to: 'ARRIVED' },
  ONBOARD: { from: ['ARRIVED'], to: 'PASSENGER_ONBOARD' }, COMPLETE: { from: ['PASSENGER_ONBOARD'], to: 'COMPLETED' },
  NO_SHOW: { from: ['ARRIVED'], to: 'NO_SHOW' }, INCIDENT: { from: ['ACKNOWLEDGED','ASSIGNED','EN_ROUTE','ARRIVED','PASSENGER_ONBOARD'], to: 'INCIDENT_REPORTED' },
};
export async function POST(req: Request) {
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as { assignmentId?: unknown; action?: unknown; note?: unknown }; const id = Number(body.assignmentId); const action = String(body.action || '');
  const row = await env.DB.prepare('SELECT * FROM booking_assignments WHERE id=? AND owner_id=? AND driver_staff_id=?').bind(id, user.ownerId, user.userId).first<AssignmentRow>();
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (action === 'ASSISTANCE') {
    const now = new Date().toISOString(); await env.DB.prepare('INSERT INTO assignment_events(owner_id,assignment_id,booking_id,driver_staff_id,actor_email,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.ownerId, row.id, row.booking_id, user.userId, user.email, row.status, row.status, `ADMIN ASSISTANCE REQUESTED: ${String(body.note || '').slice(0, 900)}`, now).run(); return NextResponse.json({ ok: true });
  }
  const transition = transitions[action]; if (!transition || !transition.from.includes(row.status) || !row.active) return NextResponse.json({ error: 'This action is not available for the current assignment state' }, { status: 409 });
  const note = String(body.note || '').trim(); if (['DECLINE','NO_SHOW','INCIDENT'].includes(action) && !note) return NextResponse.json({ error: 'Please provide a reason or incident note' }, { status: 400 });
  await transitionAssignment(row, user.email, transition.to, note); return NextResponse.json({ ok: true });
}
