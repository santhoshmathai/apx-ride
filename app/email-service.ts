import { env } from 'cloudflare:workers';

type EmailEnvironment = { RESEND_API_KEY?: string; RESEND_WEBHOOK_SECRET?: string };
type OutboxRow = { id: number; organisation_id: string; recipient: string; copy_to: string; subject: string; message: string; status: string; attempts: number; sender_name: string; sender_email: string; reply_to_email: string; notification_copy_email: string };

const runtime = () => env as unknown as EmailEnvironment;
const retryMinutes = [1, 5, 30, 120, 720];

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function emailHtml(message: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#222"><div style="max-width:640px;margin:0 auto;padding:32px 18px"><div style="background:#111315;padding:24px;text-align:center;border-bottom:3px solid #d8aa2d"><strong style="color:#fff;font-size:26px;letter-spacing:4px">APX RIDE</strong><div style="color:#d8aa2d;font-size:11px;letter-spacing:3px;margin-top:6px">ELEVATE EVERY MILE</div></div><div style="background:#fff;padding:30px;border:1px solid #ddd;border-top:0"><div style="font-size:16px;line-height:1.7">${escapeHtml(message).replaceAll('\n', '<br>')}</div><p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #ddd;color:#777;font-size:12px">This is a service message about an APX RIDE booking request. Please reply to this email if any details are incorrect.</p></div></div></body></html>`;
}

export function emailConfigured() { return Boolean(runtime().RESEND_API_KEY); }
export function webhookConfigured() { return Boolean(runtime().RESEND_WEBHOOK_SECRET); }

export async function sendOutbox(outboxId: number, organisationId: string, allowFailed = false) {
  const apiKey = runtime().RESEND_API_KEY;
  if (!apiKey) return { ok: false, configured: false, status: 'PREPARED', error: 'Transactional email is not connected yet.' };
  const row = await env.DB.prepare(`SELECT o.*,s.sender_name,s.sender_email,s.reply_to_email,s.notification_copy_email FROM notification_outbox o JOIN public_booking_settings s ON s.organisation_id=o.organisation_id WHERE o.id=? AND o.organisation_id=?`).bind(outboxId, organisationId).first<OutboxRow>();
  if (!row) return { ok: false, configured: true, status: 'NOT_FOUND', error: 'Notification not found.' };
  if (['DELIVERED', 'SENT'].includes(row.status)) return { ok: true, configured: true, status: row.status };
  if (!['PREPARED', 'RETRY', ...(allowFailed ? ['FAILED'] : [])].includes(row.status)) return { ok: false, configured: true, status: row.status, error: 'Notification is not ready to send.' };
  const now = new Date().toISOString();
  const claimed = await env.DB.prepare("UPDATE notification_outbox SET status='SENDING',last_attempt_at=? WHERE id=? AND organisation_id=? AND status IN ('PREPARED','RETRY','FAILED')").bind(now, outboxId, organisationId).run();
  if (!claimed.meta.changes) return { ok: false, configured: true, status: row.status, error: 'Notification is already being processed.' };
  const copy = row.copy_to || row.notification_copy_email;
  const payload: Record<string, unknown> = { from: `${row.sender_name} <${row.sender_email}>`, to: [row.recipient], subject: row.subject, text: row.message, html: emailHtml(row.message), reply_to: row.reply_to_email };
  if (copy && copy.toLowerCase() !== row.recipient.toLowerCase()) payload.bcc = [copy];
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': `apx-outbox-${row.id}` }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (response.ok && result.id) {
      await env.DB.batch([
        env.DB.prepare("UPDATE notification_outbox SET status='SENT',attempts=attempts+1,provider_message_id=?,last_error='',next_attempt_at='',last_attempt_at=?,sent_at=? WHERE id=? AND organisation_id=?").bind(result.id, now, now, row.id, organisationId),
        env.DB.prepare('INSERT OR IGNORE INTO notification_deliveries(organisation_id,outbox_id,provider,provider_message_id,status,detail,occurred_at,event_id) VALUES(?,?,?,?,?,?,?,?)').bind(organisationId, row.id, 'RESEND', result.id, 'SENT', 'Accepted by email provider', now, `accepted-${result.id}`),
      ]);
      return { ok: true, configured: true, status: 'SENT', providerMessageId: result.id };
    }
    const attempts = row.attempts + 1, transient = response.status === 429 || response.status >= 500, canRetry = transient && attempts < retryMinutes.length;
    const next = canRetry ? new Date(Date.now() + retryMinutes[Math.min(attempts - 1, retryMinutes.length - 1)] * 60000).toISOString() : '';
    const status = canRetry ? 'RETRY' : 'FAILED';
    const error = result.message || result.name || `Email provider returned ${response.status}`;
    await env.DB.prepare('UPDATE notification_outbox SET status=?,attempts=?,last_error=?,next_attempt_at=?,last_attempt_at=? WHERE id=? AND organisation_id=?').bind(status, attempts, error.slice(0, 500), next, now, row.id, organisationId).run();
    return { ok: false, configured: true, status, error };
  } catch (error) {
    const attempts = row.attempts + 1, canRetry = attempts < retryMinutes.length;
    const next = canRetry ? new Date(Date.now() + retryMinutes[Math.min(attempts - 1, retryMinutes.length - 1)] * 60000).toISOString() : '';
    const message = error instanceof Error ? error.message : 'Email provider unavailable';
    await env.DB.prepare('UPDATE notification_outbox SET status=?,attempts=?,last_error=?,next_attempt_at=?,last_attempt_at=? WHERE id=? AND organisation_id=?').bind(canRetry ? 'RETRY' : 'FAILED', attempts, message.slice(0, 500), next, now, row.id, organisationId).run();
    return { ok: false, configured: true, status: canRetry ? 'RETRY' : 'FAILED', error: message };
  }
}

export async function processDueOutbox(organisationId: string, limit = 10) {
  const due = await env.DB.prepare("SELECT id FROM notification_outbox WHERE organisation_id=? AND (status='PREPARED' OR (status='RETRY' AND (next_attempt_at='' OR next_attempt_at<=?))) ORDER BY created_at LIMIT ?").bind(organisationId, new Date().toISOString(), limit).all<{ id: number }>();
  const results = [];
  for (const item of due.results) results.push(await sendOutbox(item.id, organisationId));
  return results;
}

export function webhookSecret() { return runtime().RESEND_WEBHOOK_SECRET || ''; }
