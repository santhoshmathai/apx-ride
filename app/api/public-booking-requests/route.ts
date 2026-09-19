import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { sendOutbox } from '../../email-service';

const TEST_EMAIL = 'apxride.bookings@gmail.com';
const ALLOWED_ORIGINS = new Set([
  'https://apxride.com',
  'https://www.apxride.com',
  'https://apx-ride.hellosanthoshmathai.chatgpt.site',
]);

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

function error(origin: string, message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: cors(origin) });
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function wholeNumber(value: unknown, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : fallback;
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error(origin, 'Invalid request format.', 415);
  if (Number(req.headers.get('content-length') || 0) > 12000) return error(origin, 'Request is too large.', 413);
  const raw = await req.text();
  if (raw.length > 12000) return error(origin, 'Request is too large.', 413);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw) as Record<string, unknown>; }
  catch { return error(origin, 'Invalid request format.', 400); }

  // Test mode is deliberately narrow. A public launch will require a separate
  // bot challenge, rate limits and an explicit enablement change.
  const email = text(input.email, 200).toLowerCase();
  if (email !== TEST_EMAIL) return error(origin, 'Online booking requests are not open yet.', 503);
  if (text(input.website, 200)) return error(origin, 'Request could not be submitted.', 400);
  if (input.privacy !== true) return error(origin, 'Please accept the privacy notice.', 400);

  const passengerName = text(input.passengerName, 120);
  const phone = text(input.phone, 40);
  const pickup = text(input.pickup, 300);
  const dropoff = text(input.dropoff, 300);
  const pickupAt = text(input.pickupAt, 40);
  const flightNumber = text(input.flightNumber, 60);
  const notes = text(input.notes, 800);
  const passengers = wholeNumber(input.passengers, 7, -1);
  const largeBags = wholeNumber(input.largeBags, 4, -1);
  const smallBags = wholeNumber(input.smallBags, 4, -1);
  if (!passengerName || !phone || !pickup || !dropoff || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(pickupAt) || passengers < 1 || largeBags < 0 || smallBags < 0) {
    return error(origin, 'Please check the journey, passenger and luggage details.', 400);
  }

  const organisation = await env.DB.prepare('SELECT id,owner_user_id FROM organisations WHERE lower(owner_email)=?').bind(TEST_EMAIL).first<{ id: string; owner_user_id: string }>();
  if (!organisation) return error(origin, 'The booking operator is not ready. Sign in to the portal with the bookings account and open Booking Requests first.', 503);
  const settings = await env.DB.prepare('SELECT acknowledgement_template FROM public_booking_settings WHERE organisation_id=?').bind(organisation.id).first<{ acknowledgement_template: string }>();
  if (!settings) return error(origin, 'The booking operator is not ready.', 503);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM booking_requests WHERE organisation_id=? AND source='PUBLIC_WEBSITE_TEST' AND created_at>=?").bind(organisation.id, since).first<{ count: number }>();
  if ((recent?.count || 0) >= 3) return error(origin, 'Test request limit reached. Please try again later.', 429);

  const now = new Date().toISOString();
  const reference = `APX-TEST-${now.slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const combinedNotes = [flightNumber ? `Flight: ${flightNumber}` : '', notes].filter(Boolean).join(' · ');
  const created = await env.DB.prepare('INSERT INTO booking_requests(organisation_id,owner_id,reference,passenger_name,email,phone,pickup,dropoff,pickup_at,passengers,large_bags,small_bags,fleet_tier,quoted_fare,notes,source,status,decision_reason,created_at,updated_at,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(organisation.id, organisation.owner_user_id, reference, passengerName, email, phone, pickup, dropoff, pickupAt, passengers, largeBags, smallBags, '7-seater', 0, combinedNotes, 'PUBLIC_WEBSITE_TEST', 'RECEIVED', '', now, now, '').run();
  const requestId = Number(created.meta.last_row_id);
  await env.DB.prepare('INSERT INTO booking_request_events(organisation_id,request_id,actor_email,event_type,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(organisation.id, requestId, 'public-website', 'REQUEST_CREATED', '', 'RECEIVED', 'Test request from public website', now).run();
  const message = (settings.acknowledgement_template || 'Thank you {passenger}. We received request {reference} and will confirm availability shortly.')
    .replaceAll('{passenger}', passengerName).replaceAll('{reference}', reference).replaceAll('{pickup}', pickup).replaceAll('{dropoff}', dropoff).replaceAll('{pickupAt}', pickupAt).replaceAll('{fare}', '0.00');
  const notification = await env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(organisation.id, requestId, 'EMAIL', email, 'REQUEST_RECEIVED', `APX RIDE test request received — ${reference}`, message, 'PREPARED', 0, '', now, '').run();
  const delivery = await sendOutbox(Number(notification.meta.last_row_id), organisation.id);
  return NextResponse.json({ reference, notificationStatus: delivery.status, testMode: true }, { status: 201, headers: cors(origin) });
}
