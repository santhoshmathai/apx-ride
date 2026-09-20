import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getPortalAdmin } from '../../portal-auth';

async function owner() {
  const user = await getPortalAdmin();
  if (!user)
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    };
  return { id: user.userId };
}

export async function GET() {
  const auth = await owner();
  if (auth.error) return auth.error;
  const result = await env.DB.prepare(
    'SELECT * FROM expenses WHERE owner_id=? ORDER BY expense_date DESC, id DESC',
  )
    .bind(auth.id)
    .all();
  return NextResponse.json(result.results);
}

export async function POST(req: Request) {
  const auth = await owner();
  if (auth.error) return auth.error;
  const body = (await req.json()) as {
    date: string;
    category: string;
    amount: number;
    driverCallSign?: string;
    notes?: string;
  };
  const result = await env.DB.prepare(
    'INSERT INTO expenses(owner_id,expense_date,category,driver_call_sign,amount,notes,created_at) VALUES(?,?,?,?,?,?,?)',
  )
    .bind(
      auth.id,
      body.date,
      body.category,
      body.driverCallSign || '',
      body.amount,
      body.notes || '',
      new Date().toISOString(),
    )
    .run();
  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await owner();
  if (auth.error) return auth.error;
  const id = Number(new URL(req.url).searchParams.get('id'));
  await env.DB.prepare('DELETE FROM expenses WHERE id=? AND owner_id=?')
    .bind(id, auth.id)
    .run();
  return NextResponse.json({ ok: true });
}
