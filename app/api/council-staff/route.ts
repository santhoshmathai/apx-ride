import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

async function admin() { const user = await getPortalPrincipal(); return user?.role === 'OWNER_ADMIN' ? user : null; }
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const flag = (value: unknown) => value === true ? 1 : 0;
async function audit(user: NonNullable<Awaited<ReturnType<typeof admin>>>, action: string, id: number, summary: string) { await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId,user.email,action,'council_staff',String(id),summary,new Date().toISOString()).run(); }

export async function GET(req: Request) {
  const user = await admin(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const rows = await env.DB.prepare('SELECT * FROM council_staff WHERE organisation_id=? AND owner_id=? ORDER BY status,full_name').bind(user.organisationId,user.ownerId).all<Record<string, unknown>>();
  if (new URL(req.url).searchParams.get('format') !== 'csv') return NextResponse.json(rows.results);
  const keys = ['full_name','email','phone','role_title','takes_bookings','dispatches_vehicles','start_date','end_date','dbs_sighted','dbs_sighted_date','dbs_certificate_date','dbs_sighted_by','suitability_decision','suitability_decision_date','conviction_declaration_date','training_notes','status'];
  const quote=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`; const csv=[keys.map(quote).join(','),...rows.results.map((row)=>keys.map((key)=>quote(row[key])).join(','))].join('\r\n');
  return new NextResponse('\ufeff'+csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="apx-ride-council-staff-register.csv"','cache-control':'no-store'}});
}

async function save(req: Request, updating: boolean) {
  if (!validMutationOrigin(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const user=await admin(); if(!user)return NextResponse.json({error:'Access denied'},{status:403}); const body=await req.json() as Record<string,unknown>;
  const fullName=text(body.fullName,150), startDate=text(body.startDate,10); if(!fullName||!startDate)return NextResponse.json({error:'Full name and start date are required'},{status:400});
  const values=[fullName,text(body.email,254).toLowerCase(),text(body.phone,50),text(body.roleTitle,120)||'Booking/dispatch staff',flag(body.takesBookings),flag(body.dispatchesVehicles),startDate,text(body.endDate,10),flag(body.dbsSighted),text(body.dbsSightedDate,10),text(body.dbsCertificateDate,10),text(body.dbsSightedBy,150),text(body.suitabilityDecision,30)||'PENDING',text(body.suitabilityDecisionDate,10),text(body.convictionDeclarationDate,10),text(body.trainingNotes,2000),text(body.status,20)||'ACTIVE']; const now=new Date().toISOString();
  if(updating){const id=Number(body.id);const result=await env.DB.prepare('UPDATE council_staff SET full_name=?,email=?,phone=?,role_title=?,takes_bookings=?,dispatches_vehicles=?,start_date=?,end_date=?,dbs_sighted=?,dbs_sighted_date=?,dbs_certificate_date=?,dbs_sighted_by=?,suitability_decision=?,suitability_decision_date=?,conviction_declaration_date=?,training_notes=?,status=?,updated_at=? WHERE id=? AND organisation_id=? AND owner_id=?').bind(...values,now,id,user.organisationId,user.ownerId).run();if(result.meta.changes!==1)return NextResponse.json({error:'Staff record not found'},{status:404});await audit(user,'UPDATE_COUNCIL_STAFF',id,`Updated staff register for ${fullName}`);return NextResponse.json({ok:true});}
  const result=await env.DB.prepare('INSERT INTO council_staff(owner_id,organisation_id,full_name,email,phone,role_title,takes_bookings,dispatches_vehicles,start_date,end_date,dbs_sighted,dbs_sighted_date,dbs_certificate_date,dbs_sighted_by,suitability_decision,suitability_decision_date,conviction_declaration_date,training_notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(user.ownerId,user.organisationId,...values,now,now).run();const id=Number(result.meta.last_row_id);await audit(user,'CREATE_COUNCIL_STAFF',id,`Added ${fullName} to Council staff register`);return NextResponse.json({id},{status:201});
}
export async function POST(req:Request){return save(req,false)}
export async function PUT(req:Request){return save(req,true)}
