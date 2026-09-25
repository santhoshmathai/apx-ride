import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { driverEligibilitySelect, eligibilityReasons, type DriverEligibilityRow } from '../../driver-eligibility';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';

type ProfileBody = {
  staffId?: unknown; fullName?: unknown; phone?: unknown; licensingAuthority?: unknown;
  privateHireLicenceNumber?: unknown; privateHireLicenceExpiry?: unknown; dvlaLicenceNumber?: unknown;
  dvlaLicenceExpiry?: unknown; addressEvidenceStatus?: unknown; profileActive?: unknown;
  registration?: unknown; makeModelColour?: unknown; privateHireVehicleLicenceNumber?: unknown;
  privateHireVehicleLicenceExpiry?: unknown; motExpiry?: unknown; insuranceExpiry?: unknown;
  v5DocumentStatus?: unknown; vehicleActive?: unknown; vehicleApproved?: unknown; approvedForAssignment?: unknown;
};

const text = (value: unknown, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const status = (value: unknown) => value === 'VERIFIED' ? 'VERIFIED' : 'MISSING';

async function admin() {
  if (!cloudflareAuthEnabled()) return null;
  const user = await getPortalPrincipal();
  return user?.role === 'OWNER_ADMIN' ? user : null;
}

export async function GET(req: Request) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const staffId = new URL(req.url).searchParams.get('staffId');
  if (!staffId) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
  const row = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=? AND s.owner_id=?`).bind(staffId, user.organisationId, user.ownerId).first<Record<string, unknown> & DriverEligibilityRow>();
  if (!row) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  return NextResponse.json({ ...row, eligibility_reasons: eligibilityReasons(row) });
}

export async function PUT(req: Request) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as ProfileBody;
  const staffId = text(body.staffId, 80);
  const staff = await env.DB.prepare('SELECT id,email,role,active,access_subject FROM portal_staff WHERE id=? AND organisation_id=? AND owner_id=?').bind(staffId, user.organisationId, user.ownerId).first<{ id: string; email: string; role: string; active: number; access_subject: string | null }>();
  if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  const now = new Date().toISOString();
  const existing = await env.DB.prepare('SELECT id FROM driver_profiles WHERE staff_id=? AND organisation_id=?').bind(staffId, user.organisationId).first<{ id: string }>();
  const profileId = existing?.id || crypto.randomUUID();
  const values = {
    fullName: text(body.fullName), phone: text(body.phone, 40), licensingAuthority: text(body.licensingAuthority),
    privateHireLicenceNumber: text(body.privateHireLicenceNumber), privateHireLicenceExpiry: text(body.privateHireLicenceExpiry, 10),
    dvlaLicenceNumber: text(body.dvlaLicenceNumber), dvlaLicenceExpiry: text(body.dvlaLicenceExpiry, 10), addressEvidenceStatus: status(body.addressEvidenceStatus),
    profileActive: body.profileActive === false ? 0 : 1, approved: body.approvedForAssignment === true ? 1 : 0,
  };
  if (existing) {
    await env.DB.prepare('UPDATE driver_profiles SET full_name=?,phone=?,licensing_authority=?,private_hire_licence_number=?,private_hire_licence_expiry=?,dvla_licence_number=?,dvla_licence_expiry=?,address_evidence_status=?,active=?,approved_for_assignment=?,updated_at=? WHERE id=? AND organisation_id=?')
      .bind(values.fullName, values.phone, values.licensingAuthority, values.privateHireLicenceNumber, values.privateHireLicenceExpiry, values.dvlaLicenceNumber, values.dvlaLicenceExpiry, values.addressEvidenceStatus, values.profileActive, values.approved, now, profileId, user.organisationId).run();
  } else {
    await env.DB.prepare('INSERT INTO driver_profiles(id,organisation_id,owner_id,staff_id,full_name,phone,licensing_authority,private_hire_licence_number,private_hire_licence_expiry,dvla_licence_number,dvla_licence_expiry,address_evidence_status,active,approved_for_assignment,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(profileId, user.organisationId, user.ownerId, staffId, values.fullName, values.phone, values.licensingAuthority, values.privateHireLicenceNumber, values.privateHireLicenceExpiry, values.dvlaLicenceNumber, values.dvlaLicenceExpiry, values.addressEvidenceStatus, values.profileActive, values.approved, now, now).run();
  }
  const vehicle = await env.DB.prepare('SELECT id FROM driver_vehicles WHERE driver_profile_id=? AND organisation_id=?').bind(profileId, user.organisationId).first<{ id: string }>();
  const vehicleId = vehicle?.id || crypto.randomUUID();
  const vehicleValues = [text(body.registration, 20).toUpperCase(), text(body.makeModelColour), text(body.privateHireVehicleLicenceNumber), text(body.privateHireVehicleLicenceExpiry, 10), text(body.motExpiry, 10), text(body.insuranceExpiry, 10), status(body.v5DocumentStatus), body.vehicleApproved === true ? 1 : 0, body.vehicleActive === false ? 0 : 1];
  if (vehicle) await env.DB.prepare('UPDATE driver_vehicles SET registration=?,make_model_colour=?,private_hire_vehicle_licence_number=?,private_hire_vehicle_licence_expiry=?,mot_expiry=?,insurance_expiry=?,v5_document_status=?,approved=?,active=?,updated_at=? WHERE id=? AND organisation_id=?').bind(...vehicleValues, now, vehicleId, user.organisationId).run();
  else await env.DB.prepare('INSERT INTO driver_vehicles(id,organisation_id,owner_id,driver_profile_id,registration,make_model_colour,private_hire_vehicle_licence_number,private_hire_vehicle_licence_expiry,mot_expiry,insurance_expiry,v5_document_status,approved,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(vehicleId, user.organisationId, user.ownerId, profileId, ...vehicleValues, now, now).run();

  const updated = await env.DB.prepare(`${driverEligibilitySelect} WHERE s.id=? AND s.organisation_id=? AND s.owner_id=?`).bind(staffId, user.organisationId, user.ownerId).first<Record<string, unknown> & DriverEligibilityRow>();
  if (!updated) return NextResponse.json({ error: 'Could not reload Driver profile' }, { status: 500 });
  const reasons = eligibilityReasons(updated);
  if (values.approved && reasons.filter((reason) => reason !== 'Driver is not approved for assignment').length) {
    await env.DB.prepare('UPDATE driver_profiles SET approved_for_assignment=0,updated_at=? WHERE id=?').bind(now, profileId).run();
    return NextResponse.json({ error: `Cannot approve for assignment: ${reasons.filter((reason) => reason !== 'Driver is not approved for assignment').join('; ')}` }, { status: 409 });
  }
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId, user.email, 'UPDATE_DRIVER_COMPLIANCE', 'driver_profile', profileId, `Updated Driver compliance for ${staff.email}`, now).run();
  return NextResponse.json({ ok: true, eligibility_reasons: eligibilityReasons(updated) });
}
