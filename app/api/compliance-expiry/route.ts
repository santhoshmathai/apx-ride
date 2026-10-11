import { NextResponse } from 'next/server';
import { collectComplianceItems } from '../../compliance-checks';
import { getPortalPrincipal } from '../../portal-auth';

export async function GET() {
  const user = await getPortalPrincipal();
  if (!user || user.role !== 'OWNER_ADMIN') return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const items = await collectComplianceItems(user.organisationId, user.ownerId);
  return NextResponse.json({ checkedAt: new Date().toISOString(), horizonDays: 183, items });
}
