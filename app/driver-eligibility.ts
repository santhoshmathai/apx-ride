export type DriverEligibilityRow = {
  staff_active: number;
  identity_verified: number;
  profile_id: string | null;
  profile_active: number | null;
  approved_for_assignment: number | null;
  full_name: string | null;
  phone: string | null;
  licensing_authority: string | null;
  private_hire_licence_number: string | null;
  private_hire_licence_expiry: string | null;
  dvla_licence_number: string | null;
  dvla_licence_expiry: string | null;
  address_evidence_status: string | null;
  vehicle_id: string | null;
  vehicle_active: number | null;
  vehicle_approved: number | null;
  registration: string | null;
  private_hire_vehicle_licence_number: string | null;
  private_hire_vehicle_licence_expiry: string | null;
  mot_expiry: string | null;
  insurance_expiry: string | null;
  v5_document_status: string | null;
};

function validFutureDate(value: string | null, today: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today);
}

export function eligibilityReasons(row: DriverEligibilityRow, today = new Date().toISOString().slice(0, 10)) {
  const reasons: string[] = [];
  if (!row.staff_active) reasons.push('Portal membership is disabled');
  if (!row.identity_verified) reasons.push('First Google login is incomplete');
  if (!row.profile_id) return [...reasons, 'Driver profile is missing'];
  if (!row.profile_active) reasons.push('Driver profile is inactive');
  if (!row.full_name || !row.phone || !row.licensing_authority) reasons.push('Driver contact or licensing authority is incomplete');
  if (!row.private_hire_licence_number || !validFutureDate(row.private_hire_licence_expiry, today)) reasons.push('Private-hire Driver licence is missing or expired');
  if (!row.dvla_licence_number || !validFutureDate(row.dvla_licence_expiry, today)) reasons.push('DVLA licence is missing or expired');
  if (row.address_evidence_status !== 'VERIFIED') reasons.push('Address evidence is not verified');
  if (!row.vehicle_id || !row.vehicle_active) reasons.push('An active vehicle is not assigned');
  else {
    if (!row.registration) reasons.push('Vehicle registration is missing');
    if (!row.private_hire_vehicle_licence_number || !validFutureDate(row.private_hire_vehicle_licence_expiry, today)) reasons.push('Private-hire vehicle licence is missing or expired');
    if (!validFutureDate(row.mot_expiry, today)) reasons.push('MOT is missing or expired');
    if (!validFutureDate(row.insurance_expiry, today)) reasons.push('Insurance is missing or expired');
    if (row.v5_document_status !== 'VERIFIED') reasons.push('V5 document is not verified');
    if (!row.vehicle_approved) reasons.push('Vehicle is not approved');
  }
  if (!row.approved_for_assignment) reasons.push('Driver is not approved for assignment');
  return reasons;
}

export const driverEligibilitySelect = `
  SELECT s.id,s.email,s.role,s.active AS staff_active,
    CASE WHEN s.access_subject IS NULL THEN 0 ELSE 1 END AS identity_verified,
    p.id AS profile_id,p.active AS profile_active,p.approved_for_assignment,p.full_name,p.phone,p.licensing_authority,
    p.private_hire_licence_number,p.private_hire_licence_expiry,p.dvla_licence_number,p.dvla_licence_expiry,p.address_evidence_status,
    v.id AS vehicle_id,v.active AS vehicle_active,v.approved AS vehicle_approved,v.registration,v.make_model_colour,
    v.private_hire_vehicle_licence_number,v.private_hire_vehicle_licence_expiry,v.mot_expiry,v.insurance_expiry,v.v5_document_status
  FROM portal_staff s
  LEFT JOIN driver_profiles p ON p.staff_id=s.id AND p.organisation_id=s.organisation_id
  LEFT JOIN driver_vehicles v ON v.driver_profile_id=p.id AND v.organisation_id=s.organisation_id`;
