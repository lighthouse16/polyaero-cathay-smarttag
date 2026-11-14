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

**Dashboard:** `/api/v1/baggage` lists PostgreSQL baggage rows, including all ten
seeded bags; the two spare tags are inventory, not baggage. It no longer appends
the two hardcoded demo bags. Detail accepts a baggage UUID, tag code, tag UUID or
barcode. Scan, sync, risk and passenger recovery updates persist in PostgreSQL.
Shared NFC/app events also update the baggage status, so tag display and the
dashboard stay consistent. Unregistered tags return 404 instead of demo data.

Risk assessments, predicted carousel assignments and recovery details are stored
in `baggage.operational_data`. Unassessed seed bags have no risk score or carousel
assignment; these are not fabricated from status. Run `alembic upgrade head`
before deploying this API version. The additive migration preserves existing
seed rows; no reseeding is required. `/baggage/reset` returns 409 rather than
deleting persistent records. Empty databases return an empty list.

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
| GET | /api/v1/baggage | List PostgreSQL baggage |
| GET | /api/v1/baggage/{identifier} | Get baggage by UUID, tag code or barcode |
| POST | /api/v1/baggage/sync | Sync a registered tag with a booked itinerary |
| POST | /api/v1/baggage/{identifier}/scan | Persist a milestone and event |
| POST | /api/v1/baggage/{identifier}/risk/apply | Persist a model risk assessment |
| POST | /api/v1/baggage/{identifier}/passenger/choice | Persist demo recovery choice |
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

This is a public, demo-data-only deployment, not a production release. Baggage
and operational updates persist in AWS RDS across instance replacements.
Authentication/ownership gaps from the audit remain. Gmail/SMS delivery and
public passkey origins are not configured by this deployment.

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