import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser, isApprovedEmail } from '../../chatgpt-auth';

async function user() {
  const value = await getChatGPTUser();
  return value && isApprovedEmail(value.email) ? value : null;
}

export async function GET() {
  const current = await user();
  if (!current) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const row = await env.DB.prepare('SELECT * FROM settings WHERE owner_id=?').bind(current.userId).first();
  return NextResponse.json(row || {});
}

export async function POST(req: Request) {
  const current = await user();
  if (!current) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = (await req.json()) as { fuelRate?: number; operators?: string[]; rates?: Record<string, unknown>; timeFormat?: '12' | '24'; messageTemplates?: Record<string, string> };
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO settings(owner_id,fare_model,fuel_per_100,include_fuel,review_url,operators_json,rates_json,time_format,message_templates_json,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET fuel_per_100=excluded.fuel_per_100,operators_json=excluded.operators_json,rates_json=excluded.rates_json,time_format=excluded.time_format,message_templates_json=excluded.message_templates_json,updated_at=excluded.updated_at`)
    .bind(current.userId, 'A', Number(body.fuelRate || 50), 1, '', JSON.stringify(body.operators || ['APX RIDE']), JSON.stringify(body.rates || {}), String(body.timeFormat || '24'), JSON.stringify(body.messageTemplates || {}), now).run();
  return NextResponse.json({ ok: true });
}
