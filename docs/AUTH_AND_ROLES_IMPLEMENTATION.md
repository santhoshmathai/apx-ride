# Cloudflare login and staff-role implementation

This branch implements the authentication and permission foundation, not a production cutover. The live ChatGPT Sites portal and its data are unchanged. Do not deploy the independent build until the staging D1/R2, public API split, data import, and acceptance gates in the migration plan are complete.

## What is enforced

- The independent Cloudflare build always uses Cloudflare Access authentication. A missing configuration cannot fall back to ChatGPT header login.
- Every protected request verifies the `Cf-Access-Jwt-Assertion` RS256 signature against the configured Cloudflare Access team's JWKs, with pinned issuer, application audience and expiry. The email and subject are read only from the verified token. A valid Access login by itself gives no portal access.
- A separate, active `portal_staff` row with the exact verified email is required. Its Access subject is bound on first successful login and cannot be silently rebound. Disable the row to revoke portal permissions, and also remove the person from the Access policy/revoke their Access session.
- `OWNER_ADMIN` keeps the existing `owner_id` mapping and can use all current administrative APIs. `DRIVER` is denied by those APIs and sees only assigned jobs through `/api/my-jobs` and the My Jobs page. Drivers cannot change bookings, fares, records, messages, finances or staff.
- Only an Owner/Admin can provision or disable a driver via `/api/staff`, list eligible drivers or assign/unassign an active booking via `/api/assignments`. Both operations are scoped to the same owner/organisation; membership and assignment actions are audited. The owner cannot change their own role through these endpoints.
- The current `operator` booking field remains a booking-source label. It is not an authorisation role.

## One-time staging setup (do not run against live Sites data)

1. Create a staging Cloudflare Access self-hosted application covering the entire portal hostname and every alternate Worker hostname, with an exact-email allow policy. Require Google identity and MFA. Do not make `workers.dev` or preview deployments a bypass.
2. Apply Drizzle migration `0009_freezing_nekra.sql` to the staging D1 after the earlier migrations. Back up and verify the production export before any later production migration. The migration adds only a staff table and nullable driver-assignment column; it does not rewrite bookings.
3. Set `CF_ACCESS_TEAM_DOMAIN` to the exact team domain (for example `example.cloudflareaccess.com`) and `CF_ACCESS_AUD` to the Access application's audience tag as Worker runtime bindings. Keep them out of the public client bundle. The independent build selects Cloudflare auth even if `APX_AUTH_MODE` was accidentally omitted.
4. Determine the production owner's existing `owner_id` from a reviewed, owner-approved export of the correct `apxride.bookings@gmail.com` business. Do not derive it from an email, guess it, or select another tester's data. Determine its corresponding `organisation_id` (`org_<existing owner_id>` in the current schema). Insert precisely one owner row into the new D1 using parameterised administration tooling, with a fresh UUID `id`, exact lower-case email, role `OWNER_ADMIN`, active `1`, and `access_subject` null. Example values below are placeholders, not runnable credentials:

   ```sql
   INSERT INTO portal_staff
     (id, organisation_id, owner_id, email, role, access_subject, active, created_at, updated_at)
   VALUES
     ('<new UUID>', 'org_<verified legacy owner ID>', '<verified legacy owner ID>',
      'apxride.bookings@gmail.com', 'OWNER_ADMIN', NULL, 1, '<UTC timestamp>', '<UTC timestamp>');
   ```

5. Allow this exact email in Access, then sign in on staging. The first verified login binds the Access subject to that pre-provisioned membership. No account, organisation, or ownership is created merely because someone has a Gmail or Access login.
6. Provision any future driver with the admin-only `POST /api/staff` using their exact email, then separately allow that email in Access. A driver must use their own identity. Assign a booking through `POST /api/assignments` only after verifying licence, vehicle, insurance and availability through the later business-workflow step.

## Staging acceptance checks

- Correct owner login can see only the selected legacy owner data; other existing test-user records stay separate.
- Missing token, altered signature, wrong audience, expired token, wrong email or unprovisioned email is denied. A spoofed `oai-authenticated-user-email` header does not grant Cloudflare-build access.
- Driver login cannot call any old admin API, `/api/staff` or `/api/assignments`; their My Jobs response contains only bookings with both matching `owner_id` and `assigned_driver_user_id`.
- Disable the driver membership and confirm access is denied. Reassign their future bookings and remove/revoke their Access allowance.
- Current Sites build and its existing tester data remain unchanged.

## Still required before production

This step intentionally provides a read-only driver My Jobs view and a narrow assignment API; it does not yet implement assignment acknowledgement, licence/vehicle eligibility blocking, dispatch state transitions, driver payment collection, or the polished admin staff-management UI. The public booking API and Resend webhook must be moved to their own Worker before putting the entire portal behind Access. Restore-tested data migration, security review and a staged rollback remain release gates. No claim of Reigate & Banstead regulatory approval is made by this implementation.
