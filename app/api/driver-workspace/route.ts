import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { driverEligibilitySelect, eligibilityReasons, type DriverEligibilityRow } from '../../driver-eligibility';
import { getPortalPrincipal } from '../../portal-auth';

export async function GET() {
  const user = await getPortalPrincipal(); if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const jobs = await env.DB.prepare(`SELECT a.id AS assignment_id,a.status AS assignment_status,a.driver_agreed_payment,a.payment_status,a.payment_date,a.payment_notes,a.collection_method,a.collection_status,a.collected_at,a.receipt_number,a.offered_at,a.acknowledged_at,a.assigned_at,a.completed_at,b.id,b.passenger_name,b.phone,b.pickup,b.dropoff,b.pickup_at,b.passengers,b.large_bags,b.small_bags,b.fleet_tier,b.status AS booking_status,b.notes FROM booking_assignments a JOIN bookings b ON b.id=a.booking_id WHERE a.owner_id=? AND a.driver_staff_id=? ORDER BY b.pickup_at DESC LIMIT 200`).bind(user.ownerId, user.userId).all();
  const availability = await env.DB.prepare('SELECT * FROM driver_availability WHERE owner_id=? AND driver_staff_id=? ORDER BY unavailable_date DESC,id DESC LIMIT 100').bind(user.ownerId, user.userId).all();
  const profile = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=?`).bind(user.userId, user.organisationId).first<Record<string, unknown> & DriverEligibilityRow>();
  const earnings = await env.DB.prepare("SELECT COALESCE(SUM(driver_agreed_payment),0) AS total,COALESCE(SUM(CASE WHEN payment_status='PAID' THEN driver_agreed_payment ELSE 0 END),0) AS paid,COALESCE(SUM(CASE WHEN payment_status<>'PAID' THEN driver_agreed_payment ELSE 0 END),0) AS outstanding FROM booking_assignments WHERE owner_id=? AND driver_staff_id=? AND status='COMPLETED'").bind(user.ownerId, user.userId).first();
  return NextResponse.json({ jobs: jobs.results, availability: availability.results, profile: profile ? { ...profile, eligibility_reasons: eligibilityReasons(profile) } : null, earnings });
}
