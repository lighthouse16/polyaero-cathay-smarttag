# Baggage Recovery Copilot

## Source repository

```text
https://github.com/lighthouse16/polyaero-cathay-smarttag
```

**Cathay Hackathon 2026 submission by PolyAero.**
An independent prototype, not an official Cathay Pacific product or a
production airline system.

## Deployed website and API

Addresses are provided as plain text for submission.

```text
Operations website:
https://cathay.haidangtrih.me/#transfer-control

API base:
https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1

Interactive API endpoint documentation:
https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1/docs

OpenAPI endpoint schema:
https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1/openapi.json

Service health:
https://smarttag-demo-4pu4shawla-df.a.run.app/health
```

These are temporary hackathon services. Member endpoints require sign-in;
use synthetic data only. Service health does not guarantee database readiness.

## Project summary

Baggage Recovery Copilot connects the passenger experience, reusable NFC/e-paper
baggage tags, and ground operations. It brings baggage identity, custody events,
connection-risk assessments, and recovery information into one workflow.

SmartTag is the physical baggage-tag component. Existing repository paths,
package names, APK filenames, and protocol identifiers retain their original
names for compatibility.

## Main components

- **Passenger application:** Member sign-in, flight search, bookings, trips,
  database-backed flight status, and clearly labeled prototype boarding passes.
- **Ground operations dashboard:** Flight-first baggage visibility, custody
  scans, risk assessment, and recovery choices backed by persisted API data.
- **Recovery Copilot:** Streaming assistance with optional server-configured
  model providers. Without a provider, it uses a deterministic snapshot preview.
- **Reusable SmartTag:** NFC identity and sync/readback logic, plus an explicit
  simulator for development without physical hardware.
- **Hardware prototype:** ESP32-C6, PN532 NFC controller, and a Waveshare
  4.2-inch e-paper display running standalone MicroPython.

## Technology and architecture

| Layer                  | Implementation                        |
| ---------------------- | ------------------------------------- |
| Passenger frontend     | Expo, React Native, TypeScript        |
| Staff frontend         | Next.js, React, TypeScript            |
| API                    | FastAPI, Python, SQLAlchemy           |
| Database               | PostgreSQL with Alembic migrations    |
| Cloud API hosting      | Google Cloud Run                      |
| Cloud database hosting | AWS RDS PostgreSQL                    |
| Hardware               | ESP32-C6, PN532, e-paper, MicroPython |

Bookings and baggage reference a shared flight catalogue. Baggage milestones,
events, risk assessments, and recovery details persist in PostgreSQL rather than
depending on an API container's lifetime.

The documented cloud setup runs Cloud Run in Hong Kong (`asia-east2`) and
connects to AWS RDS in Hong Kong (`ap-east-1`). Cloud NAT supplies a static
outbound IP; the RDS firewall allows that IP on PostgreSQL port 5432. The API
container verifies database TLS using the AWS CA bundle. A separate Cloud Run
job applies migrations before deployment.

The first-deployment script uses Google Secret Manager for server secrets.
The resume helper is a demo fallback using Cloud Run environment configuration,
not an equivalent production secret-management design.

The physical firmware receives an NFC payload and renders locally without
Wi-Fi or device API calls. It is an externally powered prototype, not proof
of passive NFC energy harvesting.

## Repository contents

```text
apps\api                         Backend, migrations, seed scripts, API tests
apps\mobile                      Passenger application and NFC services
apps\staff                       Operations dashboard and Copilot
apps\firmware\micropython-esp32c6  Hardware firmware and wiring instructions
packages\shared                  Domain contracts, simulator, test fixtures
packages\design-tokens           Shared visual tokens
docs                             Architecture, deployment, hardware notes
```

The repository includes hosted-demo details, Android release information,
environment examples, hardware documentation, and automated tests.

## Local evaluation

Prerequisites: Node.js 22, pnpm 10.33.0, Python 3.13, uv, and PostgreSQL 16+.
The following commands use PowerShell and begin at the repository root.
Run the backend and both frontends in separate terminals.

### Configure applications

```powershell
pnpm install --frozen-lockfile
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\mobile\.env.example apps\mobile\.env
Copy-Item apps\staff\.env.example apps\staff\.env.local
```

Do not overwrite existing configured files. Create an empty local `smarttag`
PostgreSQL database and set `DATABASE_URL` in the API environment to match your
local credentials. No cloud account is required for local evaluation.

### Start the backend

```powershell
Set-Location apps\api
uv sync --frozen --extra dev
uv run alembic upgrade head
uv run python -m app.seed
uv run python -m app.seed --apply
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The first seed command previews the synthetic dataset; only `--apply` writes.
Check the target database first. Same-date reruns do not reset existing data.

For passenger password login, set `SEED_USER_PASSWORD` privately in the shell
before the first seed apply. It must have at least eight characters; remove the
variable afterward. The seeded members are `seed.passenger.1@example.com`
through `seed.passenger.4@example.com`. Reruns do not reset their passwords.
Without a password, email OTP requires configured server-side SMTP credentials.

### Start the frontends

From the repository root in separate terminals:

```powershell
pnpm dev:mobile
```

```powershell
pnpm dev:staff
```

The backend listens on port 8000, the staff portal on port 3000, and Expo
provides the passenger development session. For browser preview, press `w`
in the Expo terminal.

Set the mobile API host to `10.0.2.2` for an Android emulator, `localhost` for
browser/iOS simulator, or the computer's LAN IP for a physical phone.
Include the `/api/v1` prefix. The staff example selects the local API and
`STAFF_LIVE_BACKEND=1`. Restart frontend development servers after environment
changes; standalone builds require rebuilding when their public URL changes.

## Suggested evaluation flow

1. Start the local API with migrated and seeded synthetic data.
2. Open the staff dashboard and inspect baggage, custody events, and risk or
   recovery operations. Some unassessed records intentionally have no risk score.
3. Sign into the passenger app using a configured demo member, then explore
   flight search, bookings, and trips.
4. Review the SmartTag simulator separately from physical NFC testing.
   Native NFC requires compatible hardware and a development build.

## Prototype limits and responsible use

- No private Cathay APIs, payment processing, airline ticket issuance, or real
  boarding credentials. Passes state **PROTOTYPE - NOT VALID FOR BOARDING**.
- Flight reports come from our database, not a live airline feed. Risk scores
  and transfer/performance assumptions are demo outputs, not verified airport
  telemetry or guarantees.
- Some promotional screens and SmartTag preparation/journey flows remain
  simulations. Full live-booking NFC setup is not completely connected.
- Member tokens are held in memory. Email OTP needs SMTP configuration; SMS
  remains a development stub.
- Staff/dashboard authorization is not production-complete. Restrict access,
  use synthetic data, and keep database passwords and model/device/staff keys
  out of Git and public frontend variables.
- Browser preview does not verify native NFC. Physical display refresh, barcode
  readability, and hardware edge cases require separate device validation.
- Hosted demos are temporary. Cloud resources and retained backups can incur
  costs; back up data before migrations and clean up dedicated demo resources.
