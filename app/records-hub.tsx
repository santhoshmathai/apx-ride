'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, FileDown, Plus, Save, X } from 'lucide-react';
import { CouncilStaffRegister, DriverProfileEditor, StaffAccess, type StaffMember } from './staff-access';
import { FleetOverview } from './vehicle-register';

type RecordRow = {
  id: number;
  record_type: string;
  reference: string;
  event_date: string;
  status: string;
  data_json: string;
  retention_until: string;
  created_at: string;
  updated_at: string;
};

type Field = { name: string; label: string; type?: string; required?: boolean; options?: string[]; multiple?: boolean };
type DocumentMeta = { id: number; field_name: string; file_name: string; content_type: string; uploaded_at: string };
const schemas: Record<string, { label: string; singular: string; fields: Field[]; statuses: string[] }> = {
  roster: {
    label: 'Driver & Vehicle Roster', singular: 'Driver & Vehicle', statuses: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    fields: [
      { name: 'callSign', label: 'Call sign / Driver ID', required: true },
      { name: 'fullName', label: 'Full name', required: true },
      { name: 'phone', label: 'Phone number', type: 'tel', required: true },
      { name: 'badgeNumber', label: 'PHV badge / licence number', required: true },
      { name: 'badgeExpiry', label: 'PHV licence expiry', type: 'date', required: true },
      { name: 'dvlaNumber', label: 'DVLA licence number' },
      { name: 'dbsDate', label: 'DBS check date', type: 'date' },
      { name: 'address', label: 'Current address', required: true },
      { name: 'engagementDate', label: 'Engagement start date', type: 'date' },
      { name: 'licenceDocument', label: 'Existing driver document reference / secure link (optional)' },
      { name: 'driverDocuments', label: 'Driver documents (DVLA licence, PHV driver licence, address proof)', type: 'file', multiple: true },
      { name: 'vrm', label: 'Vehicle registration', required: true },
      { name: 'makeModelColour', label: 'Make, model and colour', required: true },
      { name: 'fleetTier', label: 'Fleet tier', required: true },
      { name: 'plateNumber', label: 'Council plate number', required: true },
      { name: 'registeredKeeper', label: 'Registered keeper details', required: true },
      { name: 'availableFrom', label: 'Available from', type: 'date' },
      { name: 'availableUntil', label: 'Ceased availability', type: 'date' },
      { name: 'motExpiry', label: 'MOT expiry', type: 'date', required: true },
      { name: 'insuranceExpiry', label: 'Insurance expiry', type: 'date', required: true },
      { name: 'phvExpiry', label: 'Private hire vehicle licence expiry', type: 'date', required: true },
      { name: 'documents', label: 'Existing vehicle document references (optional)' },
      { name: 'vehicleDocuments', label: 'Vehicle documents (MOT, insurance, council PHV licence, V5 logbook)', type: 'file', multiple: true },
    ],
  },
  lost_property: {
    label: 'Lost Property', singular: 'Lost property item', statuses: ['IN STORAGE', 'RETURNED TO OWNER', 'HANDED TO POLICE'],
    fields: [
      { name: 'timeFound', label: 'Time found', type: 'time', required: true },
      { name: 'bookingRef', label: 'Journey / booking reference', required: true },
      { name: 'item', label: 'Detailed item description', required: true },
      { name: 'driver', label: 'Driver name', required: true },
      { name: 'vrm', label: 'Vehicle registration', required: true },
      { name: 'passengerContact', label: 'Passenger contact' },
      { name: 'returnAttempt', label: 'Details of attempt to return property', required: true },
      { name: 'returnEvidence', label: 'Evidence of attempt to return property', type: 'file' },
      { name: 'resolutionDate', label: 'Resolution date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  complaint: {
    label: 'Complaints', singular: 'Complaint', statuses: ['PENDING', 'IN PROGRESS', 'RESOLVED'],
    fields: [
      { name: 'complainant', label: 'Complainant full name', required: true },
      { name: 'contact', label: 'Complainant contact', required: true },
      { name: 'bookingRef', label: 'Associated booking ID' },
      { name: 'driver', label: 'Driver name', required: true },
      { name: 'driverLicence', label: 'Driver licence number', required: true },
      { name: 'category', label: 'Category', required: true, options: ['Driver Conduct', 'Fare Dispute', 'Vehicle Condition', 'Punctuality / Delay', 'Other'] },
      { name: 'incident', label: 'Nature and details of complaint', type: 'textarea', required: true },
      { name: 'actionTaken', label: 'Investigation / action taken', type: 'textarea', required: true },
    ],
  },
  council_incident: {
    label: 'Council Incidents', singular: 'Council incident', statuses: ['WAITING FOR REPLY', 'REPORTED TO COUNCIL', 'REPORT CONFIRMED'],
    fields: [
      { name: 'driverVehicle', label: 'Driver / vehicle reference', required: true },
      { name: 'incidentTime', label: 'Incident time', type: 'time', required: true },
      { name: 'category', label: 'Disclosure category', required: true, options: ['Driving Endorsements / Convictions / Cautions', 'Arrests', 'Change of Address', 'Vehicle Accidents', 'Other Mandatory Council Disclosure'] },
      { name: 'summary', label: 'Incident summary', type: 'textarea', required: true },
      { name: 'proofFile', label: 'Document / proof upload', type: 'file' },
      { name: 'councilReference', label: 'Council reference' },
    ],
  },
  dismissed_driver: {
    label: 'Driver Departures', singular: 'Driver departure', statuses: ['OPEN', 'COUNCIL NOTIFIED', 'CLOSED'],
    fields: [
      { name: 'driverName', label: 'Driver full name', required: true },
      { name: 'driverLicence', label: 'Driver licence number', required: true },
      { name: 'endDate', label: 'Last working date', type: 'date', required: true },
      { name: 'reason', label: 'Reason for dismissal / departure', type: 'textarea', required: true },
      { name: 'councilNotifiedDate', label: 'Council notified date', type: 'date' },
      { name: 'councilReference', label: 'Council acknowledgement / reference' },
      { name: 'accessRevoked', label: 'Portal and Cloudflare access revocation evidence' },
    ],
  },
  assistance_dog: {
    label: 'Assistance Dogs', singular: 'Assistance dog record', statuses: ['RECORDED', 'INVESTIGATING', 'RESOLVED'],
    fields: [
      { name: 'bookingRef', label: 'Booking reference', required: true },
      { name: 'passenger', label: 'Passenger name', required: true },
      { name: 'driver', label: 'Driver name', required: true },
      { name: 'request', label: 'Request / incident details', type: 'textarea', required: true },
      { name: 'exemptionChecked', label: 'Driver exemption evidence checked' },
      { name: 'actionTaken', label: 'Action taken', type: 'textarea', required: true },
    ],
  },
  licence_change: {
    label: 'Licence Changes', singular: 'Licence change notification', statuses: ['TO REPORT', 'REPORTED', 'ACKNOWLEDGED'],
    fields: [
      { name: 'changeType', label: 'Change type', required: true, options: ['Operating address', 'Directors / ownership', 'Contact details', 'Conviction / caution / arrest', 'Vehicle accident', 'Other material change'] },
      { name: 'effectiveDate', label: 'Effective / incident date', type: 'date', required: true },
      { name: 'details', label: 'Change details', type: 'textarea', required: true },
      { name: 'councilNotifiedDate', label: 'Council notified date', type: 'date' },
      { name: 'councilReference', label: 'Council acknowledgement / reference' },
    ],
  },
};

export function RecordsHub() {
  const [tab, setTab] = useState('overview');
  return (
    <>
      <section className="page-head">
        <div><h2>Records &amp; Compliance</h2><p>People, portal access, fleet compliance, operational registers and council-ready exports.</p></div>
      </section>
      <div className="records-category-nav">
        <section><b>Overview</b><div className="view-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Compliance overview</button></div></section>
        <section><b>People &amp; Access</b><div className="view-tabs"><button className={tab==='access'?'active':''} onClick={()=>setTab('access')}>Portal Users</button><button className={tab==='booking_staff'?'active':''} onClick={()=>setTab('booking_staff')}>Booking &amp; Dispatch Staff</button><button className={tab==='drivers'?'active':''} onClick={()=>setTab('drivers')}>Drivers</button><button className={tab==='dismissed_driver'?'active':''} onClick={()=>setTab('dismissed_driver')}>Departures</button></div></section>
        <section><b>Fleet</b><div className="view-tabs"><button className={tab==='vehicles'?'active':''} onClick={()=>setTab('vehicles')}>Vehicles</button><button className={tab==='vehicle_assignments'?'active':''} onClick={()=>setTab('vehicle_assignments')}>Driver–Vehicle Assignments</button><button className={tab==='vehicle_expiry'?'active':''} onClick={()=>setTab('vehicle_expiry')}>Expiring Documents</button></div></section>
        <section><b>Incidents &amp; Logs</b><div className="view-tabs"><button className={tab==='lost_property'?'active':''} onClick={()=>setTab('lost_property')}>Lost Property</button><button className={tab==='complaint'?'active':''} onClick={()=>setTab('complaint')}>Complaints</button><button className={tab==='assistance_dog'?'active':''} onClick={()=>setTab('assistance_dog')}>Assistance Dogs</button><button className={tab==='council_incident'?'active':''} onClick={()=>setTab('council_incident')}>Incident Reports</button></div></section>
        <section><b>Audit &amp; Procedures</b><div className="view-tabs"><button className={tab==='licence_change'?'active':''} onClick={()=>setTab('licence_change')}>Licence Changes</button><button className={tab==='procedures'?'active':''} onClick={()=>setTab('procedures')}>Standard Procedures</button></div></section>
      </div>
      {tab === 'overview' ? <RecordsOverview navigate={setTab}/> : tab === 'access' ? <StaffAccess embedded showCouncilStaff={false}/> : tab === 'booking_staff' ? <CouncilStaffRegister/> : tab === 'drivers' ? <CanonicalDriverRegister view="drivers"/> : tab === 'vehicles' ? <FleetOverview mode="vehicles"/> : tab === 'vehicle_assignments' ? <FleetOverview mode="assignments"/> : tab === 'vehicle_expiry' ? <FleetOverview mode="expiring"/> : tab === 'procedures' ? <CouncilProcedures /> : <Register type={tab} />}
    </>
  );
}

function RecordsOverview({navigate}:{navigate:(tab:string)=>void}) {
  return <section className="records-overview-grid"><button className="panel" onClick={()=>navigate('access')}><small>PEOPLE &amp; ACCESS</small><strong>Portal users and permissions</strong><span>Manage sign-in, roles, onboarding and offboarding.</span></button><button className="panel" onClick={()=>navigate('booking_staff')}><small>COUNCIL REGISTER</small><strong>Booking &amp; dispatch staff</strong><span>DBS sighting, suitability and operational duties.</span></button><button className="panel" onClick={()=>navigate('drivers')}><small>DRIVERS</small><strong>Driver compliance</strong><span>Licences, evidence and assignment approval.</span></button><button className="panel" onClick={()=>navigate('vehicles')}><small>FLEET</small><strong>Vehicles and documents</strong><span>Add vehicles independently and monitor expiry dates.</span></button><button className="panel" onClick={()=>navigate('vehicle_assignments')}><small>ALLOCATION</small><strong>Driver–vehicle assignments</strong><span>Preserve current and historical fleet relationships.</span></button><button className="panel" onClick={()=>navigate('vehicle_expiry')}><small>ACTION REQUIRED</small><strong>Expiring documents</strong><span>Review MOT, insurance and PHV licence dates.</span></button></section>;
}

function CouncilProcedures() {
  const procedures = [
    ['Booking and dispatch records','Record every booking before the journey; retain who took it, journey details, fare, licensed Driver/vehicle and dispatcher for at least 12 months. Use Booking Control → Council register CSV.'],
    ['Complaints','Record the complaint promptly, preserve the booking reference and evidence, investigate, record the outcome and provide it to the Council when requested.'],
    ['Lost property','Record where and when property was found, attempt return to the passenger, preserve evidence of the attempt and document final handover or disposal.'],
    ['Assistance dogs','Do not refuse an assistance dog unless the Driver holds the relevant exemption. Record any request, refusal or incident and the action taken.'],
    ['Safeguarding and incidents','Escalate immediate danger to emergency services. Preserve facts and evidence, restrict access, notify the licensing authority where required and record its reference.'],
    ['Driver departure / dismissal','Disable portal access, remove Cloudflare Access permission, preserve historical booking attribution and notify the Council with the reason where required.'],
    ['Material licence changes','Record changes to operating address, ownership, contact details, convictions, cautions, arrests or other material facts and evidence the Council notification.'],
    ['Data protection and retention','Use the private document store only. Never create public R2 links. Retain statutory records for the required period, restrict access and document exports.'],
  ];
  return <section className="panel compliance-register"><header className="register-head"><div><small>COUNCIL DEMONSTRATION</small><h3>Operating procedure library</h3><p>Concise operating controls for demonstration. These do not replace the licence conditions or your full written policies.</p></div></header><div className="compliance-list">{procedures.map(([title,body])=><article className="compliance-row" key={title}><div className="record-summary-main"><b>{title}</b><span>{body}</span></div></article>)}</div></section>;
}

function CanonicalDriverRegister({ view }: { view: 'drivers' }) {
  const [staff, setStaff] = useState<StaffMember[]>([]); const [editing, setEditing] = useState<StaffMember | null>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => fetch('/api/staff').then((response) => response.json()).then((value) => setStaff(Array.isArray(value) ? value.filter((member: StaffMember) => member.has_driver_profile) : [])).finally(() => setLoading(false)), []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section className="panel compliance-register"><header className="register-head"><div><small>CANONICAL COMPLIANCE RECORDS</small><h3>{view === 'drivers' ? 'Driver register' : 'Vehicle register'}</h3><p>These records are the same verified profiles used by assignment eligibility. Access roles remain in Staff &amp; Access.</p></div></header>
    {loading ? <p>Loading records…</p> : <div className="staff-list">{staff.map((member) => <div className="staff-row" key={member.id}><div><strong>{member.full_name||member.email}</strong><span>{member.role === 'OWNER_ADMIN' ? 'Owner/Admin with Driver profile' : 'Driver'} · Portal {member.active ? 'active' : 'disabled'}</span><span>Driver identity, licence and address evidence</span></div><div className="staff-badges"><span className={member.approved_for_assignment ? 'verified' : 'pending'}>{member.approved_for_assignment ? 'Assignment eligible' : 'Compliance pending'}</span></div><button onClick={() => setEditing(member)}>View / update Driver</button></div>)}</div>}
    {!loading && !staff.length && <p className="empty-register">No canonical Driver profiles exist yet. Create portal access in Staff &amp; Access, then open the Driver record from there.</p>}
    {editing && <DriverProfileEditor member={editing} close={() => setEditing(null)} saved={async () => { setEditing(null); await refresh(); }} />}
  </section>;
}

function Register({ type }: { type: string }) {
  const schema = schemas[type];
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [editing, setEditing] = useState<RecordRow | null | undefined>();
  const [query, setQuery] = useState('');
  const refresh = useCallback(() => fetch(`/api/records?type=${encodeURIComponent(type)}`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setRows(data); }), [type]);
  useEffect(() => { void refresh(); }, [refresh]);
  const filtered = useMemo(() => rows.filter((row) => `${row.reference} ${row.status} ${row.data_json}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const exportCsv = () => {
    const csv = [['Reference', 'Date', 'Status', 'Retention until', ...schema.fields.map((f) => f.label)], ...filtered.map((row) => {
      const data = JSON.parse(row.data_json || '{}');
      return [row.reference, row.event_date, row.status, row.retention_until, ...schema.fields.map((f) => String(data[f.name] || ''))];
    })].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    download(csv, `apx-${type}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };
  const exportPdf = () => exportRecordsPdf(schema.label, schema.fields, filtered);
  return (
    <section className="panel compliance-register">
      <header className="register-head"><div><small>12 MONTH MINIMUM RETENTION</small><h3>{schema.label} register</h3></div><div><button onClick={exportCsv}><Download />Export CSV</button><button onClick={exportPdf}><FileDown />Export PDF</button><button className="primary" onClick={() => setEditing(null)}><Plus />{type === 'roster' ? 'Add Driver & Vehicle' : `Add ${schema.singular}`}</button></div></header>
      <input className="record-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={type === 'roster' ? 'Search by call sign, driver name or vehicle registration' : `Search ${schema.label.toLowerCase()} records`} />
      <div className="compliance-list">
        {filtered.map((row) => {
          const data = JSON.parse(row.data_json || '{}') as Record<string, string>;
          return <details key={row.id} className={`compliance-row ${type === 'roster' ? 'roster-row' : ''}`}>
            <summary>{type === 'roster' ? <RosterSummary data={data} row={row} /> : <div className="record-summary-main"><b>{primaryValue(type, data, row.reference)}</b><span>{row.reference} · {row.event_date}</span></div>}<div className="summary-actions"><span className={`retention-badge ${expiryState(data)}`}>{expiryState(data).replace('_', ' ')}</span><span className={`status-badge ${statusClass(row.status)}`}>{row.status}</span><button onClick={(event) => { event.preventDefault(); setEditing(row); }}>Edit</button><ChevronDown className="accordion-arrow" /></div></summary>
            {type === 'roster' ? <><RosterDetails data={data} row={row} edit={() => setEditing(row)} /><RecordDocuments recordId={row.id} /></> : <><div className="expanded-status"><span className={`status-badge ${statusClass(row.status)}`}>{row.status}</span></div><dl className={type === 'complaint' ? 'complaint-details' : ''}>{schema.fields.filter((field) => field.type !== 'file').map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{data[field.name] || '—'}</dd></div>)}<div><dt>Protected until at least</dt><dd>{row.retention_until}</dd></div><div><dt>Last updated</dt><dd>{new Date(row.updated_at).toLocaleString('en-GB')}</dd></div></dl><RecordDocuments recordId={row.id} /></>}
          </details>;
        })}
        {!filtered.length && <p className="empty-register">No {schema.label.toLowerCase()} records logged.</p>}
      </div>
      {editing !== undefined && <RecordModal schema={schema} type={type} row={editing} close={() => setEditing(undefined)} saved={() => { setEditing(undefined); void refresh(); }} />}
    </section>
  );
}

function RecordModal({ schema, type, row, close, saved }: { schema: (typeof schemas)[string]; type: string; row: RecordRow | null; close: () => void; saved: () => void }) {
  const data = row ? JSON.parse(row.data_json || '{}') : {};
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const raw = new FormData(event.currentTarget); const form = Object.fromEntries(raw);
    const attachments = schema.fields.filter((field) => field.type === 'file').flatMap((field) => raw.getAll(field.name).filter((item): item is File => item instanceof File && item.size > 0).map((file) => ({ field, file })));
    const oversized = attachments.find(({ file }) => file.size > 1_000_000);
    if (oversized) { alert(`${oversized.file.name} is larger than 1 MB. Please choose a smaller PDF, JPG or PNG file.`); return; }
    const payload = { id: row?.id, recordType: type, reference: form.reference, eventDate: form.eventDate, status: form.status, data: Object.fromEntries(schema.fields.filter((field) => field.type !== 'file').map((field) => [field.name, form[field.name]])) };
    const response = await fetch('/api/records', { method: row ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { alert('The record could not be saved. Please try again.'); return; }
    const result = await response.json() as { id?: number | string };
    const recordId = result.id || row?.id;
    for (const { field, file } of attachments) {
      if (recordId) { const upload = new FormData(); upload.set('file', file); upload.set('recordId', String(recordId)); upload.set('fieldName', field.name); const uploaded = await fetch('/api/documents', { method: 'POST', body: upload }); if (!uploaded.ok) { const problem = await uploaded.json().catch(() => ({})) as { error?: string }; alert(`The record was saved, but ${file.name} could not be uploaded. ${problem.error || ''}`.trim()); return; } }
    }
    saved();
  };
  const statuses = row && !schema.statuses.includes(row.status) ? [row.status, ...schema.statuses] : schema.statuses;
  return <div className="modal"><button className="scrim" aria-label="Close record form" onClick={close} /><form className={`record-modal ${type === 'complaint' ? 'complaint-modal' : ''}`} onSubmit={submit}><header><div><small>COMPLIANCE RECORD</small><h2>{row ? 'Edit' : 'Add'} {schema.singular}</h2></div><button type="button" aria-label="Close record form" onClick={close}><X /></button></header><div className="record-form-grid"><label>Reference<input name="reference" defaultValue={row?.reference || ''} placeholder="Generated if left blank" /></label><label>Record date<input name="eventDate" type="date" required defaultValue={row?.event_date || new Date().toISOString().slice(0, 10)} /></label><label>Status<select name="status" defaultValue={row?.status || statuses[0]}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>{schema.fields.map((field) => <label key={field.name} className={field.type === 'textarea' || field.type === 'file' ? 'record-field-wide' : ''}>{field.label}{field.options ? <select name={field.name} required={field.required} defaultValue={data[field.name] || field.options[0]}>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : field.type === 'textarea' ? <textarea name={field.name} required={field.required} defaultValue={data[field.name] || ''} rows={6} /> : <><input name={field.name} type={field.type || 'text'} accept={field.type === 'file' ? '.pdf,.jpg,.jpeg,.png' : undefined} multiple={field.type === 'file' && field.multiple} required={field.required} defaultValue={field.type === 'file' ? undefined : data[field.name] || ''} />{field.type === 'file' && <small className="record-upload-hint">PDF, JPG or PNG · maximum 1 MB per file{field.multiple ? ' · multiple files allowed' : ''}</small>}</>}</label>)}</div>{row && <RecordDocuments recordId={row.id} />}<p className="retention-note">This record is retained for at least 12 months. Every change creates a preserved revision; deletion is disabled.</p><footer><button type="button" onClick={close}>Cancel</button><button className="primary"><Save />Save revision</button></footer></form></div>;
}

function RosterSummary({ data, row }: { data: Record<string, string>; row: RecordRow }) {
  return <div className="roster-summary"><span className="call-sign">{data.callSign || '—'}</span><div><b>{data.callSign ? `${data.callSign}. ` : ''}{data.fullName || row.reference}</b><small>PHV Licence: {data.badgeNumber || '—'} · Tel: {data.phone || '—'}</small></div><em>{data.vrm || 'NO VRM'} · {data.makeModelColour || 'Vehicle not assigned'}</em></div>;
}

function RosterDetails({ data, row, edit }: { data: Record<string, string>; row: RecordRow; edit: () => void }) {
  return <div className="roster-detail-grid"><section><h4>DRIVER COMPLIANCE PROFILE</h4><RosterLine label="Full name" value={data.fullName} /><RosterLine label="Current address" value={data.address} /><RosterLine label="PHV licence expiry" value={data.badgeExpiry} /><RosterLine label="DVLA licence number" value={data.dvlaNumber} /><RosterLine label="Engagement start date" value={data.engagementDate} /><RosterLine label="Statutory retention tag" value={row.status} /><button onClick={edit}>Edit Profile</button></section><section><h4>ASSIGNED VEHICLE PROFILE ({data.vrm || 'VRM'})</h4><RosterLine label="Make, model & colour" value={data.makeModelColour} /><RosterLine label="Registered keeper" value={data.registeredKeeper} /><RosterLine label="MOT expiry date" value={withValidity(data.motExpiry)} /><RosterLine label="Insurance policy status" value={withValidity(data.insuranceExpiry)} /><RosterLine label="Council PHV licence status" value={withValidity(data.phvExpiry)} /><button onClick={edit}>Update Vehicle</button></section></div>;
}

function RosterLine({ label, value }: { label: string; value?: string }) { return <div className="roster-line"><span>{label}</span><b>{value || '—'}</b></div>; }
function withValidity(value?: string) { if (!value) return '—'; return `${value} · ${new Date(value).getTime() >= Date.now() ? 'Valid' : 'Expired'}`; }

function RecordDocuments({ recordId }: { recordId: number }) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  useEffect(() => { void fetch(`/api/documents?recordId=${recordId}`).then((response) => response.ok ? response.json() : []).then((items) => setDocuments(Array.isArray(items) ? items : [])); }, [recordId]);
  if (!documents.length) return null;
  const labels: Record<string, string> = { driverDocuments: 'Driver document', vehicleDocuments: 'Vehicle document', returnEvidence: 'Return evidence', proofFile: 'Supporting document' };
  return <section className="record-documents"><h4>ATTACHED DOCUMENTS</h4><div>{documents.map((document) => <a key={document.id} href={`/api/documents?id=${document.id}&preview=1`} target="_blank" rel="noreferrer">{document.content_type.startsWith('image/') ? <img src={`/api/documents?id=${document.id}&preview=1`} alt="" /> : <FileDown />}<span><em>{labels[document.field_name] || 'Document'}</em>{document.file_name}<small>View or download</small></span></a>)}</div></section>;
}

function primaryValue(type: string, data: Record<string, string>, fallback: string) {
  if (type === 'roster') return `${data.callSign || ''} ${data.fullName || fallback} · ${data.vrm || 'No vehicle'}`.trim();
  if (type === 'lost_property') return data.item || fallback;
  if (type === 'complaint') return data.complainant || fallback;
  if (type === 'dismissed_driver') return data.driverName || fallback;
  if (type === 'assistance_dog') return `${data.bookingRef || fallback} · ${data.passenger || ''}`;
  if (type === 'licence_change') return data.changeType || fallback;
  return data.driverVehicle || fallback;
}

function expiryState(data: Record<string, string>) {
  const values = ['badgeExpiry', 'motExpiry', 'insuranceExpiry', 'phvExpiry'].map((key) => data[key]).filter(Boolean).map((value) => new Date(value).getTime());
  if (!values.length) return 'retained';
  const soonest = Math.min(...values); const days = (soonest - Date.now()) / 86400000;
  return days < 0 ? 'expired' : days <= 30 ? 'expiring_soon' : 'active';
}

function statusClass(status: string) {
  const value = status.toUpperCase();
  if (value.includes('RESOLVED') || value.includes('ACTIVE') || value.includes('CONFIRMED') || value.includes('RETURNED')) return 'status-good';
  if (value.includes('PROGRESS') || value.includes('INVESTIGATION') || value.includes('REPORTED') || value.includes('STORAGE')) return 'status-progress';
  return 'status-pending';
}

function exportRecordsPdf(title: string, fields: Field[], rows: RecordRow[]) {
  const lines = [
    'APX RIDE',
    `${title.toUpperCase()} REGISTER`,
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    '',
  ];
  rows.forEach((row, index) => {
    const data = JSON.parse(row.data_json || '{}') as Record<string, string>;
    lines.push(`${index + 1}. ${row.reference} | ${row.event_date} | ${row.status}`);
    fields.filter((field) => field.type !== 'file').forEach((field) => lines.push(`   ${field.label}: ${data[field.name] || '-'}`));
    lines.push(`   Retention until: ${row.retention_until}`, '');
  });
  if (!rows.length) lines.push('No records in the current filtered view.');
  downloadPdf(lines, `apx-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function downloadPdf(sourceLines: string[], filename: string) {
  const ascii = (value: string) => value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/([\\()])/g, '\\$1');
  const wrapped = sourceLines.flatMap((line) => {
    const clean = ascii(line);
    if (!clean) return [''];
    const result: string[] = [];
    for (let start = 0; start < clean.length; start += 92) result.push(clean.slice(start, start + 92));
    return result;
  });
  const pages: string[][] = [];
  for (let start = 0; start < wrapped.length; start += 48) pages.push(wrapped.slice(start, start + 48));
  if (!pages.length) pages.push(['No records']);
  const objects: string[] = [];
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((page, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    const commands = ['BT', '/F1 9 Tf', '46 795 Td', '12 TL', ...page.flatMap((line, lineIndex) => [`(${line}) Tj`, lineIndex < page.length - 1 ? 'T*' : '']), 'ET'].filter(Boolean).join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  download(pdf, filename, 'application/pdf');
}

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
