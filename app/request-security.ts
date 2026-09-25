export function validMutationOrigin(req: Request) {
  if (['GET','HEAD','OPTIONS'].includes(req.method.toUpperCase())) return true;
  const origin=req.headers.get('origin'); const expected=new URL(req.url).origin;
  if(origin&&origin!==expected)return false;
  const site=req.headers.get('sec-fetch-site');
  return site!=='cross-site';
}
