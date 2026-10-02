'use client';

import { FormEvent, Fragment, useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Trash2,
  Upload,
  UserRoundPlus,
  X,
} from 'lucide-react';

export type StaffMember = {
  id: string;
  email: string;
  role: 'OWNER_ADMIN' | 'DRIVER';
  active: number;
  created_at: string;
  last_login_at: string | null;
  identity_verified: number;
  has_driver_profile: number;
  approved_for_assignment: number;
  profile_id?: string;
  full_name?: string;
};
type DriverProfile = Record<string, string | number | null> & {
  eligibility_reasons: string[];
};
type CouncilStaffRow = Record<string, string | number> & {
  id: number;
  full_name: string;
  email: string;
  role_title: string;
  status: string;
  suitability_decision: string;
};

async function loadStaff(): Promise<StaffMember[]> {
  const response = await fetch('/api/staff', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  const value = (await response.json()) as StaffMember[] | { error?: string };
  if (!response.ok || !Array.isArray(value))
    throw new Error(
      !Array.isArray(value) && value.error
        ? value.error
        : 'Could not load staff access',
    );
  return value;
}

export function StaffAccessSummary({ open }: { open: () => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  useEffect(() => {
    void loadStaff()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);
  const owners = staff.filter(
    (member) => member.role === 'OWNER_ADMIN' && member.active,
  ).length;
  const activeDrivers = staff.filter(
    (member) => member.role === 'DRIVER' && member.active,
  ).length;
  const inactiveDrivers = staff.filter(
    (member) => member.role === 'DRIVER' && !member.active,
  ).length;
  return (
    <button className="staff-summary panel" onClick={open}>
      <div>
        <small>STAFF ACCESS</small>
        <strong>{owners} Owner/Admin</strong>
        <span>
          {activeDrivers} active Driver{activeDrivers === 1 ? '' : 's'} ·{' '}
          {inactiveDrivers} inactive
        </span>
      </div>
      <span className="staff-summary-link">Manage access →</span>
    </button>
  );
}

export function StaffAccess({
  embedded = false,
  showCouncilStaff = true,
  showDriverOnboarding = true,
}: {
  embedded?: boolean;
  showCouncilStaff?: boolean;
  showDriverOnboarding?: boolean;
} = {}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStaff(await loadStaff());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load staff access',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') || '')
      .trim()
      .toLowerCase();
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email }),
      });
      const value = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(value.error || 'Could not add Driver');
      form.reset();
      setNotice(
        `${email} was created in the portal. Now manually add the exact email to the Cloudflare Access policy.`,
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not add Driver',
      );
    } finally {
      setSaving(false);
    }
  }
  async function setActive(member: StaffMember, active: boolean) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/staff', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ id: member.id, active }),
      });
      const value = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(value.error || 'Could not update Driver');
      setNotice(
        `${member.email} is now ${active ? 'active' : 'disabled'} in the portal.${active ? ' Confirm the exact email remains allowed in Cloudflare Access.' : ' Remove or revoke Cloudflare Access permission as the second offboarding step.'}`,
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not update Driver',
      );
    } finally {
      setSaving(false);
    }
  }
  async function deleteUnusedDriver(member: StaffMember) {
    if (
      !confirm(
        `Permanently delete the unused Driver ${member.email}? This is allowed only because the Driver is disabled, has never logged in and has no assigned jobs.`,
      )
    )
      return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        `/api/staff?id=${encodeURIComponent(member.id)}`,
        { method: 'DELETE', headers: { 'X-Requested-With': 'XMLHttpRequest' } },
      );
      const value = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(value.error || 'Could not delete Driver');
      setNotice(
        `${member.email} was permanently deleted. Remove the email from Cloudflare Access too if it was added there.`,
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not delete Driver',
      );
    } finally {
      setSaving(false);
    }
  }
  const owners = staff.filter(
    (member) => member.role === 'OWNER_ADMIN' && member.active,
  ).length;
  const activeDrivers = staff.filter(
    (member) => member.role === 'DRIVER' && member.active,
  ).length;
  const inactiveDrivers = staff.filter(
    (member) => member.role === 'DRIVER' && !member.active,
  ).length;
  return (
    <section className={`staff-access-page ${embedded ? 'embedded' : ''}`}>
      <div className="register-head">
        <div>
          <small>SECURITY & MEMBERSHIP</small>
          <h2>{embedded ? 'Portal users' : 'Staff & Access'}</h2>
          <p>
            This register controls sign-in identity and portal permissions.
            Compliance records remain separate.
          </p>
        </div>
      </div>
      <div className="staff-stats">
        <article>
          <span>Owner/Admin</span>
          <strong>{owners}</strong>
        </article>
        <article>
          <span>Active Drivers</span>
          <strong>{activeDrivers}</strong>
        </article>
        <article>
          <span>Inactive Drivers</span>
          <strong>{inactiveDrivers}</strong>
        </article>
      </div>
      {showCouncilStaff && <CouncilStaffRegister />}
      {showDriverOnboarding && (
        <div className="staff-grid">
          <article className="panel staff-add-card">
            <div className="head">
              <small>TWO-PART ONBOARDING</small>
              <h3>Add Driver</h3>
            </div>
            <form onSubmit={addDriver}>
              <label>
                Driver Google email
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  placeholder="driver@example.com"
                  required
                />
              </label>
              <button className="primary" disabled={saving}>
                <UserRoundPlus />
                {saving ? 'Saving…' : 'Add Driver'}
              </button>
            </form>
            <ol className="staff-checklist">
              <li>Portal Driver record is created here.</li>
              <li>
                Add the exact email manually to the Cloudflare Access policy.
              </li>
              <li>Driver completes their first Google login.</li>
              <li>Complete and verify Driver and vehicle compliance.</li>
              <li>Approve the Driver for assignment.</li>
            </ol>
          </article>
          <article className="panel staff-security-note">
            <CircleAlert />
            <div>
              <h3>Two controls are required</h3>
              <p>
                Cloudflare authenticates the named person. The portal assigns
                their role. An email in Cloudflare alone receives no portal
                role; a portal record alone cannot pass Cloudflare.
              </p>
              <p>
                Owner/Admin can have a separate Driver profile while retaining
                all Admin permissions.
              </p>
            </div>
          </article>
        </div>
      )}
      {error && (
        <p className="staff-message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="staff-message success">
          <CheckCircle2 />
          {notice}
        </p>
      )}
      <article className="panel staff-list-card">
        <div className="head">
          <small>AUTHORISED STAFF</small>
          <h3>Portal access memberships</h3>
        </div>
        {loading ? (
          <p>Loading staff…</p>
        ) : (
          <div className="staff-list">
            {[...staff].sort((a,b)=>a.role.localeCompare(b.role)).map((member,index,list) => (
              <Fragment key={member.id}>
              {(index===0||list[index-1].role!==member.role)&&<h4 className="staff-category-title">{member.role==='OWNER_ADMIN'?'Staff access':'Driver access'}</h4>}
              <div className="staff-row">
                <div>
                  <strong>{member.email}</strong>
                  <span>
                    {member.role === 'OWNER_ADMIN' ? 'Owner/Admin' : 'Driver'} ·
                    Added{' '}
                    {new Date(member.created_at).toLocaleDateString('en-GB')}
                  </span>
                  <span>
                    Last successful login:{' '}
                    {member.last_login_at
                      ? new Date(member.last_login_at).toLocaleString('en-GB')
                      : 'Not recorded yet'}
                  </span>
                </div>
                <div className="staff-badges">
                  <span className={member.active ? 'active' : 'inactive'}>
                    {member.active ? 'Active' : 'Disabled'}
                  </span>
                  <span
                    className={
                      member.identity_verified ? 'verified' : 'pending'
                    }
                  >
                    {member.identity_verified
                      ? 'Identity verified'
                      : 'Awaiting first login'}
                  </span>
                  {member.has_driver_profile ? (
                    <span
                      className={
                        member.approved_for_assignment ? 'verified' : 'pending'
                      }
                    >
                      {member.approved_for_assignment
                        ? 'Driver record approved'
                        : 'Driver record pending'}
                    </span>
                  ) : null}
                </div>
                <div className="staff-row-actions">
                  {member.has_driver_profile && (
                    <button
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('apx:navigate', {
                            detail: 'Operations',
                          }),
                        )
                      }
                    >
                      Open Operations
                    </button>
                  )}
                  {member.role === 'DRIVER' && (
                    <button
                      disabled={saving}
                      onClick={() => void setActive(member, !member.active)}
                    >
                      {member.active ? 'Disable' : 'Reactivate'}
                    </button>
                  )}
                  {member.role === 'DRIVER' &&
                    !member.active &&
                    !member.identity_verified && (
                      <button
                        className="danger"
                        disabled={saving}
                        onClick={() => void deleteUnusedDriver(member)}
                      >
                        Delete
                      </button>
                    )}
                </div>
              </div></Fragment>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

export function DriverProfileEditor({
  member,
  close,
  saved,
}: {
  member: StaffMember;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch(`/api/driver-profiles?staffId=${encodeURIComponent(member.id)}`)
      .then(async (response) => {
        const value = (await response.json()) as DriverProfile & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(value.error || 'Could not load Driver profile');
        setProfile(value);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not load Driver profile',
        ),
      );
  }, [member.id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries()) as Record<
      string,
      unknown
    >;
    payload.staffId = member.id;
    for (const name of [
      'profileActive',
      'approvedForAssignment',
      'medicalExemption',
    ])
      payload[name] = data.get(name) === 'on';
    const response = await fetch('/api/driver-profiles', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      error?: string;
      warning?: string;
    };
    setSaving(false);
    if (!response.ok) {
      setError(result.error || 'Could not save Driver profile');
      return;
    }
    if (result.warning) alert(result.warning);
    await saved();
  }
  const value = (key: string) => String(profile?.[key] || '');
  return (
    <div className="modal">
      <button
        className="scrim"
        aria-label="Close Driver profile"
        onClick={close}
      />
      <form className="record-modal driver-profile-modal" onSubmit={submit}>
        <header>
          <div>
            <small>DRIVER ELIGIBILITY</small>
            <h2>
              {member.role === 'OWNER_ADMIN'
                ? 'Owner/Admin Driver profile'
                : 'Driver compliance profile'}
            </h2>
            <p>{member.email}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close">
            <X />
          </button>
        </header>
        <div className="onboarding-status">
          <CheckItem done label="Portal Driver record created" />
          <CheckItem
            done={Boolean(member.identity_verified)}
            label="Exact email added to Cloudflare Access policy"
          />
          <CheckItem
            done={Boolean(member.identity_verified)}
            label="Driver completed first Google login"
          />
          <CheckItem
            done={Boolean(
              profile &&
              !profile.eligibility_reasons.some(
                (reason) =>
                  reason.includes('missing') ||
                  reason.includes('expired') ||
                  reason.includes('verified'),
              ),
            )}
            label="Licence and compliance records valid"
          />
          <CheckItem
            done={Boolean(profile?.approved_for_assignment)}
            label="Approved for assignment"
          />
        </div>
        {profile?.eligibility_reasons?.length ? (
          <div className="eligibility-block">
            <b>Assignment blocked</b>
            <ul>
              {profile.eligibility_reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="staff-message success">
            <CheckCircle2 />
            Eligible for new assignments
          </p>
        )}
        {error && <p className="staff-message error">{error}</p>}
        <h3>Standard Driver profile</h3>
        <div className="record-form-grid">
          <Field
            name="firstName"
            label="First name"
            value={value('first_name')}
            required
          />
          <Field
            name="surname"
            label="Surname"
            value={value('surname')}
            required
          />
          <Field name="phone" label="Phone" value={value('phone')} required />
          <Field
            name="address"
            label="Address"
            value={value('address')}
            required
          />
          <Field
            name="emergencyContact"
            label="Emergency contact"
            value={value('emergency_contact')}
            required
          />
          <Field
            name="licensingAuthority"
            label="Licensing authority"
            value={value('licensing_authority')}
            required
          />
          <Field
            name="privateHireLicenceNumber"
            label="PHD Licence Number"
            value={value('private_hire_licence_number')}
            required
          />
          <Field
            name="phdBadgeNumber"
            label="PHD Badge Number"
            value={value('phd_badge_number')}
            required
          />
          <Field
            name="privateHireLicenceExpiry"
            label="PHD licence expiry"
            value={value('private_hire_licence_expiry')}
            type="date"
            required
          />
          <Field
            name="dvlaLicenceNumber"
            label="DVLA licence number"
            value={value('dvla_licence_number')}
            required
          />
          <Field
            name="dvlaLicenceExpiry"
            label="DVLA valid until"
            value={value('dvla_licence_expiry')}
            type="date"
            required
          />
          <SelectStatus
            name="addressEvidenceStatus"
            label="Address evidence"
            value={value('address_evidence_status')}
          />
          <SelectStatus
            name="dbsStatus"
            label="DBS certificate"
            value={value('dbs_status')}
          />
          <SelectStatus
            name="rightToWorkStatus"
            label="Right to Work"
            value={value('right_to_work_status')}
          />
          <label>
            Visa / E-Visa
            <select
              name="visaStatus"
              defaultValue={value('visa_status') || 'NOT_REQUIRED'}
            >
              <option value="NOT_REQUIRED">Not required</option>
              <option value="VERIFIED">Verified</option>
              <option value="MISSING">Missing / pending</option>
            </select>
          </label>
          <Check
            name="medicalExemption"
            label="Council medical exemption certificate held"
            checked={Boolean(profile?.medical_exemption)}
          />
          <Check
            name="profileActive"
            label="Profile activation"
            checked={profile ? Boolean(profile.profile_active) : true}
          />
        </div>
        <h3>Portal access credentials</h3>
        <div className="record-form-grid">
          <Field
            name="portalEmail"
            label="Google / Cloudflare email"
            value={member.email}
            type="email"
          />
          <label>
            Identity status
            <input
              value={
                member.identity_verified ? 'Verified' : 'Awaiting first login'
              }
              readOnly
            />
          </label>
          <label>
            Portal role
            <input
              value={member.role === 'OWNER_ADMIN' ? 'Owner/Admin' : 'Driver'}
              readOnly
            />
          </label>
        </div>
        <h3>Vehicle allocation</h3>
        <p className="private-document-note">
          Vehicles are maintained independently under Fleet → Vehicles. Use
          Driver–Vehicle Assignments to allocate an approved vehicle and retain
          the complete allocation history.
        </p>
        {profile?.profile_id && (
          <ProfileDocuments
            entityType="DRIVER"
            entityId={String(profile.profile_id)}
            label="Driver documents"
          />
        )}
        <p className="private-document-note">
          Compliance documents remain in the private R2 bucket and are served
          only through authenticated portal endpoints. No public R2 URL is
          created.
        </p>
        <div className="approval-control">
          <Check
            name="approvedForAssignment"
            label="Approve Driver for assignment"
            checked={Boolean(profile?.approved_for_assignment)}
          />
          <small>
            Approval is rejected if any mandatory identity, Driver or vehicle
            requirement is missing or expired.
          </small>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save compliance profile'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} required={required} />
    </label>
  );
}
function SelectStatus({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value || 'MISSING'}>
        <option value="MISSING">Missing / not verified</option>
        <option value="VERIFIED">Verified</option>
      </select>
    </label>
  );
}
function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="check-label">
      <input name={name} type="checkbox" defaultChecked={checked} />
      {label}
    </label>
  );
}
function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={done ? 'done' : ''}>
      {done ? <CheckCircle2 /> : <Circle />}
      <span>{label}</span>
    </div>
  );
}

export function ProfileDocuments({
  entityType,
  entityId,
  label,
}: {
  entityType: 'DRIVER' | 'VEHICLE' | 'STAFF';
  entityId: string;
  label: string;
}) {
  const [items, setItems] = useState<
    Array<{
      id: number;
      file_name: string;
      field_name: string;
      uploaded_at: string;
    }>
  >([]);
  const [file, setFile] = useState<File | null>(null);
  const [field, setField] = useState('');
  const refresh = useCallback(
    () =>
      fetch(
        `/api/profile-documents?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
      )
        .then((r) => r.json())
        .then((v) => setItems(Array.isArray(v) ? v : [])),
    [entityType, entityId],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function upload() {
    if (!file || !field.trim()) return;
    const form = new FormData();
    form.set('file', file);
    form.set('fieldName', field);
    form.set('entityType', entityType);
    form.set('entityId', entityId);
    const response = await fetch('/api/profile-documents', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      const value = (await response.json()) as { error?: string };
      alert(value.error || 'Upload failed');
      return;
    }
    setFile(null);
    setField('');
    await refresh();
  }
  async function remove(id: number) {
    if (
      !confirm(
        'Delete this compliance document? This removes the private stored file and cannot be undone.',
      )
    )
      return;
    const response = await fetch(`/api/profile-documents?id=${id}`, {
      method: 'DELETE',
    });
    if (response.ok) await refresh();
  }
  return (
    <section className="record-documents">
      <h4>{label.toUpperCase()}</h4>
      <div className="add-row">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <input
          value={field}
          onChange={(event) => setField(event.target.value)}
          placeholder="Document type (for example DBS or PHV licence)"
        />
        <button
          type="button"
          onClick={() => void upload()}
          disabled={!file || !field.trim()}
        >
          <Upload />
          Upload
        </button>
      </div>
      <div>
        {items.map((item) => (
          <article key={item.id}>
            <span>
              <a
                href={`/api/profile-documents?id=${item.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <b>{item.file_name}</b>
              </a>
              <small>
                {item.field_name} ·{' '}
                {new Date(item.uploaded_at).toLocaleDateString('en-GB')}
              </small>
            </span>
            <button
              type="button"
              className="danger"
              onClick={() => void remove(item.id)}
              title="Delete document"
            >
              <Trash2 />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CouncilStaffRegister() {
  const [rows, setRows] = useState<CouncilStaffRow[]>([]);
  const [editing, setEditing] = useState<CouncilStaffRow | null | undefined>();
  const refresh = useCallback(
    () =>
      fetch('/api/council-staff')
        .then((response) => response.json())
        .then((value) => setRows(Array.isArray(value) ? value : [])),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <article className="panel staff-list-card">
      <div className="head">
        <small>COUNCIL STAFF REGISTER</small>
        <h3>Booking and dispatch staff</h3>
        <p>
          Operational staff suitability record. DBS certificates are sighted but
          never uploaded or retained.
        </p>
      </div>
      <div className="page-actions">
        <a className="button" href="/api/council-staff?format=csv">
          Export CSV
        </a>
        <button className="primary" onClick={() => setEditing(null)}>
          <UserRoundPlus />
          Add staff member
        </button>
      </div>
      <div className="staff-list">
        {rows.map((row) => (
          <div className="staff-row" key={row.id}>
            <div>
              <strong>{row.full_name}</strong>
              <span>
                {row.role_title} · {row.email || 'No portal email required'}
              </span>
              <span>
                {Number(row.takes_bookings) ? 'Takes bookings' : ''}
                {Number(row.takes_bookings) && Number(row.dispatches_vehicles)
                  ? ' · '
                  : ''}
                {Number(row.dispatches_vehicles) ? 'Dispatches vehicles' : ''}
              </span>
            </div>
            <div className="staff-badges">
              <span className={row.status === 'ACTIVE' ? 'active' : 'inactive'}>
                {row.status}
              </span>
              <span
                className={
                  row.suitability_decision === 'APPROVED'
                    ? 'verified'
                    : 'pending'
                }
              >
                {row.suitability_decision}
              </span>
              <span
                className={Number(row.dbs_sighted) ? 'verified' : 'pending'}
              >
                {Number(row.dbs_sighted) ? 'DBS sighted' : 'DBS pending'}
              </span>
            </div>
            <button onClick={() => setEditing(row)}>View / edit</button>
          </div>
        ))}
      </div>
      {!rows.length && (
        <p className="empty-register">
          No booking or dispatch staff records have been entered.
        </p>
      )}
      {editing !== undefined && (
        <CouncilStaffModal
          row={editing}
          close={() => setEditing(undefined)}
          saved={() => {
            setEditing(undefined);
            void refresh();
          }}
        />
      )}
    </article>
  );
}

function CouncilStaffModal({
  row,
  close,
  saved,
}: {
  row: CouncilStaffRow | null;
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState('');
  const value = (key: string) => String(row?.[key] ?? '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries()) as Record<
      string,
      unknown
    >;
    payload.id = row?.id;
    payload.takesBookings = data.get('takesBookings') === 'on';
    payload.dispatchesVehicles = data.get('dispatchesVehicles') === 'on';
    payload.dbsSighted = data.get('dbsSighted') === 'on';
    const response = await fetch('/api/council-staff', {
      method: row ? 'PUT' : 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || 'Could not save staff record');
      return;
    }
    saved();
  }
  async function removeStaff() {
    if (
      !row ||
      !confirm(
        `Delete the retained staff entry for ${row.full_name}? The server will allow this only after the required retention period.`,
      )
    )
      return;
    const response = await fetch(`/api/council-staff?id=${row.id}`, {
      method: 'DELETE',
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || 'Could not delete staff entry');
      return;
    }
    saved();
  }
  return (
    <div className="modal">
      <button className="scrim" onClick={close} />
      <form className="record-modal" onSubmit={submit}>
        <header>
          <div>
            <small>COUNCIL STAFF REGISTER</small>
            <h2>{row ? 'Update' : 'Add'} staff member</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        {error && <p className="staff-message error">{error}</p>}
        <div className="record-form-grid">
          <Field
            name="fullName"
            label="Full name"
            value={value('full_name')}
            required
          />
          <Field
            name="email"
            label="Email address"
            value={value('email')}
            type="email"
          />
          <Field name="phone" label="Contact number" value={value('phone')} />
          <Field
            name="roleTitle"
            label="Role / job title"
            value={value('role_title') || 'Booking/dispatch staff'}
            required
          />
          <Check
            name="takesBookings"
            label="Takes bookings"
            checked={Boolean(row && Number(row.takes_bookings))}
          />
          <Check
            name="dispatchesVehicles"
            label="Dispatches vehicles"
            checked={Boolean(row && Number(row.dispatches_vehicles))}
          />
          <Field
            name="startDate"
            label="Start date"
            value={value('start_date')}
            type="date"
            required
          />
          <Field
            name="endDate"
            label="End date"
            value={value('end_date')}
            type="date"
          />
          <Check
            name="dbsSighted"
            label="Basic DBS certificate sighted"
            checked={Boolean(row && Number(row.dbs_sighted))}
          />
          <Field
            name="dbsSightedDate"
            label="DBS sighted date"
            value={value('dbs_sighted_date')}
            type="date"
          />
          <Field
            name="dbsCertificateDate"
            label="Date shown on DBS certificate"
            value={value('dbs_certificate_date')}
            type="date"
          />
          <Field
            name="dbsSightedBy"
            label="DBS sighted by"
            value={value('dbs_sighted_by')}
          />
          <label>
            Suitability decision
            <select
              name="suitabilityDecision"
              defaultValue={value('suitability_decision') || 'PENDING'}
            >
              <option>PENDING</option>
              <option>APPROVED</option>
              <option>REJECTED</option>
            </select>
          </label>
          <Field
            name="suitabilityDecisionDate"
            label="Decision date"
            value={value('suitability_decision_date')}
            type="date"
          />
          <Field
            name="convictionDeclarationDate"
            label="Conviction declaration date"
            value={value('conviction_declaration_date')}
            type="date"
          />
          <label>
            Status
            <select name="status" defaultValue={value('status') || 'ACTIVE'}>
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          <label className="wide">
            Training / suitability notes
            <textarea
              name="trainingNotes"
              defaultValue={value('training_notes')}
              rows={4}
            />
          </label>
        </div>
        <p className="private-document-note">
          Record only that the original DBS certificate was seen, when it was
          seen and by whom. Do not upload, scan or retain the certificate here.
        </p>
        {row && (
          <ProfileDocuments
            entityType="STAFF"
            entityId={String(row.id)}
            label="Staff documents"
          />
        )}
        <footer>
          {row && (
            <button
              type="button"
              className="danger"
              onClick={() => void removeStaff()}
            >
              <Trash2 />
              Delete staff entry
            </button>
          )}
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save staff record</button>
        </footer>
      </form>
    </div>
  );
}
