# APX RIDE Portal

APX RIDE Portal is a private, responsive operations application for managing chauffeur bookings, dispatch information, fare quotations, customer messages, calendars, and earnings from one workspace.

The current release is an MVP intended for one operator and a small invited testing group. It is hosted with ChatGPT Sites and uses a managed Cloudflare D1 database for persistent records.

## Live application

Production: <https://apx-ride-portal.hellosanthoshmathai.chatgpt.site>

The production Site is private. Access is controlled separately from the application source code.

## Current features

- Executive black-and-gold responsive dashboard
- Current and upcoming dispatch summary
- Persistent booking creation and listing
- Booking completion and recoverable archiving
- Calendar-style chronological job list
- Fare calculator with selectable vehicle tiers
- Configurable Model A and Model B distance strategies
- Fuel charge and fixed-fare overrides
- Automatic vehicle recommendation from passenger and luggage counts
- Official booking quote and booking confirmation previews
- Browser print/save-to-PDF output
- Passenger message templates populated from booking data
- SMS handoff and clipboard copy actions
- Earnings totals derived from completed bookings
- Mobile navigation and print-specific layouts

## Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| User interface | React 19 + TypeScript | Interactive portal screens and strongly typed application code |
| Application framework | Vinext | Next-compatible application routing and Cloudflare deployment output |
| Build system | Vite 8 | Development server and production compilation |
| Styling | Tailwind CSS 4 + custom CSS | Responsive layout, design tokens, print styles, and the APX RIDE visual system |
| Components | shadcn components + Base UI | Accessible interface primitives |
| Icons | Lucide React | Consistent interface iconography |
| Database | Cloudflare D1 (SQLite) | Persistent bookings, settings, and future operational records |
| Database schema | Drizzle ORM + Drizzle Kit | Type-safe schema definitions and generated SQL migrations |
| Authentication | ChatGPT Sites identity and access policy | Production visitor authentication and Site-level access control |
| Hosting | ChatGPT Sites on Cloudflare | Managed builds, private deployment, database binding, and production URL |
| Source control | Git + GitHub | Version history and collaboration |

## Architecture

```text
Browser
  |
  | HTTPS + authenticated Sites identity
  v
ChatGPT Sites / Cloudflare edge
  |
  +-- Vinext server-rendered application
  |     |
  |     +-- React client interface
  |     +-- /api/bookings route
  |
  +-- D1 binding: DB
        |
        +-- bookings table
        +-- settings table
```

The application is deployed as a Cloudflare-compatible server-rendered bundle. The browser renders the interactive workspace, while write operations are sent to server-side route handlers. Those handlers derive the current user identity from trusted Sites request headers and access D1 through the injected `DB` binding.

Application records are not stored in browser local storage. Booking data therefore survives reloads, browser changes, and new sessions.

## Main source layout

```text
app/
  api/bookings/route.ts  Booking list/create/update/archive API
  app-shell.tsx          Main application and operational screens
  globals.css            Global theme and base layout
  portal.css             Feature, responsive, modal, and print styling
  layout.tsx             Application metadata and root document
  page.tsx               Main server-rendered route
db/
  schema.ts              Drizzle table definitions
  index.ts               D1 database helper
drizzle/
  0000_dark_paladin.sql  Initial production migration
.openai/
  hosting.json           Sites project and logical D1 binding
```

## Booking data flow

1. A visitor signs in and passes the Site access policy.
2. The dashboard requests `GET /api/bookings`.
3. The server identifies the current visitor from the trusted `oai-authenticated-user-id` header.
4. The API returns only records owned by that identity.
5. Creating a job sends `POST /api/bookings` with the booking fields.
6. Completing a job uses `PATCH /api/bookings`.
7. Removing a job performs a soft archive through `DELETE /api/bookings`; the record is retained rather than permanently erased.
8. Calendar, messages, dispatch, and earnings reuse the same booking record, avoiding duplicate data.

## Fare calculation

The first release uses **Model A** by default:

```text
Distance charge = total distance x per-mile rate
Calculated fare = base minimum + distance charge + optional fuel expense
```

Fuel defaults to GBP 50 per 100 miles:

```text
Fuel expense = distance x (50 / 100)
```

**Model B** is already represented as an alternative strategy:

```text
Chargeable miles = max(0, total distance - 1)
Distance charge = chargeable miles x per-mile rate
```

A fixed fare, when entered, replaces the calculated total. The quote preview states the active model and calculation breakdown.

### Current rate card

| Vehicle tier | Base minimum | Per-mile rate |
| --- | ---: | ---: |
| Saloon | GBP 6.00 | GBP 1.60 |
| Estate | GBP 7.00 | GBP 1.70 |
| 6-seater | GBP 8.00 | GBP 2.20 |
| 7-seater | GBP 9.00 | GBP 2.50 |

The fare engine is intentionally separated into inputs and strategies so later releases can introduce airport charges, parking/tolls, hourly charges, seasonal pricing, operator-specific rates, discounts, or additional mileage models without rebuilding the booking interface.

## Authentication and test access

Site audience access and application identity are separate controls.

The current deployment is configured for the owner only. It does not currently provide open registration, usernames, or passwords managed by APX RIDE. Invited visitors must authenticate with the exact ChatGPT account to which access was granted.

For external testers, the recommended future configuration is:

1. Keep all application routes behind ChatGPT sign-in.
2. Maintain an explicit server-side allowlist of approved tester email addresses.
3. Change the Site audience to public only after the application allowlist is active.
4. Reject signed-out visitors and authenticated accounts that are not approved.
5. Remove testers from the allowlist when verification is complete.

Do not make the current application public before that authorization layer is added. An unrestricted public deployment could expose passenger names, phone numbers, journeys, notes, and financial information.

## Local development

Requirements:

- Node.js 22.13 or newer
- pnpm

Install and start:

```bash
pnpm install
pnpm dev
```

The local development address is normally <http://localhost:3000>.

Create a production build:

```bash
pnpm build
```

Generate a migration after changing `db/schema.ts`:

```bash
pnpm db:generate
```

Always inspect generated SQL before deploying it.

## Deployment model

The source is committed to GitHub. Production publication is performed through ChatGPT Sites:

1. Build and test the application locally.
2. Commit and push the exact source revision.
3. Package the generated `dist` output, hosting metadata, and database migrations.
4. Save a Sites version associated with the Git commit.
5. Deploy the approved version to production.

The `.openai/hosting.json` file contains only the managed Site project identifier and logical storage binding. Credentials and runtime secrets must never be committed.

## Custom addresses

Two address types are available:

- **Free hosted address:** change the Site slug while keeping the managed `chatgpt.site` domain, for example `apxride.<account>.chatgpt.site`, if the slug is available.
- **Fully custom domain:** connect a domain or subdomain already owned by APX RIDE, for example `portal.apxride.co.uk`. Sites does not purchase or register a domain, so the domain registration itself is not provided for free.

Changing the hosted Site slug does not require a new application deployment. Connecting a custom domain requires access to the domain's DNS records.

## Security and privacy

The portal can contain personal and commercially sensitive information. Production changes should preserve these controls:

- Authenticate every visitor.
- Authorize every server-side read and write.
- Keep database queries scoped to the current owner or approved tenant.
- Never commit credentials or secret values.
- Use recoverable archiving for bookings.
- Avoid real passenger information in testing environments.
- Review tester access after each test period.
- Add formal export and backup procedures before relying on the portal as the sole booking record.
- Do not store payment-card or health information.

## Known MVP limitations

- Portal access requires Sign in with ChatGPT and an owner-managed email allowlist.
- Testers cannot self-register for portal access; the owner adds their exact ChatGPT account email to the hosted `ALLOWED_EMAILS` secret.
- Booking editing is not yet exposed in the interface.
- Archived-record recovery is not yet exposed in the interface.
- Expenses are represented in the dashboard but do not yet have a persistent entry form.
- PDF output uses the browser print dialog rather than server-generated files.
- Message sending opens the device's SMS handler; no paid SMS or WhatsApp API is connected.
- Settings controls demonstrate the planned configuration surface but are not all persisted yet.
- The calendar is currently an operational list rather than a complete month grid.
- Automated backups and council-format exports are planned but not yet implemented.

## Recommended next milestones

1. Add secure external tester allowlisting.
2. Add booking editing, archived-record recovery, and validation.
3. Persist fare settings and version every quote calculation.
4. Add expenses, CSV/JSON exports, and routine backups.
5. Expand the calendar to month and day views.
6. Add automated unit and browser tests to continuous integration.
7. Connect an APX RIDE-owned domain when available.
8. Reuse the API and data model for a future mobile application.

## Repository

<https://github.com/santhoshmathai/apx-ride>
