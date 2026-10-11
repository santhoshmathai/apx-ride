import { env } from 'cloudflare:workers';

export type ComplianceExpiryItem = {
  alert_key: string;
  entity_type: 'DRIVER' | 'VEHICLE';
  entity_id: string;
  entity_label: string;
  document_type: string;
  due_date: string;
  severity: 'MISSING' | 'OVERDUE' | 'CRITICAL' | 'DUE_SOON' | 'UPCOMING' | 'FUTURE';
  days_remaining: number | null;
};

const day = 86_400_000;

function classify(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { severity: 'MISSING' as const, days: null };
  const days = Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / day);
  if (days < 0) return { severity: 'OVERDUE' as const, days };
  if (days <= 7) return { severity: 'CRITICAL' as const, days };
  if (days <= 30) return { severity: 'DUE_SOON' as const, days };
  if (days <= 90) return { severity: 'UPCOMING' as const, days };
  if (days <= 183) return { severity: 'FUTURE' as const, days };
  return null;
}

export async function collectComplianceItems(organisationId: string, ownerId: string, today = new Date().toISOString().slice(0, 10)) {
  const [drivers, vehicles] = await Promise.all([
    env.DB.prepare(`SELECT p.id,p.full_name,s.email,p.private_hire_licence_expiry,p.dvla_licence_expiry,p.dvla_next_check_due
      FROM driver_profiles p JOIN portal_staff s ON s.id=p.staff_id
      WHERE p.organisation_id=? AND p.owner_id=? AND p.active=1 AND s.active=1`).bind(organisationId, ownerId).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT id,registration,private_hire_vehicle_licence_expiry,mot_expiry,insurance_expiry
      FROM driver_vehicles WHERE organisation_id=? AND owner_id=? AND active=1`).bind(organisationId, ownerId).all<Record<string, unknown>>(),
  ]);
  const items: ComplianceExpiryItem[] = [];
  const add = (entityType: 'DRIVER' | 'VEHICLE', entityId: string, entityLabel: string, documentType: string, dueDate: string) => {
    const result = classify(dueDate, today);
    if (!result) return;
    items.push({ alert_key: `${organisationId}:${entityType}:${entityId}:${documentType}`, entity_type: entityType, entity_id: entityId, entity_label: entityLabel, document_type: documentType, due_date: dueDate, severity: result.severity, days_remaining: result.days });
  };
  for (const row of drivers.results) {
    const id = String(row.id); const label = String(row.full_name || row.email || 'Driver');
    add('DRIVER', id, label, 'PHD licence', String(row.private_hire_licence_expiry || ''));
    add('DRIVER', id, label, 'DVLA periodic review', String(row.dvla_next_check_due || ''));
    add('DRIVER', id, label, 'DVLA licence validity', String(row.dvla_licence_expiry || ''));
  }
  for (const row of vehicles.results) {
    const id = String(row.id); const label = String(row.registration || 'Vehicle');
    add('VEHICLE', id, label, 'PHV licence', String(row.private_hire_vehicle_licence_expiry || ''));
    add('VEHICLE', id, label, 'MOT', String(row.mot_expiry || ''));
    add('VEHICLE', id, label, 'Insurance', String(row.insurance_expiry || ''));
  }
  return items.sort((a, b) => (a.due_date || '0000').localeCompare(b.due_date || '0000'));
}

export async function processComplianceChecks() {
  const organisations = await env.DB.prepare('SELECT id,owner_user_id FROM organisations').all<{ id: string; owner_user_id: string }>();
  const now = new Date().toISOString();
  for (const organisation of organisations.results) {
    const items = await collectComplianceItems(organisation.id, organisation.owner_user_id);
    const existing = await env.DB.prepare("SELECT alert_key,severity,due_date FROM compliance_alerts WHERE organisation_id=? AND status='OPEN'").bind(organisation.id).all<{ alert_key: string; severity: string; due_date: string }>();
    const previous = new Map(existing.results.map((item) => [item.alert_key, item]));
    const active = new Set(items.map((item) => item.alert_key));
    for (const item of items) {
      const before = previous.get(item.alert_key);
      await env.DB.prepare(`INSERT INTO compliance_alerts(organisation_id,owner_id,entity_type,entity_id,entity_label,document_type,due_date,severity,alert_key,status,first_alerted_at,last_checked_at,resolved_at)
        VALUES(?,?,?,?,?,?,?,?,?,'OPEN',?,?,'') ON CONFLICT(alert_key) DO UPDATE SET entity_label=excluded.entity_label,due_date=excluded.due_date,severity=excluded.severity,status='OPEN',last_checked_at=excluded.last_checked_at,resolved_at=''`)
        .bind(organisation.id, organisation.owner_user_id, item.entity_type, item.entity_id, item.entity_label, item.document_type, item.due_date, item.severity, item.alert_key, now, now).run();
      if (!before || before.severity !== item.severity || before.due_date !== item.due_date) {
        await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)')
          .bind(organisation.owner_user_id, 'system@apxride.com', 'COMPLIANCE_EXPIRY_ALERT', item.entity_type.toLowerCase(), item.entity_id, `${item.entity_label}: ${item.document_type} ${item.severity.toLowerCase()}${item.due_date ? ` (${item.due_date})` : ''}`, now).run();
      }
    }
    for (const item of existing.results) if (!active.has(item.alert_key)) {
      await env.DB.prepare("UPDATE compliance_alerts SET status='RESOLVED',resolved_at=?,last_checked_at=? WHERE organisation_id=? AND alert_key=?").bind(now, now, organisation.id, item.alert_key).run();
    }
  }
}
