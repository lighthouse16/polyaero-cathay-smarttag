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

### Run Development Server

```bash
uv run uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/v1/docs

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