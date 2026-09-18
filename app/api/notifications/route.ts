import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser, isApprovedEmail } from '../../chatgpt-auth';
import { emailConfigured, processDueOutbox, sendOutbox, webhookConfigured } from '../../email-service';

async function current() { const user = await getChatGPTUser(); return user && isApprovedEmail(user.email) ? user : null; }
function org(userId: string) { return `org_${userId}`; }

export async function GET() {
  const user = await current(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const organisationId = org(user.userId);
  const counts = await env.DB.prepare('SELECT status,COUNT(*) AS count FROM notification_outbox WHERE organisation_id=? GROUP BY status').bind(organisationId).all();
  const settings = await env.DB.prepare('SELECT sender_name,sender_email,reply_to_email,notification_copy_email FROM public_booking_settings WHERE organisation_id=?').bind(organisationId).first();
  return NextResponse.json({ emailConfigured: emailConfigured(), webhookConfigured: webhookConfigured(), counts: counts.results, settings });
}

export async function POST(req: Request) {
  const user = await current(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const organisationId = org(user.userId); const body = await req.json() as { action?: string; id?: number };
  if (body.action === 'PROCESS') return NextResponse.json({ results: await processDueOutbox(organisationId) });
  if (body.action === 'RETRY' && body.id) return NextResponse.json(await sendOutbox(Number(body.id), organisationId, true));
  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}

export async function PUT(req: Request) {
  const user = await current(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as Record<string, unknown>;
  const clean = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : fallback;
  const senderName = clean(body.senderName, 'APX RIDE'), senderEmail = clean(body.senderEmail, 'bookings@notifications.apxride.com'), replyTo = clean(body.replyToEmail, 'apxride.bookings@gmail.com'), copy = clean(body.notificationCopyEmail, 'apxride.bookings@gmail.com');
  if (![senderEmail, replyTo, copy].every((value) => value.includes('@'))) return NextResponse.json({ error: 'Please enter valid sender, reply-to and copy email addresses.' }, { status: 400 });
  await env.DB.prepare('UPDATE public_booking_settings SET sender_name=?,sender_email=?,reply_to_email=?,notification_copy_email=?,updated_at=? WHERE organisation_id=?').bind(senderName, senderEmail, replyTo, copy, new Date().toISOString(), org(user.userId)).run();
  return NextResponse.json({ ok: true });
}
