'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Plus, Save, X } from 'lucide-react';

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

type Field = { name: string; label: string; type?: string; required?: boolean };
const schemas: Record<string, { label: string; singular: string; fields: Field[]; statuses: string[] }> = {
  driver: {
    label: 'Drivers', singular: 'Driver', statuses: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
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
      { name: 'licenceDocument', label: 'Licence document reference / secure link' },
    ],
  },
  vehicle: {
    label: 'Vehicles', singular: 'Vehicle', statuses: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'],
    fields: [
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
      { name: 'documents', label: 'MOT, insurance and PHV document references' },
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
      { name: 'returnAttempt', label: 'Evidence of attempt to return property', required: true },
      { name: 'resolutionDate', label: 'Resolution date', type: 'date' },
      { name: 'notes', label: 'Notes' },
    ],
  },
  complaint: {
    label: 'Complaints', singular: 'Complaint', statuses: ['OPEN', 'UNDER INVESTIGATION', 'RESOLVED'],
    fields: [
      { name: 'complainant', label: 'Complainant full name', required: true },
      { name: 'contact', label: 'Complainant contact', required: true },
      { name: 'bookingRef', label: 'Associated booking ID' },
      { name: 'driver', label: 'Driver name', required: true },
      { name: 'driverLicence', label: 'Driver licence number', required: true },
      { name: 'category', label: 'Category', required: true },
      { name: 'incident', label: 'Nature and details of complaint', required: true },
      { name: 'actionTaken', label: 'Investigation / action taken', required: true },
    ],
  },
  council_incident: {
    label: 'Council Incidents', singular: 'Council incident', statuses: ['WAITING FOR REPLY', 'REPORTED TO COUNCIL', 'REPORT CONFIRMED'],
    fields: [
      { name: 'driverVehicle', label: 'Driver / vehicle reference', required: true },
      { name: 'incidentTime', label: 'Incident time', type: 'time', required: true },
      { name: 'category', label: 'Disclosure category', required: true },
      { name: 'summary', label: 'Incident summary', required: true },
      { name: 'proofReference', label: 'Document / proof reference or secure link' },
      { name: 'councilReference', label: 'Council reference' },
    ],
  },
};

export function RecordsHub({ earnings }: { earnings: ReactNode }) {
  const [tab, setTab] = useState('earnings');
  return (
    <>
      <section className="page-head">
        <div><h2>Records Hub</h2><p>Operational registers, financial records and council-ready audit exports.</p></div>
      </section>
      <div className="view-tabs records-tabs">
        <button className={tab === 'earnings' ? 'active' : ''} onClick={() => setTab('earnings')}>Earnings</button>
        {Object.entries(schemas).map(([key, schema]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{schema.label}</button>)}
      </div>
      {tab === 'earnings' ? earnings : <Register type={tab} />}
    </>
  );
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
  return (
    <section className="panel compliance-register">
      <header className="register-head"><div><small>12 MONTH MINIMUM RETENTION</small><h3>{schema.label} register</h3></div><div><button onClick={exportCsv}><Download />Export CSV</button><button onClick={() => window.print()}><FileDown />Export PDF</button><button className="primary" onClick={() => setEditing(null)}><Plus />Add {schema.singular}</button></div></header>
      <input className="record-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${schema.label.toLowerCase()} records`} />
      <div className="compliance-list">
        {filtered.map((row) => {
          const data = JSON.parse(row.data_json || '{}') as Record<string, string>;
          return <details key={row.id} className="compliance-row">
            <summary><div><b>{primaryValue(type, data, row.reference)}</b><span>{row.reference} · {row.event_date}</span></div><div><span className={`retention-badge ${expiryState(data)}`}>{expiryState(data).replace('_', ' ')}</span><span className="pill">{row.status}</span><button onClick={(event) => { event.preventDefault(); setEditing(row); }}>Edit</button></div></summary>
            <dl>{schema.fields.map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{data[field.name] || '—'}</dd></div>)}<div><dt>Protected until at least</dt><dd>{row.retention_until}</dd></div><div><dt>Last updated</dt><dd>{new Date(row.updated_at).toLocaleString('en-GB')}</dd></div></dl>
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
    event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { id: row?.id, recordType: type, reference: form.reference, eventDate: form.eventDate, status: form.status, data: Object.fromEntries(schema.fields.map((field) => [field.name, form[field.name]])) };
    const response = await fetch('/api/records', { method: row ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (response.ok) saved(); else alert('The record could not be saved. Please try again.');
  };
  return <div className="modal"><button className="scrim" aria-label="Close record form" onClick={close} /><form className="record-modal" onSubmit={submit}><header><div><small>COMPLIANCE RECORD</small><h2>{row ? 'Edit' : 'Add'} {schema.singular}</h2></div><button type="button" aria-label="Close record form" onClick={close}><X /></button></header><div className="record-form-grid"><label>Reference<input name="reference" defaultValue={row?.reference || ''} placeholder="Generated if left blank" /></label><label>Record date<input name="eventDate" type="date" required defaultValue={row?.event_date || new Date().toISOString().slice(0, 10)} /></label><label>Status<select name="status" defaultValue={row?.status || schema.statuses[0]}>{schema.statuses.map((status) => <option key={status}>{status}</option>)}</select></label>{schema.fields.map((field) => <label key={field.name}>{field.label}<input name={field.name} type={field.type || 'text'} required={field.required} defaultValue={data[field.name] || ''} /></label>)}</div><p className="retention-note">This record is retained for at least 12 months. Changes are written to the audit trail; deletion is disabled.</p><footer><button type="button" onClick={close}>Cancel</button><button className="primary"><Save />Save record</button></footer></form></div>;
}

function primaryValue(type: string, data: Record<string, string>, fallback: string) {
  if (type === 'driver') return `${data.callSign || ''} ${data.fullName || fallback}`.trim();
  if (type === 'vehicle') return `${data.vrm || ''} ${data.makeModelColour || fallback}`.trim();
  if (type === 'lost_property') return data.item || fallback;
  if (type === 'complaint') return data.complainant || fallback;
  return data.driverVehicle || fallback;
}

function expiryState(data: Record<string, string>) {
  const values = ['badgeExpiry', 'motExpiry', 'insuranceExpiry', 'phvExpiry'].map((key) => data[key]).filter(Boolean).map((value) => new Date(value).getTime());
  if (!values.length) return 'retained';
  const soonest = Math.min(...values); const days = (soonest - Date.now()) / 86400000;
  return days < 0 ? 'expired' : days <= 30 ? 'expiring_soon' : 'active';
}

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
