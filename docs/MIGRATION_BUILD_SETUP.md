# Cloudflare migration build: first implementation step

The `codex/cloudflare-portal-migration` branch can now compile the portal without the ChatGPT Sites Vite plugin by running `pnpm run build:cloudflare`. The existing `pnpm run build` path remains unchanged for the current live Sites deployment. The GitHub Action `.github/workflows/migration-build.yml` checks both builds and the static public website; it does **not** deploy anything or require a Cloudflare credential.

The Cloudflare build is **not ready to deploy**. Its local D1 ID is a placeholder (`00000000-0000-4000-8000-000000000000`) and its D1/R2 resource names are preview placeholders inherited from the existing Sites development config. No independent production database, bucket, Access protection or data migration exists yet. Do not upload the generated `dist/server` bundle or point `portal.apxride.com` to it.

Before connecting GitHub to Cloudflare Workers Builds or Pages, complete these gates:

1. Create separate staging D1/R2 resources in the business-owned Cloudflare account and substitute their real binding IDs/names through a reviewed Wrangler configuration. Keep production resources separate.
2. Implement and test independent staff authentication, signed Access identity validation, memberships and server-side role checks. Protect all Worker URLs, including previews.
3. Complete and verify the full data-and-document export/import. Use synthetic data in staging; do not connect current live D1/R2 to an unfinished Worker.
4. Separate the public booking API and Resend webhook from the Access-protected portal, then test abuse controls and email flow.
5. Only after acceptance, configure Cloudflare's Git integration with distinct staging and production branches and explicit approval for production deployment.

For the public site, use `website/` as the Cloudflare Pages root/output directory when the migration reaches deployment. It needs no build command. Its current booking form still targets the test-only portal endpoint and will be changed with the public API cutover.

The full staged plan and release gates are in `CLOUDFLARE_MIGRATION_AND_ROLES_PLAN.md`.
