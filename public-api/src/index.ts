interface Env { PORTAL: Fetcher; BOOKING_LIMITER: RateLimit; TURNSTILE_SECRET: string; EXPECTED_HOSTNAME: string; ENVIRONMENT: string }
const origins=new Set(['https://apxride.com','https://www.apxride.com','https://apx-ride.hellosanthoshmathai.chatgpt.site']);
const cors=(origin:string)=>({'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin','cache-control':'no-store','x-content-type-options':'nosniff'});
const json=(origin:string,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'content-type':'application/json'}});
export default { async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url); const origin=request.headers.get('origin')||'';
  if(url.pathname!=='/api/public-booking-requests')return new Response('Not found',{status:404});
  if(!origins.has(origin))return new Response('Forbidden',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='POST')return json(origin,{error:'Method not allowed'},405);
  const contentType=request.headers.get('content-type')||''; if(!contentType.toLowerCase().startsWith('application/json'))return json(origin,{error:'Invalid request format'},415);
  const raw=await request.text(); if(raw.length>12000)return json(origin,{error:'Request is too large'},413);
  let body:Record<string,unknown>; try{body=JSON.parse(raw) as Record<string,unknown>;}catch{return json(origin,{error:'Invalid request format'},400);}
  const token=typeof body.turnstileToken==='string'?body.turnstileToken:''; if(!token||token.length>2048)return json(origin,{error:'Please complete the security check'},400);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():''; const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const limited=await env.BOOKING_LIMITER.limit({key:`${ip}:${email.slice(0,120)}`}); if(!limited.success)return json(origin,{error:'Too many requests. Please wait before trying again.'},429);
  const verify=new FormData(); verify.set('secret',env.TURNSTILE_SECRET); verify.set('response',token); verify.set('remoteip',ip); verify.set('idempotency_key',crypto.randomUUID());
  const checked=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:verify}); const result=await checked.json() as {success?:boolean;hostname?:string};
  if(!checked.ok||!result.success)return json(origin,{error:'Security verification failed. Please refresh and try again.'},400);
  if(env.ENVIRONMENT!=='staging'&&result.hostname&&![env.EXPECTED_HOSTNAME,`www.${env.EXPECTED_HOSTNAME}`].includes(result.hostname))return json(origin,{error:'Security verification hostname mismatch'},400);
  delete body.turnstileToken;
  const upstream=new Request('https://portal-staging.apxride.com/api/public-booking-requests',{method:'POST',headers:{'content-type':'application/json','origin':origin,'x-apx-public-gateway':'staging'},body:JSON.stringify(body)});
  const response=await env.PORTAL.fetch(upstream); const headers=new Headers(response.headers); Object.entries(cors(origin)).forEach(([key,value])=>headers.set(key,value)); return new Response(response.body,{status:response.status,headers});
} } satisfies ExportedHandler<Env>;
