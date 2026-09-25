'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, CircleAlert, UserRoundPlus, X } from 'lucide-react';

type StaffMember = { id: string; email: string; role: 'OWNER_ADMIN' | 'DRIVER'; active: number; created_at: string; last_login_at: string | null; identity_verified: number; has_driver_profile: number; approved_for_assignment: number };
type DriverProfile = Record<string, string | number | null> & { eligibility_reasons: string[] };

async function loadStaff(): Promise<StaffMember[]> {
  const response = await fetch('/api/staff', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  const value = await response.json() as StaffMember[] | { error?: string };
  if (!response.ok || !Array.isArray(value)) throw new Error(!Array.isArray(value) && value.error ? value.error : 'Could not load staff access');
  return value;
}

export function StaffAccessSummary({ open }: { open: () => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  useEffect(() => { void loadStaff().then(setStaff).catch(() => setStaff([])); }, []);
  const owners = staff.filter((member) => member.role === 'OWNER_ADMIN' && member.active).length;
  const activeDrivers = staff.filter((member) => member.role === 'DRIVER' && member.active).length;
  const inactiveDrivers = staff.filter((member) => member.role === 'DRIVER' && !member.active).length;
  return <button className="staff-summary panel" onClick={open}><div><small>STAFF ACCESS</small><strong>{owners} Owner/Admin</strong><span>{activeDrivers} active Driver{activeDrivers === 1 ? '' : 's'} · {inactiveDrivers} inactive</span></div><span className="staff-summary-link">Manage access →</span></button>;
}

export function StaffAccess() {
  const [staff, setStaff] = useState<StaffMember[]>([]); const [editing, setEditing] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setStaff(await loadStaff()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load staff access'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function addDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice(''); const form = event.currentTarget; const email = String(new FormData(form).get('email') || '').trim().toLowerCase();
    try { const response = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ email }) }); const value = await response.json() as { error?: string }; if (!response.ok) throw new Error(value.error || 'Could not add Driver'); form.reset(); setNotice(`${email} was created in the portal. Now manually add the exact email to the Cloudflare Access policy.`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add Driver'); } finally { setSaving(false); }
  }
  async function setActive(member: StaffMember, active: boolean) {
    setSaving(true); setError(''); setNotice('');
    try { const response = await fetch('/api/staff', { method: 'PATCH', headers: { 'content-type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ id: member.id, active }) }); const value = await response.json() as { error?: string }; if (!response.ok) throw new Error(value.error || 'Could not update Driver'); setNotice(`${member.email} is now ${active ? 'active' : 'disabled'} in the portal.${active ? ' Confirm the exact email remains allowed in Cloudflare Access.' : ' Remove or revoke Cloudflare Access permission as the second offboarding step.'}`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update Driver'); } finally { setSaving(false); }
  }
  async function deleteUnusedDriver(member: StaffMember) {
    if (!confirm(`Permanently delete the unused Driver ${member.email}? This is allowed only because the Driver is disabled, has never logged in and has no assigned jobs.`)) return;
    setSaving(true); setError(''); setNotice('');
    try { const response = await fetch(`/api/staff?id=${encodeURIComponent(member.id)}`, { method: 'DELETE', headers: { 'X-Requested-With': 'XMLHttpRequest' } }); const value = await response.json() as { error?: string }; if (!response.ok) throw new Error(value.error || 'Could not delete Driver'); setNotice(`${member.email} was permanently deleted. Remove the email from Cloudflare Access too if it was added there.`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete Driver'); } finally { setSaving(false); }
  }
  const owners = staff.filter((member) => member.role === 'OWNER_ADMIN' && member.active).length; const activeDrivers = staff.filter((member) => member.role === 'DRIVER' && member.active).length; const inactiveDrivers = staff.filter((member) => member.role === 'DRIVER' && !member.active).length;
  return <section className="staff-access-page">
    <div className="register-head"><div><small>SECURITY & MEMBERSHIP</small><h2>Staff & Access</h2><p>Portal roles, Cloudflare identity and assignment eligibility are separate controls.</p></div></div>
    <div className="staff-stats"><article><span>Owner/Admin</span><strong>{owners}</strong></article><article><span>Active Drivers</span><strong>{activeDrivers}</strong></article><article><span>Inactive Drivers</span><strong>{inactiveDrivers}</strong></article></div>
    <div className="staff-grid"><article className="panel staff-add-card"><div className="head"><small>TWO-PART ONBOARDING</small><h3>Add Driver</h3></div><form onSubmit={addDriver}><label>Driver Google email<input name="email" type="email" maxLength={254} placeholder="driver@example.com" required /></label><button className="primary" disabled={saving}><UserRoundPlus />{saving ? 'Saving…' : 'Add Driver'}</button></form><ol className="staff-checklist"><li>Portal Driver record is created here.</li><li>Add the exact email manually to the Cloudflare Access policy.</li><li>Driver completes their first Google login.</li><li>Complete and verify Driver and vehicle compliance.</li><li>Approve the Driver for assignment.</li></ol></article><article className="panel staff-security-note"><CircleAlert /><div><h3>Two controls are required</h3><p>Cloudflare authenticates the named person. The portal assigns their role. An email in Cloudflare alone receives no portal role; a portal record alone cannot pass Cloudflare.</p><p>Owner/Admin can have a separate Driver profile while retaining all Admin permissions.</p></div></article></div>
    {error && <p className="staff-message error" role="alert">{error}</p>}{notice && <p className="staff-message success"><CheckCircle2 />{notice}</p>}
    <article className="panel staff-list-card"><div className="head"><small>AUTHORISED STAFF</small><h3>Portal memberships</h3></div>{loading ? <p>Loading staff…</p> : <div className="staff-list">{staff.map((member) => <div className="staff-row" key={member.id}><div><strong>{member.email}</strong><span>{member.role === 'OWNER_ADMIN' ? 'Owner/Admin' : 'Driver'} · Added {new Date(member.created_at).toLocaleDateString('en-GB')}</span><span>Last successful login: {member.last_login_at ? new Date(member.last_login_at).toLocaleString('en-GB') : 'Not recorded yet'}</span></div><div className="staff-badges"><span className={member.active ? 'active' : 'inactive'}>{member.active ? 'Active' : 'Disabled'}</span><span className={member.identity_verified ? 'verified' : 'pending'}>{member.identity_verified ? 'Identity verified' : 'Awaiting first login'}</span>{member.has_driver_profile ? <span className={member.approved_for_assignment ? 'verified' : 'pending'}>{member.approved_for_assignment ? 'Assignment approved' : 'Compliance pending'}</span> : <span className="pending">No Driver profile</span>}</div><div className="staff-row-actions"><button disabled={saving} onClick={() => setEditing(member)}>{member.has_driver_profile ? 'Driver compliance' : 'Set up as Driver'}</button>{member.role === 'DRIVER' && <button disabled={saving} onClick={() => void setActive(member, !member.active)}>{member.active ? 'Disable' : 'Reactivate'}</button>}{member.role === 'DRIVER' && !member.active && !member.identity_verified && <button className="danger" disabled={saving} onClick={() => void deleteUnusedDriver(member)}>Delete</button>}</div></div>)}</div>}</article>
    {editing && <DriverProfileEditor member={editing} close={() => setEditing(null)} saved={async () => { setEditing(null); setNotice('Driver and vehicle compliance profile saved.'); await refresh(); }} />}
  </section>;
}

function DriverProfileEditor({ member, close, saved }: { member: StaffMember; close: () => void; saved: () => Promise<void> }) {
  const [profile, setProfile] = useState<DriverProfile | null>(null); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { void fetch(`/api/driver-profiles?staffId=${encodeURIComponent(member.id)}`).then(async (response) => { const value = await response.json() as DriverProfile & { error?: string }; if (!response.ok) throw new Error(value.error || 'Could not load Driver profile'); setProfile(value); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load Driver profile')); }, [member.id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); const data = new FormData(event.currentTarget); const payload = Object.fromEntries(data.entries()) as Record<string, unknown>; payload.staffId = member.id;
    for (const name of ['profileActive', 'vehicleActive', 'vehicleApproved', 'approvedForAssignment']) payload[name] = data.get(name) === 'on';
    const response = await fetch('/api/driver-profiles', { method: 'PUT', headers: { 'content-type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(payload) }); const result = await response.json() as { error?: string }; setSaving(false); if (!response.ok) { setError(result.error || 'Could not save Driver profile'); return; } await saved();
  }
  const value = (key: string) => String(profile?.[key] || '');
  return <div className="modal"><button className="scrim" aria-label="Close Driver profile" onClick={close} /><form className="record-modal driver-profile-modal" onSubmit={submit}><header><div><small>DRIVER ELIGIBILITY</small><h2>{member.role === 'OWNER_ADMIN' ? 'Owner/Admin Driver profile' : 'Driver compliance profile'}</h2><p>{member.email}</p></div><button type="button" onClick={close} aria-label="Close"><X /></button></header>
    <div className="onboarding-status"><CheckItem done label="Portal Driver record created" /><CheckItem done={Boolean(member.identity_verified)} label="Exact email added to Cloudflare Access policy" /><CheckItem done={Boolean(member.identity_verified)} label="Driver completed first Google login" /><CheckItem done={Boolean(profile && !profile.eligibility_reasons.some((reason) => reason.includes('missing') || reason.includes('expired') || reason.includes('verified')))} label="Licence and compliance records valid" /><CheckItem done={Boolean(profile?.approved_for_assignment)} label="Approved for assignment" /></div>
    {profile?.eligibility_reasons?.length ? <div className="eligibility-block"><b>Assignment blocked</b><ul>{profile.eligibility_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div> : <p className="staff-message success"><CheckCircle2 />Eligible for new assignments</p>}{error && <p className="staff-message error">{error}</p>}
    <h3>Driver details</h3><div className="record-form-grid"><Field name="fullName" label="Full name" value={value('full_name')} required /><Field name="phone" label="Phone number" value={value('phone')} required /><Field name="licensingAuthority" label="Licensing authority" value={value('licensing_authority')} required /><Field name="privateHireLicenceNumber" label="Private-hire Driver licence number" value={value('private_hire_licence_number')} required /><Field name="privateHireLicenceExpiry" label="Private-hire Driver licence expiry" value={value('private_hire_licence_expiry')} type="date" required /><Field name="dvlaLicenceNumber" label="DVLA licence number" value={value('dvla_licence_number')} required /><Field name="dvlaLicenceExpiry" label="DVLA licence expiry/status valid until" value={value('dvla_licence_expiry')} type="date" required /><SelectStatus name="addressEvidenceStatus" label="Address evidence" value={value('address_evidence_status')} /><Check name="profileActive" label="Driver profile active" checked={profile ? Boolean(profile.profile_active) : true} /></div>
    <h3>Assigned vehicle</h3><div className="record-form-grid"><Field name="registration" label="Vehicle registration" value={value('registration')} required /><Field name="makeModelColour" label="Make, model and colour" value={value('make_model_colour')} /><Field name="privateHireVehicleLicenceNumber" label="Private-hire vehicle licence number" value={value('private_hire_vehicle_licence_number')} required /><Field name="privateHireVehicleLicenceExpiry" label="Private-hire vehicle licence expiry" value={value('private_hire_vehicle_licence_expiry')} type="date" required /><Field name="motExpiry" label="MOT expiry" value={value('mot_expiry')} type="date" required /><Field name="insuranceExpiry" label="Insurance expiry" value={value('insurance_expiry')} type="date" required /><SelectStatus name="v5DocumentStatus" label="V5 document" value={value('v5_document_status')} /><Check name="vehicleActive" label="Vehicle active" checked={profile ? Boolean(profile.vehicle_active) : true} /><Check name="vehicleApproved" label="Vehicle approved" checked={Boolean(profile?.vehicle_approved)} /></div>
    <p className="private-document-note">Compliance documents remain in the private R2 bucket and are served only through authenticated portal endpoints. No public R2 URL is created.</p><div className="approval-control"><Check name="approvedForAssignment" label="Approve Driver for assignment" checked={Boolean(profile?.approved_for_assignment)} /><small>Approval is rejected if any mandatory identity, Driver or vehicle requirement is missing or expired.</small></div>
    <footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save compliance profile'}</button></footer></form></div>;
}

function Field({ name, label, value, type = 'text', required = false }: { name: string; label: string; value: string; type?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} defaultValue={value} required={required} /></label>; }
function SelectStatus({ name, label, value }: { name: string; label: string; value: string }) { return <label>{label}<select name={name} defaultValue={value || 'MISSING'}><option value="MISSING">Missing / not verified</option><option value="VERIFIED">Verified</option></select></label>; }
function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="check-label"><input name={name} type="checkbox" defaultChecked={checked} />{label}</label>; }
function CheckItem({ done, label }: { done: boolean; label: string }) { return <div className={done ? 'done' : ''}>{done ? <CheckCircle2 /> : <Circle />}<span>{label}</span></div>; }
