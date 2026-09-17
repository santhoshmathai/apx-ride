import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser, isApprovedEmail } from '../../chatgpt-auth';
async function authorised() { const user = await getChatGPTUser(); return user && isApprovedEmail(user.email) ? user : null; }
export async function POST(req: Request) { const user = await authorised(); if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 }); const form = await req.formData(); const file = form.get('file'); const recordId = Number(form.get('recordId')); const fieldNameValue = form.get('fieldName'); const fieldName = typeof fieldNameValue === 'string' ? fieldNameValue : 'document'; if (!(file instanceof File) || !recordId || !file.size || file.size > 1_000_000) return NextResponse.json({ error: 'A valid PDF, JPG or PNG file up to 1 MB is required' }, { status: 400 }); const record = await env.DB.prepare('SELECT id FROM compliance_records WHERE id=? AND owner_id=?').bind(recordId, user.userId).first(); if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 }); const allowed = ['application/pdf','image/jpeg','image/png']; if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Only PDF, JPG and PNG files are accepted' }, { status: 400 }); const key = `${user.userId}/records/${recordId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } }); const result = await env.DB.prepare('INSERT INTO compliance_documents(owner_id,record_id,field_name,file_name,content_type,object_key,uploaded_at) VALUES(?,?,?,?,?,?,?)').bind(user.userId, recordId, fieldName, file.name, file.type, key, new Date().toISOString()).run(); return NextResponse.json({ id: result.meta.last_row_id, fileName: file.name }, { status: 201 }); }
export async function GET(req: Request) {
  const user = await authorised();
  if (!user) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const url = new URL(req.url);
  const recordId = Number(url.searchParams.get('recordId'));
  if (recordId) {
    const record = await env.DB.prepare('SELECT id FROM compliance_records WHERE id=? AND owner_id=?').bind(recordId, user.userId).first();
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    const documents = await env.DB.prepare('SELECT id,field_name,file_name,content_type,uploaded_at FROM compliance_documents WHERE record_id=? AND owner_id=? ORDER BY uploaded_at DESC').bind(recordId, user.userId).all();
    return NextResponse.json(documents.results);
  }
  const id = Number(url.searchParams.get('id'));
  const row = await env.DB.prepare('SELECT * FROM compliance_documents WHERE id=? AND owner_id=?').bind(id, user.userId).first<{ object_key: string; file_name: string; content_type: string }>();
  if (!row) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  const object = await env.BUCKET.get(row.object_key);
  if (!object) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  const disposition = url.searchParams.get('preview') === '1' ? 'inline' : 'attachment';
  return new NextResponse(object.body, { headers: { 'content-type': row.content_type, 'content-disposition': `${disposition}; filename="${row.file_name.replaceAll('"','')}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
