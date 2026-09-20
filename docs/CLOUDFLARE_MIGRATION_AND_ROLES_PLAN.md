# APX RIDE: Cloudflare migration, solo-admin launch, and future driver access

Status: implementation plan for review; **not a production approval or a claim of council compliance**. Prepared 20 September 2026. No live hosting, DNS, identity or data changes are authorised by this document alone.

## 1. Decision and constraints

- Move the public site and portal from ChatGPT Sites to the owner's own Cloudflare account (Option 1), but only after a verified migration and acceptance tests.
- Initial operation: one APX RIDE business, one Owner/Admin (`apxride.bookings@gmail.com`) who can also drive and dispatch. No Dispatcher role in the first release.
- Expected volume: 60–90 jobs/month. One or two additional drivers may join after roughly six months. Build the data model and permission boundary now; activate driver accounts only when needed.
- Keep each existing test user's data separate. Explicitly designate the production business and migrate only its selected data. No matching, merging or claiming data by email alone.
- No public self-registration for staff. Each person uses their own authenticated account. The bookings mailbox is not a shared staff password.
- Budget target: Cloudflare Workers Paid starts at **US$5/month**, not a guaranteed £5 invoice. Domain renewal, UK tax, usage overages and Resend charges are separate. Configure usage alerts and cost limits; do not promise an absolute cost ceiling.
- Public booking is currently test-only. Hosting migration must not accidentally turn it into a live customer channel.

## 2. Target architecture

```text
Customer browser  -> apxride.com / www.apxride.com -> Cloudflare Pages (public static site)
                    -> api.apxride.com              -> public booking API Worker
                                                        | D1, Resend, bot/rate controls
Resend webhook     -> api.apxride.com/webhooks/resend -> signed webhook endpoint

Staff browser      -> portal.apxride.com -> Cloudflare Access (Google login + MFA)
                                           -> portal Worker (Vinext/React)
                                               | verified Access identity + app membership
                                               | D1 bookings, audit and configuration
                                               | private R2 driver/vehicle documents

Owner-controlled GitHub -> reviewed CI builds -> Cloudflare staging -> approved production
Encrypted off-platform export + periodic restore test <- D1 and R2
```

Do not expose an unprotected `workers.dev` or preview URL for the portal. Prefer Worker-level Access protection and verify all alternate routes. Keep the public API and Resend webhook outside the staff Access application rather than introducing broad bypass paths. The public API is unauthenticated by design but must enforce rate limits, bot challenge, validation and per-request abuse controls. CORS/Origin checks alone are not authentication.

## 3. Identity, business membership and permission model

1. Cloudflare Access authenticates staff with Google accounts (ordinary Gmail is supported). Its policy allows only exact named emails; require independent MFA, preferably passkey/security key with authenticator-app recovery. Use a short, documented session and test access revocation. Email-only PIN is not the primary method.
2. The portal verifies the signed Access JWT on **every protected request** (signature, issuer, audience, expiry). Never trust an incoming email/header without verification. Failure is deny-by-default.
3. `users` uses an immutable internal UUID. `identity_links` maps the verified external provider subject and email to that user. Email changes or a new Google account require an explicit owner-approved relink, not automatic record ownership transfer.
4. `organisations` is the business boundary; `memberships` is `(user_id, organisation_id, role, active)`. Initial roles are `OWNER_ADMIN` and `DRIVER`. One person may be both Owner/Admin and a driver profile. Reserve `DISPATCHER` as a possible future role, but do not build its screens or workflow now.
5. Owner/Admin can manage all of *their* business's bookings, assignment, messaging, finance, invoices, compliance records, staff access and exports. Driver can view and act on only their own assigned jobs. A disabled membership or missing assignment always denies access.
6. Enforce permissions in route handlers and database queries, not merely navigation/UI. Every query must include the organisation boundary; driver job queries must also include the assigned driver identity. Document downloads follow the same rule.
7. Staff onboarding is two controlled steps: add the email to Cloudflare Access and create an active portal membership with the correct role. Both are required. For a handful of staff this can be a documented manual admin process; avoid storing Cloudflare management credentials in the portal solely to automate invites.
8. Offboarding disables membership, removes the Access allowance/revokes sessions, removes future assignments, and logs the action. Preserve historic attribution to that driver.
9. Distinguish the existing booking `operator`/source label from the licensed operator business and from login roles. Rename its UI label or add a separate `booking_source` field so these concepts cannot be confused.

## 4. Business workflow: solo launch and later drivers

### Quote and booking

`REQUEST_RECEIVED -> QUOTED -> CUSTOMER_AGREED (record evidence) -> ACCEPTED/PENDING_ASSIGNMENT -> ASSIGNED -> DRIVER_ACKNOWLEDGED -> EN_ROUTE_PICKUP -> PASSENGER_ON_BOARD -> COMPLETED`

Other outcomes: `UNAVAILABLE`, `CUSTOMER_DECLINED`, `CANCELLED`, `NO_SHOW`, `ASSIGNMENT_DECLINED`, `INCIDENT`. Make transitions explicit and auditable. A quote is not a confirmed ride. The customer's acceptance by email/phone is recorded by the admin, including time and evidence reference. Confirm a journey only when an eligible driver/vehicle and capacity have been checked. Preserve the previous state and actor for every change.

At launch the admin can assign the booking to their own linked driver profile. Later, the admin can offer it to one other driver. Do not silently treat an offer as accepted. If a driver declines, times out or becomes unavailable, flag the job for reassignment and avoid sending an inaccurate driver-confirmation message.

### Assignment and dispatch

- `drivers` and `vehicles` have stable IDs, licensing authority, licence/plate numbers, expiry dates, status and document references. `assignments` links booking, driver, vehicle, assigned-by, accepted-at, declined-at, superseded-at and reason. Keep assignment history.
- Validate driver and vehicle licence/insurance/MOT/availability before dispatch; block expired or inactive records. Warn about overlapping jobs, including configurable travel buffer. Manual override, if ever allowed, needs reason and audit.
- Before the journey, store date/time booking was accepted, scheduled date/time, hirer, pickup, destination, vehicle licence number, driver name/licence number, fare, responder and dispatcher. Record changes without erasing the original event.
- Admin sees Unassigned, Awaiting acknowledgement, Upcoming, En route, In progress, Completed and Exceptions across all jobs; driver sees only My Jobs.
- Driver can acknowledge/decline, navigate, call/message for pickup logistics, mark journey stages, report a no-show/incident/lost property and record payment collection. They cannot independently accept a new private-hire booking, change agreed fare, issue a refund or close a complaint.
- Driver customer contact is limited to the assigned journey and necessary details. Significant messages are logged or summarised; customer service/fare negotiation is escalated to the admin.

### Payment, receipt and invoice

- Store `booking_type` (`CASH` customer-paid vs `ACCOUNT` operator-billed) separately from `payment_method` (`CASH`, `CARD`, or none/pending), collector (`DRIVER`/`BUSINESS`), collection time and settlement/remittance status.
- Driver completion records actual collection or an account-job handoff; it does not by itself mark an account invoice as paid. Admin reconciles driver cash/card collections, account receivables and refunds.
- A customer-requested written receipt can be produced from the completed job in the driver view. A formal invoice is issued/emailed by the admin/business. Both use the same stored fare and payment facts. Track invoice number, issue date, recipient, sent status and correction/credit history; do not regenerate different documents under one reference.
- Preserve the current customer-facing document rules, including not exposing internal calculator breakdown or adding tax/VAT assertions without the business's approved invoicing policy.

## 5. Reigate & Banstead readiness requirements

The current [2024 council conditions](https://www.reigate-banstead.gov.uk/download/downloads/id/544/private_hire_vehicles_drivers_and_operators_policy_and_conditions_2024.pdf) require a staff register for booking/dispatch personnel, booking particulars recorded before each journey, and booking records retained for 12 months from the journey. Required booking particulars include booking and journey times, hirer, pickup, destination, vehicle licence number, driver name/licence number, fare, responder and dispatcher. They also specify driver and vehicle registers, document copies, complaints and lost-property procedures, and a written receipt from the driver on request. The licensed operator remains contractually responsible for accepted jobs even when another person supplies the vehicle.

Implementation/evidence checklist:

- Validate licence authority compatibility with the council before assigning other drivers or vehicles; record licensing authority and licence numbers. Confirm arrangements involving another *licensed operator/business* separately before supporting subcontracting. Do not confuse additional drivers under APX RIDE with subcontracted operators.
- Register staff who accept/dispatch bookings and their role, start/end dates and training acknowledgement. Preserve actor identity on booking and dispatch events.
- Retain booking records at least 12 months from journey date; preserve appropriate driver/vehicle records at least 12 months after they cease availability, and complaint/lost-property records per council conditions. Design configurable retention for other categories rather than blindly deleting at 12 months.
- Maintain licence/MOT/insurance expiry checks and original protected documents, with access restricted to admin. Produce council-readable exports including the required identifiers and event history.
- Maintain written complaints, lost-property, safeguarding, incident escalation and accessibility/assistance-dog procedures outside the code as well as portal registers. Train anyone given driver/staff access.
- Recheck the operative council policy at release time and ask the Licensing Officer to confirm any uncertain driver/vehicle affiliation, subcontracting, document or invoice expectations. Consultation proposals are not binding conditions until adopted.

These controls assist compliance but software alone cannot guarantee a licence or UK GDPR compliance. The operator must confirm legal entity, privacy notice, lawful bases, data retention, ICO-fee position, processor agreements, breach process and training. See existing `COUNCIL_READINESS.md` and `DATA_PROTECTION_CHECKLIST.md`, which must be reconciled with the new implementation (some statements there describe older behaviour).

## 6. Source control and environment preparation

- Portal GitHub source is the `portal/` repository; create feature branch `codex/cloudflare-portal-migration` and make incremental reviewable commits. Do not push or merge to production as a side effect of planning.
- Public website originated in a **separate local Git repository without a GitHub remote**. Its current static HTML/CSS/JavaScript and image assets are now imported into this GitHub repository under `website/`; the original local repository remains untouched. Before production CI, review source ownership and treat `website/` as the maintained source, not an unreviewed Sites-generated archive. No nested `.git` or Sites hosting metadata is included.
- Use separate staging and production Workers, D1 databases, R2 buckets, Access applications, secrets, Resend webhook endpoints and DNS names. Keep production customer data out of staging; use synthetic fixtures.
- Pin dependency versions, run build/tests in CI, require approval for production deploys and document rollback. Secrets live in Cloudflare, not GitHub or the repository.

## 7. Data migration and backup, before DNS cutover

1. Inventory every production table and object. The current JSON backup omits some supporting tables and **R2 file contents**; extend export to cover them and manifest versions/checksums. Keep a copy of existing migration files.
2. Determine whether the ChatGPT Sites-managed D1/R2 resources can be exported directly under the owner's account. If not, use authenticated paginated application-level export and protected file download. Never assume Wrangler can reach a Sites-managed database.
3. Take encrypted, access-controlled copies; verify row counts, key relationships and object hashes. Build a restore/import command that can be rehearsed repeatedly into an empty staging database and bucket.
4. Explicitly map old ChatGPT IDs to new internal users and organisations. Keep all other tester datasets separate. Protect personal data in migration logs; no credentials or document contents in CI output.
5. Test import on synthetic and selected real records under restricted access: bookings, public requests, fare/settings, expense ledger, messages, compliance records, document downloads, audit events and email-outbox statuses. Avoid re-sending old emails during import.
6. Define daily encrypted off-platform backup of D1 + R2, retention and monthly restore drill. Cloudflare D1 Time Travel is useful but **not** a substitute for an independent full backup. Document recovery owner, target recovery time and last successful restore.

## 8. Security and public-booking launch controls

- Portal: Access + MFA; verified JWT in app; default-deny membership; server-side role/organisation checks; safe session and logout; CSRF protection for state-changing browser routes; security headers; audit for login/permission/booking/finance changes.
- Public API: keep current test-email restriction until separate launch approval; then add bot challenge, rate limiting, request-size limits, strict validation, honeypot/abuse monitoring and generic errors. Origin/CORS rules supplement, not replace, these controls.
- Resend: keep domain/SPF/DKIM/DMARC configuration; rotate/copy API key into new Cloudflare secrets without exposing it; verify webhook signatures and idempotency; handle retry, bounce and failed delivery; send a copy to the bookings mailbox where appropriate. Prevent duplicate customer emails at cutover.
- Data: private R2 bucket; malware/content-type validation and <=1 MB policy for uploaded PDFs/images; no publicly guessable document URLs; encrypt backups; no card numbers or sensitive medical details in free-text notes.
- Privacy: minimise driver-visible passenger data, document retention and deletion rules, restrict data exports, audit access reviews, and inspect Cloudflare/Resend processor terms and international-transfer implications with the business's adviser.

## 9. Step-by-step delivery and acceptance gates

| Stage | Deliverable | Gate before next stage |
|---|---|
| 0. Baseline | Freeze inventory, architecture decision record, feature branch, representative test fixtures, current data counts | Owner identifies production data set; no existing data altered |
| 1. CI + staging | GitHub-owned build/deploy pipeline; Cloudflare staging Pages/Workers/D1/R2; secrets separated | Staging builds reproducibly, with no live DNS or production data |
| 2. Identity + roles | Access Google+MFA; JWT verification; internal users/memberships; Owner/Admin + Driver capability matrix; revoke path | Forged/missing token, wrong user/organisation, disabled user all fail |
| 3. Business boundary + migration | Organisation keys throughout API; complete export/import incl. documents; identity mapping | Counts, relationships, hashes and per-user isolation verified in restore drill |
| 4. Solo-admin operations | Admin linked to own driver profile; booking/assignment workflow; licence gates; receipts/invoice/collections | End-to-end 60–90-jobs/month scenario and council record export verified |
| 5. Future-driver capability | Restricted My Jobs screen/API, acknowledgement, status, contact and exception flows; leave additional accounts disabled until hired | Driver cannot read/edit other jobs, finance, settings or documents |
| 6. Public API + email | Separate public API/webhook, test mode retained, Resend secrets, abuse controls, notification monitoring | Form and email flows pass; test restriction cannot be bypassed |
| 7. Operational readiness | Independent backup/restore, runbooks, alerts, access review, privacy/council evidence | Restore test, incident rehearsal and owner acceptance documented |
| 8. Cutover | Final export after brief write freeze; import/diff; DNS switch; smoke test; rollback window | Owner explicitly approves cutover; old deployment remains recoverable |

Testing must include: admin assigning self; admin assigning a second driver; decline/reassignment; overlapping jobs; expired licence/insurance; quoted-but-not-accepted booking; no-show/cancel; cash/card/account settlement; written receipt; invoice correction; document denial; old-user isolation; email failure/retry; backups; mobile driver flow; and direct requests to alternate URLs. Use synthetic customer details in routine tests.

## 10. Cost and scope controls

- Official Cloudflare [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) currently lists Paid at **US$5/month minimum**; D1/R2 have included allowances and usage charges above them. Cloudflare Access [has a free plan for up to 50 users](https://www.cloudflare.com/plans/zero-trust-services/). Resend [has a free transactional tier](https://resend.com/pricing/) with limits. Confirm these at purchase and set billing alerts.
- This estimate is credible for 60–90 jobs/month and small file volumes, but no platform offers an unconditional £5/month cap including tax, domain and email. Avoid optional paid products until justified; measure real requests, rows, storage and email volume after launch.
- The cost of development, data migration, compliance preparation and ongoing maintenance is **not** included in the hosting figure.
- Do not implement a separate Dispatcher role, multi-operator marketplace, live GPS tracking, payment-card processing, automatic subcontracting or mobile native app in this delivery. Leave extension points for future growth.

## 11. Decisions to confirm before live migration

1. Which existing account's records are the production data set? Proposed owner is `apxride.bookings@gmail.com`; other test accounts stay separate.
2. Is the business operating only with drivers and vehicles licensed compatibly with the Reigate & Banstead operator licence? Confirm edge cases with the Council.
3. What legal business name, address and receipt/invoice issuer details should be printed? Is there an approved tax/VAT treatment? Do not infer this from the current PDF template.
4. Who is the recovery administrator if the sole owner loses Google/Cloudflare access? Recovery must use a separately protected account and documented procedure.
5. What backup retention, privacy notice and customer-data retention schedule does the business approve?
6. What date and acceptance evidence will authorise public bookings and the final DNS cutover?

## Primary references

- [Reigate & Banstead private hire vehicles, drivers and operators policy and conditions (2024)](https://www.reigate-banstead.gov.uk/download/downloads/id/544/private_hire_vehicles_drivers_and_operators_policy_and_conditions_2024.pdf)
- [Reigate & Banstead taxi/private-hire licensing](https://www.reigate-banstead.gov.uk/taxi-private-hire-licensing)
- [Cloudflare Workers/Vinext deployment](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare independent MFA](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/)
- [ICO data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)
- [ICO data security](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/)
