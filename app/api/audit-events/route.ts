import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { cloudflareAuthEnabled, getPortalPrincipal } from '../../portal-auth';

export async function GET(){if(!cloudflareAuthEnabled())return NextResponse.json({error:'Not available'},{status:404});const user=await getPortalPrincipal();if(!user||user.role!=='OWNER_ADMIN')return NextResponse.json({error:'Access denied'},{status:403});const rows=await env.DB.prepare('SELECT id,actor_email,action,entity_type,entity_id,summary,created_at FROM audit_events WHERE owner_id=? ORDER BY id DESC LIMIT 200').bind(user.ownerId).all();return NextResponse.json(rows.results)}
