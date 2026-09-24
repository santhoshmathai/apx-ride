# Cloudflare migration build: first implementation step

The `codex/cloudflare-portal-migration` branch can now compile the portal without the ChatGPT Sites Vite plugin by running `pnpm run build:cloudflare`. The existing `pnpm run build` path remains unchanged for the current live Sites deployment. The GitHub Action `.github/workflows/migration-build.yml` checks both builds and the static public website; it does **not** deploy anything or require a Cloudflare credential.

The Cloudflare build is **not ready for production**. Staging D1 `apx-ride-staging` (`06ebd43e-b555-4a7b-b763-e4f3a07412ba`) and the private EU-jurisdiction R2 bucket `apx-ride-staging-documents` are provisioned and bound in the independent build. The current Sites build remains on its existing generated bindings. No production resource is configured, and `portal.apxride.com` must not be moved yet.

Before connecting GitHub to Cloudflare Workers Builds or Pages, complete these gates:

1. Create the staging Access application for `portal-staging.apxride.com`, allow only the exact production-admin test email through the tested Google identity provider, and copy its audience tag into the Worker binding. Protect every alternate Worker/preview URL before any realistic data is loaded.
2. Apply all migrations to the staging D1 and provision the one staging Owner/Admin mapping. Test signed Access identity validation, memberships and server-side role checks with synthetic data.
3. Complete and verify the full data-and-document export/import. Use synthetic data in staging; do not connect current live D1/R2 to an unfinished Worker.
4. Separate the public booking API and Resend webhook from the Access-protected portal, then test abuse controls and email flow.
5. Only after acceptance, configure Cloudflare's Git integration with distinct staging and production branches and explicit approval for production deployment.

For the public site, use `website/` as the Cloudflare Pages root/output directory when the migration reaches deployment. It needs no build command. Its current booking form still targets the test-only portal endpoint and will be changed with the public API cutover.

The full staged plan and release gates are in `CLOUDFLARE_MIGRATION_AND_ROLES_PLAN.md`.
