# Cloudflare migration build: first implementation step

## Verified staging checkpoint — 25 September 2026

- `portal-staging.apxride.com` is deployed behind the `APX RIDE Portal Staging` Access application.
- Unauthenticated requests receive a Cloudflare Access redirect; `workers.dev` and preview URLs are disabled.
- Google authentication succeeded for the exact allow-listed `apxride.bookings@gmail.com` identity, and its signed Access subject is bound to the active synthetic `OWNER_ADMIN` staging membership.
- Migrations `0000` through `0009` were applied to EU-jurisdiction D1 `apx-ride-staging`; the private EU R2 bucket is bound.
- Verification after login found zero bookings, expenses, and compliance documents. No Sites production/test data has been imported or merged.
- This confirms the authentication path, not Driver isolation or production readiness. Driver testing requires a separately provisioned staging identity and must follow the role-boundary checks in `AUTH_AND_ROLES_IMPLEMENTATION.md`.

The `codex/cloudflare-portal-migration` branch can now compile the portal without the ChatGPT Sites Vite plugin by running `pnpm run build:cloudflare`. The existing `pnpm run build` path remains unchanged for the current live Sites deployment. The GitHub Action `.github/workflows/migration-build.yml` checks both builds and the static public website; it does **not** deploy anything or require a Cloudflare credential.

The Cloudflare build is **not ready for production**. Staging D1 `apx-ride-staging` (`06ebd43e-b555-4a7b-b763-e4f3a07412ba`) and the private EU-jurisdiction R2 bucket `apx-ride-staging-documents` are provisioned and bound in the independent build. The staging Access application uses team domain `apxride-portal.cloudflareaccess.com` and its pinned audience tag. The staging deployment disables `workers.dev` and preview URLs and uses only `portal-staging.apxride.com`, preventing an alternate-hostname Access bypass. The current Sites build remains on its existing generated bindings. No production resource is configured, and `portal.apxride.com` must not be moved yet.

Before connecting GitHub to Cloudflare Workers Builds or Pages, complete these gates:

1. Apply all migrations to the staging D1 and provision the one staging Owner/Admin mapping. Test signed Access identity validation, memberships and server-side role checks with synthetic data.
2. Deploy only to the Access-protected staging hostname and verify that `workers.dev` and preview URLs remain unavailable before any realistic data is loaded.
3. Complete and verify the full data-and-document export/import. Use synthetic data in staging; do not connect current live D1/R2 to an unfinished Worker.
4. Separate the public booking API and Resend webhook from the Access-protected portal, then test abuse controls and email flow.
5. Only after acceptance, configure Cloudflare's Git integration with distinct staging and production branches and explicit approval for production deployment.

For the public site, use `website/` as the Cloudflare Pages root/output directory when the migration reaches deployment. It needs no build command. Its current booking form still targets the test-only portal endpoint and will be changed with the public API cutover.

The full staged plan and release gates are in `CLOUDFLARE_MIGRATION_AND_ROLES_PLAN.md`.
