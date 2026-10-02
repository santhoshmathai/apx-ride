import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

const text = (value: unknown, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value, 10)) ? text(value, 10) : '';
async function admin() { if (!cloudflareAuthEnabled()) return null; const user = await getPortalPrincipal(); return user?.role === 'OWNER_ADMIN' ? user : null; }

export async function GET() {
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const rows = await env.DB.prepare(`SELECT v.*,
    (SELECT COUNT(*) FROM driver_vehicle_assignments a WHERE a.vehicle_id=v.id AND a.organisation_id=v.organisation_id AND a.active=1) AS active_assignment_count
    FROM driver_vehicles v WHERE v.organisation_id=? AND v.owner_id=? ORDER BY v.active DESC,v.registration`).bind(user.organisationId,user.ownerId).all();
  return NextResponse.json(rows.results);
}

export async function POST(req: Request) { return save(req, false); }
export async function PUT(req: Request) { return save(req, true); }
export async function DELETE(req: Request) {if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});const user=await admin();if(!user)return NextResponse.json({error:'Access denied'},{status:403});const id=text(new URL(req.url).searchParams.get('id'),80);const row=await env.DB.prepare('SELECT id,registration,active FROM driver_vehicles WHERE id=? AND organisation_id=? AND owner_id=?').bind(id,user.organisationId,user.ownerId).first<{id:string;registration:string;active:number}>();if(!row)return NextResponse.json({error:'Vehicle not found'},{status:404});if(row.active)return NextResponse.json({error:'Deactivate the vehicle before deleting it.'},{status:409});const assignments=await env.DB.prepare('SELECT COUNT(*) AS count FROM driver_vehicle_assignments WHERE vehicle_id=? AND organisation_id=?').bind(id,user.organisationId).first<{count:number}>();if(Number(assignments?.count))return NextResponse.json({error:'This vehicle has assignment history and must be retained. Keep it inactive instead.'},{status:409});const docs=await env.DB.prepare("SELECT object_key FROM profile_documents WHERE organisation_id=? AND entity_type='VEHICLE' AND entity_id=?").bind(user.organisationId,id).all<{object_key:string}>();for(const doc of docs.results)await env.BUCKET.delete(doc.object_key);await env.DB.batch([env.DB.prepare("DELETE FROM profile_documents WHERE organisation_id=? AND entity_type='VEHICLE' AND entity_id=?").bind(user.organisationId,id),env.DB.prepare('DELETE FROM driver_vehicles WHERE id=? AND organisation_id=? AND owner_id=?').bind(id,user.organisationId,user.ownerId),env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId,user.email,'DELETE_UNUSED_VEHICLE','vehicle',id,`Deleted unused vehicle ${row.registration}`,new Date().toISOString())]);return NextResponse.json({ok:true})}

async function save(req: Request, updating: boolean) {
  if (!validMutationOrigin(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const body = await req.json() as Record<string, unknown>; const registration = text(body.registration, 20).toUpperCase();
  if (!registration || !text(body.vehicleMake) || !text(body.vehicleModel) || !text(body.vehicleColour) || !text(body.privateHireVehicleLicenceNumber)) return NextResponse.json({ error: 'Registration, make, model, colour and PHV licence number are required' }, { status: 400 });
  const now = new Date().toISOString(); const id = updating ? text(body.id, 80) : crypto.randomUUID();
  const values = [registration,text(body.vehicleMake),text(body.vehicleModel),text(body.vehicleColour),text(body.vehicleCategory),text(body.phvBadgeNumber),text(body.registeredKeeperAddress,500),date(body.insuranceValidFrom),date(body.inTermMotDate),text(body.privateHireVehicleLicenceNumber),date(body.privateHireVehicleLicenceExpiry),date(body.motExpiry),date(body.insuranceExpiry),text(body.v5DocumentStatus,30)||'MISSING',body.approved===true?1:0,body.active===false?0:1,date(body.availableFrom),date(body.availableUntil),`${text(body.vehicleMake)} ${text(body.vehicleModel)} ${text(body.vehicleColour)}`.trim()];
  try {
    if (updating) {
      const result = await env.DB.prepare(`UPDATE driver_vehicles SET registration=?,vehicle_make=?,vehicle_model=?,vehicle_colour=?,vehicle_category=?,phv_badge_number=?,registered_keeper_address=?,insurance_valid_from=?,in_term_mot_date=?,private_hire_vehicle_licence_number=?,private_hire_vehicle_licence_expiry=?,mot_expiry=?,insurance_expiry=?,v5_document_status=?,approved=?,active=?,available_from=?,available_until=?,make_model_colour=?,updated_at=? WHERE id=? AND organisation_id=? AND owner_id=?`).bind(...values,now,id,user.organisationId,user.ownerId).run();
      if (result.meta.changes !== 1) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    } else {
      await env.DB.prepare(`INSERT INTO driver_vehicles(id,organisation_id,owner_id,driver_profile_id,registration,vehicle_make,vehicle_model,vehicle_colour,vehicle_category,phv_badge_number,registered_keeper_address,insurance_valid_from,in_term_mot_date,private_hire_vehicle_licence_number,private_hire_vehicle_licence_expiry,mot_expiry,insurance_expiry,v5_document_status,approved,active,available_from,available_until,make_model_colour,created_at,updated_at) VALUES(?,?,?,'',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.organisationId,user.ownerId,...values,now,now).run();
    }
  } catch { return NextResponse.json({ error: 'A vehicle with this registration already exists' }, { status: 409 }); }
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId,user.email,updating?'UPDATE_VEHICLE':'CREATE_VEHICLE','vehicle',id,`${updating?'Updated':'Added'} vehicle ${registration}`,now).run();
  return NextResponse.json({ id }, { status: updating ? 200 : 201 });
}
