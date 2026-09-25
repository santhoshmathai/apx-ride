import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { getChatGPTUser, isApprovedEmail } from './chatgpt-auth';

export type PortalRole = 'OWNER_ADMIN' | 'DRIVER';
export type PortalPrincipal = {
  userId: string;
  ownerId: string;
  organisationId: string;
  email: string;
  displayName: string;
  role: PortalRole;
};

type StaffRow = { id: string; owner_id: string; organisation_id: string; email: string; role: string; access_subject: string | null; last_login_at: string | null; active: number };
type AccessClaims = { sub: string; email: string; aud: string[]; iss: string; exp: number; nbf?: number; iat?: number };

export function cloudflareAuthEnabled(): boolean {
  return __APX_CLOUDFLARE_BUILD__ || env.APX_AUTH_MODE === 'cloudflare';
}

function decodeSegment(segment: string): unknown {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - segment.length % 4) % 4);
  return JSON.parse(atob(padded));
}

function validTeamDomain(value: string): string | null {
  try {
    const url = new URL(value.startsWith('https://') ? value : `https://${value}`);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudflareaccess.com') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
    return url.origin;
  } catch { return null; }
}

export function cloudflareAccessLogoutUrl(): string {
  // Use the application-domain endpoint. Cloudflare revokes the Access session
  // from either endpoint, but this one also removes the portal cookie
  // immediately instead of waiting for token revocation to propagate.
  return '/cdn-cgi/access/logout';
}

async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  const issuer = validTeamDomain(env.CF_ACCESS_TEAM_DOMAIN || '');
  const audience = env.CF_ACCESS_AUD;
  if (!issuer || !audience || token.length > 16000) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = decodeSegment(parts[0]) as { alg?: string; kid?: string };
    const claims = decodeSegment(parts[1]) as Partial<AccessClaims>;
    if (header.alg !== 'RS256' || !header.kid || claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) || !claims.sub || !claims.email || typeof claims.exp !== 'number') return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now || (claims.nbf && claims.nbf > now + 60) || (claims.iat && claims.iat > now + 60)) return null;
    const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
    if (!response.ok) return null;
    const keys = await response.json() as { keys?: (JsonWebKey & { kid?: string; alg?: string; use?: string })[] };
    const jwk = keys.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[2].length % 4) % 4)), (char) => char.charCodeAt(0));
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)) return null;
    return claims as AccessClaims;
  } catch { return null; }
}

export async function getPortalPrincipal(): Promise<PortalPrincipal | null> {
  if (!cloudflareAuthEnabled()) {
    const user = await getChatGPTUser();
    if (!user || !isApprovedEmail(user.email)) return null;
    return { userId: user.userId, ownerId: user.userId, organisationId: `org_${user.userId}`, email: user.email, displayName: user.displayName, role: 'OWNER_ADMIN' };
  }

  const token = (await headers()).get('cf-access-jwt-assertion');
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  const email = claims.email.trim().toLowerCase();
  const staff = await env.DB.prepare('SELECT id,owner_id,organisation_id,email,role,access_subject,last_login_at,active FROM portal_staff WHERE email=? AND active=1').bind(email).first<StaffRow>();
  if (!staff || (staff.role !== 'OWNER_ADMIN' && staff.role !== 'DRIVER') || (staff.access_subject && staff.access_subject !== claims.sub)) return null;
  if (!staff.access_subject) {
    const loginAt = new Date((claims.iat || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const result = await env.DB.prepare('UPDATE portal_staff SET access_subject=?,last_login_at=?,updated_at=? WHERE id=? AND access_subject IS NULL AND active=1').bind(claims.sub, loginAt, new Date().toISOString(), staff.id).run();
    if (result.meta.changes !== 1) return null;
  } else if (claims.iat) {
    const loginAt = new Date(claims.iat * 1000).toISOString();
    await env.DB.prepare("UPDATE portal_staff SET last_login_at=? WHERE id=? AND active=1 AND (last_login_at IS NULL OR last_login_at < ?)").bind(loginAt, staff.id, loginAt).run();
  }
  return { userId: staff.id, ownerId: staff.owner_id, organisationId: staff.organisation_id, email, displayName: email, role: staff.role };
}

// Existing administrative APIs use the legacy owner key, preserving all records.
// A DRIVER never receives this principal, even with a valid Access login.
export async function getPortalAdmin() {
  const principal = await getPortalPrincipal();
  if (!principal || principal.role !== 'OWNER_ADMIN') return null;
  return { userId: principal.ownerId, email: principal.email, displayName: principal.displayName, fullName: null };
}
