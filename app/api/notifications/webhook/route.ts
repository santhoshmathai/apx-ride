import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { webhookSecret } from '../../../email-service';

function decodeBase64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function equal(a: Uint8Array, b: Uint8Array) { if (a.length !== b.length) return false; let difference = 0; for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]; return difference === 0; }
async function verify(body: string, id: string, timestamp: string, signatureHeader: string) {
  const secret = webhookSecret(); if (!secret || !id || !timestamp || !signatureHeader) return false;
  const seconds = Number(timestamp); if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey('raw', decodeBase64(rawSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, signed));
  return signatureHeader.split(' ').some((candidate) => { const value = candidate.startsWith('v1,') ? candidate.slice(3) : ''; if (!value) return false; try { return equal(expected, decodeBase64(value)); } catch { return false; } });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const id = req.headers.get('svix-id') || '', timestamp = req.headers.get('svix-timestamp') || '', signature = req.headers.get('svix-signature') || '';
  if (!(await verify(raw, id, timestamp, signature))) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  const event = JSON.parse(raw) as { type?: string; created_at?: string; data?: { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } } };
  const providerId = event.data?.email_id || ''; if (!providerId) return NextResponse.json({ ok: true });
  const row = await env.DB.prepare('SELECT id,organisation_id FROM notification_outbox WHERE provider_message_id=?').bind(providerId).first<{ id: number; organisation_id: string }>();
  if (!row) return NextResponse.json({ ok: true });
  const statuses: Record<string, string> = { 'email.sent': 'SENT', 'email.delivered': 'DELIVERED', 'email.delivery_delayed': 'RETRY', 'email.bounced': 'BOUNCED', 'email.complained': 'COMPLAINED', 'email.failed': 'FAILED', 'email.suppressed': 'SUPPRESSED' };
  const status = statuses[event.type || '']; if (!status) return NextResponse.json({ ok: true });
  const detail = event.data?.bounce?.message || event.data?.failed?.reason || event.type || '';
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO notification_deliveries(organisation_id,outbox_id,provider,provider_message_id,status,detail,occurred_at,event_id) VALUES(?,?,?,?,?,?,?,?)').bind(row.organisation_id, row.id, 'RESEND', providerId, status, detail.slice(0, 500), event.created_at || new Date().toISOString(), id),
    env.DB.prepare('UPDATE notification_outbox SET status=?,last_error=? WHERE id=? AND organisation_id=?').bind(status, ['BOUNCED', 'COMPLAINED', 'FAILED', 'SUPPRESSED'].includes(status) ? detail.slice(0, 500) : '', row.id, row.organisation_id),
  ]);
  return NextResponse.json({ ok: true });
}
