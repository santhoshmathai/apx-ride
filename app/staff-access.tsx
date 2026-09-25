'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, UserRoundPlus } from 'lucide-react';

type StaffMember = { id: string; email: string; role: 'OWNER_ADMIN' | 'DRIVER'; active: number; created_at: string; last_login_at: string | null; identity_verified: number };

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
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setStaff(await loadStaff());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load staff access'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function addDriver(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') || '').trim().toLowerCase();
    try {
      const response = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ email }) });
      const value = await response.json() as { error?: string };
      if (!response.ok) throw new Error(value.error || 'Could not add Driver');
      form.reset();
      setNotice(`${email} was added to the portal. Add the same exact email to the Cloudflare Access policy before the Driver signs in.`);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add Driver'); }
    finally { setSaving(false); }
  }

  async function setActive(member: StaffMember, active: boolean) {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/staff', { method: 'PATCH', headers: { 'content-type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ id: member.id, active }) });
      const value = await response.json() as { error?: string };
      if (!response.ok) throw new Error(value.error || 'Could not update Driver');
      setNotice(`${member.email} is now ${active ? 'active' : 'disabled'} in the portal.${active ? ' Confirm that their exact email is allowed in Cloudflare Access.' : ' Remove or revoke their Cloudflare Access permission as the second offboarding step.'}`);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update Driver'); }
    finally { setSaving(false); }
  }

  async function deleteUnusedDriver(member: StaffMember) {
    if (!confirm(`Permanently delete the unused Driver ${member.email}? This is allowed only because the Driver is disabled, has never logged in and has no assigned jobs.`)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/staff?id=${encodeURIComponent(member.id)}`, { method: 'DELETE', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const value = await response.json() as { error?: string };
      if (!response.ok) throw new Error(value.error || 'Could not delete Driver');
      setNotice(`${member.email} was permanently deleted. Remove the email from Cloudflare Access too if it was added there.`);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete Driver'); }
    finally { setSaving(false); }
  }

  const owners = staff.filter((member) => member.role === 'OWNER_ADMIN' && member.active).length;
  const activeDrivers = staff.filter((member) => member.role === 'DRIVER' && member.active).length;
  const inactiveDrivers = staff.filter((member) => member.role === 'DRIVER' && !member.active).length;
  return <section className="staff-access-page">
    <div className="register-head"><div><small>SECURITY & MEMBERSHIP</small><h2>Staff & Access</h2><p>Portal roles are enforced separately from Cloudflare login permission.</p></div></div>
    <div className="staff-stats"><article><span>Owner/Admin</span><strong>{owners}</strong></article><article><span>Active Drivers</span><strong>{activeDrivers}</strong></article><article><span>Inactive Drivers</span><strong>{inactiveDrivers}</strong></article></div>
    <div className="staff-grid">
      <article className="panel staff-add-card"><div className="head"><small>ONBOARDING</small><h3>Add Driver</h3></div><form onSubmit={addDriver}><label>Driver Google email<input name="email" type="email" maxLength={254} placeholder="driver@example.com" required /></label><button className="primary" disabled={saving}><UserRoundPlus />{saving ? 'Saving…' : 'Add Driver'}</button></form><ol className="staff-checklist"><li>Create the Driver membership here.</li><li>Add the exact email to the Cloudflare Access policy.</li><li>Driver completes their first Google login.</li><li>Verify licences, vehicle and insurance before assignment.</li></ol></article>
      <article className="panel staff-security-note"><CircleAlert /><div><h3>Two controls are required</h3><p>Cloudflare authenticates the named person. The portal membership decides whether they are an Owner/Admin or Driver. Adding an email in only one place never grants complete access.</p></div></article>
    </div>
    {error && <p className="staff-message error" role="alert">{error}</p>}{notice && <p className="staff-message success"><CheckCircle2 />{notice}</p>}
    <article className="panel staff-list-card"><div className="head"><small>AUTHORISED STAFF</small><h3>Portal memberships</h3></div>{loading ? <p>Loading staff…</p> : <div className="staff-list">{staff.map((member) => <div className="staff-row" key={member.id}><div><strong>{member.email}</strong><span>{member.role === 'OWNER_ADMIN' ? 'Owner/Admin' : 'Driver'} · Added {new Date(member.created_at).toLocaleDateString('en-GB')}</span><span>Last successful login: {member.last_login_at ? new Date(member.last_login_at).toLocaleString('en-GB') : 'Not recorded yet'}</span></div><div className="staff-badges"><span className={member.active ? 'active' : 'inactive'}>{member.active ? 'Active' : 'Disabled'}</span><span className={member.identity_verified ? 'verified' : 'pending'}>{member.identity_verified ? 'Identity verified' : 'Awaiting first login'}</span></div>{member.role === 'DRIVER' && <div className="staff-row-actions"><button disabled={saving} onClick={() => void setActive(member, !member.active)}>{member.active ? 'Disable' : 'Reactivate'}</button>{!member.active && !member.identity_verified && <button className="danger" disabled={saving} onClick={() => void deleteUnusedDriver(member)}>Delete</button>}</div>}</div>)}</div>}</article>
  </section>;
}
