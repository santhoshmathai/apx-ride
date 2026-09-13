import { AppShell } from './app-shell';
import { chatGPTSignOutPath, isApprovedEmail, requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');

  if (!isApprovedEmail(user.email)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-cyan-400">APX Ride Portal</p>
          <h1 className="text-3xl font-bold">Access not approved</h1>
          <p className="mt-4 leading-7 text-slate-300">
            The ChatGPT account <strong className="text-white">{user.email}</strong> is not on the tester list.
            Ask the portal owner to approve this exact email address.
          </p>
          <a className="mt-6 inline-flex rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950" href={chatGPTSignOutPath('/')}>Sign out</a>
        </section>
      </main>
    );
  }

  return <AppShell signOutPath={chatGPTSignOutPath('/')} />;
}
