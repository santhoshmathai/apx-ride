# APX RIDE staging security and operations

This document separates controls implemented in source from account-level controls that must be completed in Cloudflare or Resend before production.

## Implemented in this checkpoint

- The public browser posts to a dedicated public gateway (`api-staging.apxride.com`), not to the Access-protected portal hostname.
- The gateway uses an explicit origin allowlist, request-size limit, Cloudflare Turnstile validation and a five-requests-per-minute rate-limit binding before a service-binding request reaches the portal.
- The portal and gateway disable `workers.dev` and version preview URLs.
- Mutation routes reject cross-site browser requests; Access still authenticates portal users and server-side role checks remain authoritative.
- Portal responses include HSTS, clickjacking, MIME-sniffing, referrer, permissions and content-security headers.
- Compliance uploads are private R2 objects and are limited by size, declared MIME type, filename sanitisation and PDF/PNG/JPEG file signatures.
- Resend webhooks use timestamped HMAC verification, event de-duplication, bounce/complaint/failure states, and delayed-delivery retry scheduling.
- The Admin JSON export now contains staff, drivers, vehicles, availability, assignments, assignment history and delivery events in addition to the earlier business data.
- The D1 backup and isolated restore-test scripts are in `scripts/`. Backup output is deliberately ignored by Git.

## Required before production cutover

1. Create a real Turnstile widget for `apxride.com`; store its secret with `wrangler secret put TURNSTILE_SECRET`, set the production site key in the public site, and remove the published test keys.
2. Change the public booking route from restricted test mode to production only after the real Turnstile key, legal privacy wording and notification sender domain have been approved.
3. Configure the Resend webhook endpoint as `https://portal.apxride.com/api/notifications/webhook`, subscribe to sent, delivered, delayed, bounced, complained, failed and suppressed events, and store the signing secret as `RESEND_WEBHOOK_SECRET`.
4. Schedule processing of due notification retries. Until a protected scheduled Worker is deployed, the Admin must use **Process due notifications**; delayed messages are durable but are not sent automatically merely by setting `next_attempt_at`.
5. Create Cloudflare notifications for Worker errors, high error rate, D1 usage, R2 usage and monthly billing. Set a conservative billing threshold and a second escalation threshold.
6. Create an independent encrypted destination outside this Cloudflare account. Run `scripts/backup-staging.ps1` daily and sync the private R2 bucket through its S3-compatible API. Do not enable an R2 public development URL or custom public domain.
7. Run `scripts/restore-test-staging.ps1` monthly against the newest D1 export. Inspect record counts, retain recovery evidence, then delete the isolated restore database in the Cloudflare dashboard.
8. Test offboarding with a test Driver: disable in the portal, remove the exact address from Access, confirm existing attribution remains, and confirm new assignments and login are blocked.
9. Test phone layouts for Admin and Driver at 320, 375, 390 and 430 CSS pixels, including navigation, job actions, receipt and compliance status.
10. Export the Admin backup and council compliance registers, confirm readable content, and approve a written retention schedule. Software must not invent legal retention periods; the operator must document the purpose and period for each record class.

## R2 backup limitation

Wrangler exports D1 but does not provide a bucket-wide R2 download command. Use an S3-compatible backup tool with a narrowly scoped R2 token to copy `apx-ride-staging-documents` to encrypted storage controlled independently from this Cloudflare account. Never commit S3/R2 credentials, customer documents, database exports or manifests containing personal data.
