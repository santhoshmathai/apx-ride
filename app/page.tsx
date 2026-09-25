import { AppShell } from './app-shell';
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser, isApprovedEmail } from './chatgpt-auth';
import { cloudflareAccessLogoutUrl, cloudflareAuthEnabled, getPortalPrincipal } from './portal-auth';
import { DriverDashboard } from './driver-dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (cloudflareAuthEnabled()) {
    const signOutPath = cloudflareAccessLogoutUrl();
    const principal = await getPortalPrincipal();
    if (!principal) return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100"><section className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8"><h1 className="text-2xl font-bold">Access not approved</h1><p className="mt-4 text-slate-300">Sign in with your approved Cloudflare Access identity. If this is your first login, ask the APX RIDE owner to provision your exact email address.</p><a className="mt-6 inline-block text-amber-300 underline" href={signOutPath}>Sign out and try another account</a></section></main>;
    if (principal.role === 'DRIVER') return <DriverDashboard user={principal} signOutPath={signOutPath} />;
    return <AppShell signOutPath={signOutPath} />;
  }
  const user = await getChatGPTUser();
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100"><section className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 p-8 text-center shadow-2xl"><img src="/apx-logo.png" alt="APX RIDE" className="mx-auto mb-5 h-28 w-28 rounded-full" /><p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-400">Elevate Every Mile</p><h1 className="mt-3 text-3xl font-bold">APX RIDE Portal</h1><p className="mt-4 leading-7 text-slate-300">Secure access for approved APX RIDE team members. Each person signs in with their own account so access can be reviewed individually.</p><a className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950" href={chatGPTSignInPath('/')}>Continue securely with ChatGPT</a><p className="mt-4 text-xs text-slate-500">Authorised users only · Access is protected and auditable</p></section></main>;
  }
  if (!isApprovedEmail(user.email)) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100"><section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl"><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-cyan-400">APX Ride Portal</p><h1 className="text-3xl font-bold">Access not approved</h1><p className="mt-4 leading-7 text-slate-300">The ChatGPT account <strong className="text-white">{user.email}</strong> is not on the tester list. Ask the portal owner to approve this exact email address.</p><a className="mt-6 inline-flex rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950" href={chatGPTSignOutPath('/')}>Sign out</a></section></main>;
  }
  return <AppShell signOutPath={chatGPTSignOutPath('/')} />;
}
