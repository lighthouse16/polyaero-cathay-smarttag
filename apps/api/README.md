# PolyAero Cathay SmartTag API

FastAPI backend for the PolyAero Cathay SmartTag hackathon project.

## Quick Start

### Prerequisites

- Python 3.11+
- uv (package manager): `pip install uv` or `corepack enable uv`
- PostgreSQL 16+

### Install Dependencies

```bash
cd apps/api
uv sync
```

### Environment Configuration

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# Run migrations
uv run alembic upgrade head

# Create a new migration
uv run alembic revision --autogenerate -m "migration description"
```

### OTP Email via SMTP

Email verification uses Python's SMTP client with verified **implicit TLS**
(Gmail port **465**), not the Gmail OAuth API. Enable Google 2-Step Verification
on the sending account, then create an App Password if your account permits it.
Use that app password, not your normal Google password. OAuth client IDs,
client secrets, and refresh tokens are no longer used.

Set these values privately in `apps\api\.env` or the deployed API's secret
configuration:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your-sender@gmail.com
SMTP_APP_PASSWORD=
```

Fill `SMTP_APP_PASSWORD` with the generated password (without display spaces).
The authenticated address is also the From address. This transport always uses
implicit TLS; do not configure port 587, which requires STARTTLS instead.
No extra dependency is needed. Keep the password out of Git, logs, and
`EXPO_PUBLIC_*`; use a secret manager for production.

Restart/redeploy the API after changing configuration. No database migration
or mobile APK rebuild is needed for this email change. Existing OTP expiry,
verification, and resend-cooldown rules remain unchanged. SMTP runs in a worker
thread so network waits do not block the API's event loop.

Missing credentials or rejected/failed SMTP delivery return HTTP 503 rather
than claiming a code was sent or printing email OTPs in logs. A failed delivery
can still leave a generated challenge and its existing resend cooldown; wait
for the cooldown before retrying. SMS remains the existing development-only
stub, not an SMS delivery provider.

Run the isolated SMTP and OTP route regression tests (no real mail or DB writes):

```powershell
uv run --frozen --extra dev pytest tests\test_email.py -q
```

### Run Development Server

```bash
uv run uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/v1/docs

### Flight Status and Prototype Boarding Passes

Run `uv run alembic upgrade head` before deploying this version. Existing and
seeded flights start at `UNKNOWN`, with no staff report timestamp. Status comes
from our database, **not a live airline feed**.

`flights` is the shared flight catalogue. Alongside route, schedule, cabin
availability, and operational status, it stores `weather_severity` (1-5),
`load_factor_pct` (0-100), `airport_congestion` (1-5), and `initial_status`
(`AWAITING_SYNC` or `CHECKED_IN`). These defaults are 2, 86.0, 2, and
`AWAITING_SYNC`. Search/status/upcoming responses expose these shared values;
staff may update them through the existing protected flight-status PATCH.

Bookings already reference `flights.id`. Baggage now has a required `flight_id`
foreign key instead of duplicate flight number/route/departure columns.
Connection minutes stay on baggage because each passenger's connection can
differ. Changing flight conditions affects baggage reads and risk inputs without
copying updates into each bag. The flight's `initial_status` is only a starting
baggage default; it never proves NFC sync or replaces an existing bag milestone.

Back up existing data before running `uv run alembic upgrade head`. Migration
`b6c7d8e9f0a1` links legacy baggage using a matching tag booking, or an exact
unique number/route/departure match for bags without a linked booking. Missing,
ambiguous, or conflicting identities stop the migration and roll it back rather
than guessing. Correct those legacy rows before retrying. Downgrade reconstructs
the old baggage flight fields from the shared catalogue.

Member `GET /baggage`, `GET /baggage/{identifier}`, and `POST /baggage/sync`
require bearer authentication and enforce ownership; private responses are
not cached. Sync requires a registered active owned tag and uses its booking's
flight, or an explicit `flight_id` for an owned unbooked tag. Legacy
number/route/departure selectors are accepted only when unambiguous. Pass
`sync_status: "TAGGED"` or `"SYNCHRONIZED"` only after the client confirms sync;
the old `initial_status` request name remains an alias for compatibility, not
the source of flight defaults. Do not send weather/load/congestion overrides
to baggage sync: they are rejected. No new physical-refresh verification is
implemented here.

- `GET /api/v1/flights/upcoming` is public and returns all flights whose scheduled
  departure is now or later (UTC), ordered by departure time and then flight ID.
  Cancelled/departed/arrived flights and flights with actual departure/arrival
  timestamps are excluded. Estimated times do not change eligibility: a delayed
  flight with a past scheduled departure is not included. The response is an
  unpaginated array of the same flight details as the status endpoint below;
  no matches returns `[]`.
- `GET /api/v1/flights/status?flight_number=CX255&departure_date=2026-11-14`
  is public and returns all matching flights on their scheduled UTC departure
  date. No match returns an empty list. Responses include scheduled, estimated,
  and actual timestamps, terminal/gate, `status_reported_at`, and
  `source: STAFF_REPORTED_DATABASE`.
- `PATCH /api/v1/flights/{flight_id}/status` requires `X-Flight-Staff-Key`.
  Configure a strong `FLIGHT_STATUS_STAFF_KEY` privately on the API server and
  trusted staff integration; never put it in mobile/public environment files.
  Missing server configuration disables updates (503); absent/wrong credentials
  return 401. Use HTTPS outside local development.

Example PATCH JSON:

```json
{
  "operational_status": "DELAYED",
  "estimated_departure_time": "2026-11-14T09:00:00Z",
  "estimated_arrival_time": "2026-11-14T21:00:00Z",
  "gate": "24"
}
```

Allowed statuses: `UNKNOWN`, `SCHEDULED`, `DELAYED`, `BOARDING`, `DEPARTED`,
`ARRIVED`, `CANCELLED`. Operational timestamps must include a timezone; arrival
must be later than departure when both are supplied or already stored. Omitted
fields are preserved; explicit `null` clears optional timestamps, terminal, or
gate. Each successful update records the server's UTC report time. No status is
inferred automatically from the clock. The shared staff key is not a member
role or an individual staff audit trail; a staff dashboard UI is not added here.

`GET /api/v1/bookings/{booking_id}/boarding-pass` requires member bearer
authentication and booking ownership. Only checked-in, upcoming bookings are
eligible; cancelled/departed/arrived flights are refused. Ineligible bookings
return 409; absent or unowned bookings return 404.

The response is explicitly `PROTOTYPE - NOT VALID FOR BOARDING` with
`valid_for_boarding: false`, the member's name, reservation/cabin, and current
database flight details. Seat is null because this schema has no seat assignment.
No airline ticket, boarding barcode, QR code, or real pass is issued. Successful
responses use `Cache-Control: no-store`. New bookings are not checked in by
default; this endpoint does not perform check-in.

Regression tests require an isolated PostgreSQL database:

```powershell
uv run --frozen --extra dev pytest tests\test_flight_status_boarding.py tests\test_seed.py -q
```

Set `SEED_TEST_DATABASE_URL` as documented below; without it, database tests skip.

### Seed Linked Demo Data

The seed command targets the **current API/Alembic PostgreSQL schema**, not the
older, incompatible `supabase` schema. Run migrations first. From the repository
root, preview the dataset without opening a database connection:

```powershell
Set-Location apps\api
uv run python -m app.seed --date 2026-11-14
```

Check that `DATABASE_URL` in the environment or `.env` points to your intended
development database, then explicitly apply:

```powershell
uv run python -m app.seed --date 2026-11-14 --apply
```

Omit `--date` to use today's UTC date. Each date represents a synthetic snapshot
at 00:00 UTC: four members (all membership tiers), eight flights with cabin
availability/prices and return routes, twelve bookings (upcoming, past,
cancelled), twelve tags (ten bound and two unlinked, including inactive
inventory), ten baggage records, and fifty ordered events. Journeys cover
check-in through collection, plus misrouted, missing, and recovery-in-progress
bags. Tags are explicitly simulated; this does not claim a physical NFC write
or e-paper refresh.

IDs, booking references, tag codes, and timestamps are deterministic for the
same date. Rerunning inserts only missing IDs, never updates existing records or
deletes data, and commits all tables in one transaction. A conflicting email,
membership number, PNR, or tag code owned by another ID fails and rolls back the
whole run rather than silently linking unrelated records. Changing the date
adds a new snapshot while sharing the same four members.

Members use reserved `example.com` addresses (`seed.passenger.1@example.com`
through `.4`) and membership numbers `9900000001` through `9900000004`.
No password is set by default. To enable demo password sign-in, set
`SEED_USER_PASSWORD` privately in your shell before the **first** apply; it must
have at least eight characters and at most 72 UTF-8 bytes. Only bcrypt hashes
are stored, SQL parameter logging is disabled during apply, and no messages
are sent. Remove the environment variable afterward. Reruns never reset member
passwords. Refresh tokens, verification codes, and WebAuthn credentials are
intentionally left to genuine authentication flows.

**Dashboard boundary:** authenticated member baggage reads and sync now use
PostgreSQL and the shared flight catalogue. Legacy staff scan/recovery and
what-if simulators remain separate prototype paths. Their recovery-case and
carousel state is not made persistent by this flight-data migration; a staff
portal integration must respect member ownership rather than using anonymous
requests to the member baggage API.

Seed integration tests use real PostgreSQL in a fresh randomly named schema per
test, removed afterward. They never use the application's `DATABASE_URL`.
Point `SEED_TEST_DATABASE_URL` at an isolated PostgreSQL database using the
synchronous `postgresql+psycopg://` driver, then run:

```powershell
uv run --frozen --extra dev pytest tests\test_seed.py -q
```

Without that variable, database tests skip; preview/password-validation tests
still run.

#### Seed the deployed AWS database from Cloud Shell

Build and push a new API image from the seed branch; the running API image may
predate `app.seed`. Use a separate image tag so the deployed API is unchanged.
Upload `seed_cloudrun.py` to Cloud Shell, then run:

```bash
python3 ~/seed_cloudrun.py --project polyaero \
  --image asia-east2-docker.pkg.dev/polyaero/smarttag-demo/api:seed-12e353d \
  --date 2026-11-14
```

The helper creates `smarttag-demo-seed` using the existing
`smarttag-demo-migrate` job's database credentials, TLS settings, network and
runtime identity. It runs a preview, prints the database target, privately
prompts for a demo login password, and requires `apply` before writing. Preview
does not validate connectivity. Check the execution logs for committed row
counts; existing seed members never have their passwords changed.

This is for the hackathon database only. It does not modify the API or migration
job or rotate their keys. Credentials are visible to authorized viewers of job
configuration. The password is removed from the current seed job configuration
after applying, including on execution failure, but prior execution metadata
may retain it. Use a unique demo-only password, never a personal password.

### Run Tests

```bash
uv run pytest
```

### Code Quality

```bash
# Lint
uv run ruff check .

# Type check
uv run mypy app
```

## Project Structure

```
apps/api/
├── app/
│   ├── core/           # Config, database, security
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas (request/response)
│   ├── api/v1/         # API routes
│   │   └── endpoints/  # Route handlers
│   └── services/       # Business logic
├── alembic/            # Database migrations
├── tests/              # Pytest tests
├── pyproject.toml      # Dependencies & tool config
├── .env.example        # Environment template
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/v1/baggage | Create baggage record |
| GET | /api/v1/baggage/{id} | Get baggage by ID |
| GET | /api/v1/baggage | List baggage |
| PATCH | /api/v1/baggage/{id} | Update baggage |
| DELETE | /api/v1/baggage/{id} | Delete baggage |
| POST | /api/v1/tags | Create SmartTag |
| GET | /api/v1/tags/{id} | Get tag by ID |
| GET | /api/v1/tags | List tags |
| PATCH | /api/v1/tags/{id} | Update tag |
| DELETE | /api/v1/tags/{id} | Delete tag |

## Database Schema

### tags
- `id` (UUID, PK)
- `tag_code` (String, unique) - NFC tag identifier
- `is_active` (Boolean)
- `firmware_version` (String, nullable)
- `hardware_revision` (String, nullable)
- `last_seen_at` (DateTime, nullable)
- `created_at`, `updated_at` (DateTime)

### baggage
- `id` (UUID, PK)
- `passenger_name` (String)
- `flight_number` (String, indexed)
- `departure_airport` (String, 3 chars)
- `arrival_airport` (String, 3 chars)
- `departure_time` (DateTime)
- `seat_number` (String, nullable)
- `status` (String, default: 'checked_in')
- `tag_id` (UUID, FK to tags, nullable, indexed)
- `created_at`, `updated_at` (DateTime)

## Next Steps

- [ ] Implement CRUD operations in endpoints
- [ ] Add authentication/authorization
- [ ] Add baggage milestone events table
- [ ] Integrate with Supabase for realtime (staff portal)
- [ ] Add RAG/agentic AI modules (separate service)

## One-day Google Cloud Run demo with AWS RDS

This is a public, demo-data-only deployment, not a production release. The
existing baggage store is in memory and resets on instance replacement, even
with the single-instance limit. Authentication/ownership gaps from the audit
remain. Gmail/SMS delivery and public passkey origins are not configured by
this deployment.

Select a Google Cloud project with billing enabled and open Cloud Shell.
During PR review, get the deployment branch directly from GitHub:

```bash
git clone --branch feat/backend-cloudrun-rds https://github.com/lighthouse16/polyaero-cathay-smarttag.git
cd polyaero-cathay-smarttag/apps/api
bash deploy-cloudrun.sh
```

After this PR is merged, use `--branch main` instead. Alternatively, upload
the prepared `api-cloudrun.zip` using Cloud Shell's Upload file menu and run:

```bash
unzip api-cloudrun.zip -d smarttag-api
cd smarttag-api
bash deploy-cloudrun.sh
```

The script uses Hong Kong (`asia-east2`), near the AWS RDS Hong Kong region
(`ap-east-1`). It creates a dedicated VPC subnet, Cloud NAT, and a static
outbound IP. When it pauses, add that IP as a PostgreSQL TCP 5432 source ending
in `/32` to the AWS database's security group, then continue. Never open the
database to `0.0.0.0/0`.

Enter your RDS endpoint, database name, username, and password at the prompts.
Do not run the script with `bash -x`: that would reveal credentials. Secrets
are stored in Google Secret Manager, not in the image or source archive.
The container uses the AWS CA bundle to verify the database's TLS certificate.
Alembic runs once in a Cloud Run job before the API is deployed.

The script builds on Cloud Build; local Docker is not needed. It requires
permission to enable APIs, create resources/service accounts, and grant IAM
roles. It is a first-deployment script, not an automatic retry/upgrade script:
if it stops, inspect the error and existing resources before rerunning.

After successful health and database-route checks, use the printed URL ending
in `/api/v1` for `EXPO_PUBLIC_API_URL` and `NEXT_PUBLIC_API_URL` when building
clients. The generated device key must only be provisioned to trusted hardware.
Changing the API URL does not resolve the client's existing demo-data or NFC
acknowledgement issues.

### Resume with an already pushed image and existing permissions

If the network, NAT, runtime service account, and `api:demo` image already
exist, `deploy_cloudrun_demo.py` can run migrations and deploy without Cloud
Build, Secret Manager, or IAM changes:

```bash
python3 deploy_cloudrun_demo.py --project YOUR_PROJECT_ID
```

Upload this helper to Cloud Shell if it is not present in your checkout. It
uses only Python's standard library and the authenticated `gcloud` command.
Enter database credentials at its prompts; the password is hidden. It writes
a temporary environment file outside the repository and removes it on success
or ordinary failure. An interrupted or forcibly killed process can leave a
temporary file behind. Do not run with a debugger or print the environment.

This is a demo-only fallback: database credentials are stored in Cloud Run
environment variables and visible to users who can inspect the configuration.
It still requires permission to deploy using the existing runtime service
account and pull the image. No IAM restriction is bypassed. New services are
private; existing service access policies are unchanged. Public mobile access
is a separate permission/configuration step. Rerunning generates new signing
and device keys, invalidating existing tokens and device configuration.

### Cleanup after the demo

Cloud NAT, reserved IPs, stored images, secrets, and build storage can incur
charges even when Cloud Run has scaled to zero. The following commands delete
only the dedicated Google Cloud demo resources. Confirm the selected project
first and preserve any logs/images you need.

```bash
gcloud config get-value project
gcloud run services delete smarttag-demo --region=asia-east2
gcloud run jobs delete smarttag-demo-migrate --region=asia-east2
gcloud compute routers nats delete smarttag-demo-nat --router=smarttag-demo-router --region=asia-east2
gcloud compute routers delete smarttag-demo-router --region=asia-east2
gcloud compute addresses delete smarttag-demo-ip --region=asia-east2
gcloud compute networks subnets delete smarttag-demo-subnet --region=asia-east2
gcloud compute networks delete smarttag-demo-net
gcloud artifacts repositories delete smarttag-demo --location=asia-east2
gcloud secrets delete smarttag-demo-database-url
gcloud secrets delete smarttag-demo-secret-key
gcloud secrets delete smarttag-demo-device-key
```

Remove the dedicated runtime and build service accounts, any demo-only build
storage, the build account's project IAM grant, and the static-IP AWS firewall
rule. Delete RDS separately after exporting any data worth keeping;
retained AWS snapshots/backups may still cost money.