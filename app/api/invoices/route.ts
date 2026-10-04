import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { sendOutbox } from '../../email-service';
import { getPortalPrincipal } from '../../portal-auth';
import { validMutationOrigin } from '../../request-security';
import { createInvoicePdf } from '../../invoice-pdf';

export async function POST(req: Request) {
  if(!validMutationOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
  const user=await getPortalPrincipal(); if(!user||user.role!=='OWNER_ADMIN')return NextResponse.json({error:'Access denied'},{status:403});
  const body=await req.json() as {bookingId?:unknown;customerEmail?:unknown}; const id=Number(body.bookingId);
  const booking=await env.DB.prepare('SELECT * FROM bookings WHERE id=? AND owner_id=?').bind(id,user.ownerId).first<Record<string,unknown>>();
  if(!booking)return NextResponse.json({error:'Booking not found'},{status:404}); const recipient=(typeof body.customerEmail==='string'?body.customerEmail:String(booking.customer_email||'')).trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))return NextResponse.json({error:'A valid customer email is required before sending an invoice'},{status:409});
  const invoice=`APX-INV-${String(id).padStart(5,'0')}`; const fare=Number(booking.fare||0).toFixed(2); const now=new Date().toISOString();
  const message=[`Dear ${booking.passenger_name},`,'',`Please find the formal journey invoice details below.`,`Invoice: ${invoice}`,`Journey date: ${new Date(String(booking.pickup_at)).toLocaleString('en-GB')}`,`Route: ${booking.pickup} to ${booking.dropoff}`,`Vehicle: ${booking.fleet_tier}`,`Total: £${fare}`,'','Please reply to this email if you require any correction.'].join('\n');
  await env.DB.prepare('UPDATE bookings SET customer_email=?,updated_at=? WHERE id=? AND owner_id=?').bind(recipient,now,id,user.ownerId).run();
  const filename=`${invoice}.pdf`; const objectKey=`${user.ownerId}/invoices/${invoice}-${crypto.randomUUID()}.pdf`;
  const pdf=createInvoicePdf({invoiceNumber:invoice,invoiceDate:new Date(now).toLocaleDateString('en-GB'),passengerName:String(booking.passenger_name||''),pickup:String(booking.pickup||''),dropoff:String(booking.dropoff||''),journeyDate:new Date(String(booking.pickup_at)).toLocaleString('en-GB'),vehicleCategory:String(booking.fleet_tier||''),fare});
  await env.BUCKET.put(objectKey,pdf,{httpMetadata:{contentType:'application/pdf'},customMetadata:{invoiceNumber:invoice,bookingId:String(id),createdBy:user.email}});
  const result=await env.DB.prepare('INSERT INTO notification_outbox(organisation_id,request_id,booking_id,channel,recipient,template_key,subject,message,status,attempts,last_error,created_at,sent_at,attachment_object_key,attachment_filename,attachment_content_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(user.organisationId,0,id,'EMAIL',recipient,'FORMAL_INVOICE',`APX RIDE invoice ${invoice}`,message,'PREPARED',0,'',now,'',objectKey,filename,'application/pdf').run();
  await env.DB.prepare('INSERT INTO audit_events(owner_id,actor_email,action,entity_type,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.ownerId,user.email,'SEND_FORMAL_INVOICE','booking',String(id),`Prepared ${invoice} for ${recipient}`,now).run();
  const delivery=await sendOutbox(Number(result.meta.last_row_id),user.organisationId); return NextResponse.json(delivery,{status:delivery.ok?201:202});
}
