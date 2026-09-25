import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { sendOutbox } from '../../email-service';
import { getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user=await getPortalPrincipal(); if(!user||user.role!=='OWNER_ADMIN')return NextResponse.json({error:'Access denied'},{status:403});
  const body=await req.json() as {bookingId?:unknown}; const id=Number(body.bookingId);
  const booking=await env.DB.prepare('SELECT * FROM bookings WHERE id=? AND owner_id=?').bind(id,user.ownerId).first<Record<string,unknown>>();
  if(!booking)return NextResponse.json({error:'Booking not found'},{status:404}); const recipient=String(booking.customer_email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))return NextResponse.json({error:'A valid customer email is required before sending an invoice'},{status:409});
  const invoice=`APX-INV-${String(id).padStart(5,'0')}`; const fare=Number(booking.fare||0).toFixed(2); const now=new Date().toISOString();
  const message=[`Dear ${booking.passenger_name},`,'',`Please find the formal journey invoice details below.`,`Invoice: ${invoice}`,`Journey date: ${new Date(String(booking.pickup_at)).toLocaleString('en-GB')}`,`Route: ${booking.pickup} to ${booking.dropoff}`,`Vehicle: ${booking.fleet_tier}`,`Total: £${fare}`,'','Please reply to this email if you require any correction.'].join('\n');
  const result=await env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,booking_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(user.organisationId,0,id,'EMAIL',recipient,'FORMAL_INVOICE',`APX RIDE invoice ${invoice}`,message,'PREPARED',0,'',now,'').run();
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId,user.email,'SEND_FORMAL_INVOICE','booking',String(id),`Prepared ${invoice} for ${recipient}`,now).run();
  const delivery=await sendOutbox(Number(result.meta.last_row_id),user.organisationId); return NextResponse.json(delivery,{status:delivery.ok?201:202});
}
