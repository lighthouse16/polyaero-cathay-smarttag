# System architecture

PolyAero Cathay SmartTag is an independent hackathon prototype. The API is the
source of persisted member, booking, flight, tag, baggage, and operational data.

```text
Expo passenger app                 Next.js staff dashboard
  member login / bookings            baggage / custody / risk / recovery
  authenticated baggage              dashboard-specific API routes
           |                                      |
           +--------------- HTTPS ----------------+
                              |
                    FastAPI on Google Cloud Run
                    SQLAlchemy / Alembic / model inference
                              |
                    VPC egress -> Cloud NAT static IP
                              |
                    Verified TLS on PostgreSQL port 5432
                              |
                    AWS RDS PostgreSQL

Compatible phone -> NFC / ISO-DEP -> PN532 -> ESP32-C6 -> 4.2" e-paper
                                      standalone MicroPython; no device API calls
```

## Data ownership

- `flights` stores schedule, route, cabin availability, staff-reported operations,
  shared weather/load/congestion inputs, and the initial baggage-status default.
- `bookings.flight_id` and `baggage.flight_id` reference the same flight.
  Connection minutes and actual milestones remain baggage-specific.
- Tags carry registration/booking identity and sync state. Baggage events and
  `baggage.operational_data` persist custody, assessment, and recovery details.
- A flight's initial status does not prove tag sync or overwrite later baggage
  milestones. Display previews and server events do not prove physical refresh.
- The local shared SmartTag repository is a deterministic simulator, optionally
  persisted in browser storage; it is not the PostgreSQL source of truth.

## Application boundaries

- The passenger app uses the authenticated central API client for integrated
  flows. Explicit mock mode retains fixtures; promotional screens and full
  live-booking NFC setup are not completely integrated.
- Member baggage routes enforce ownership. The staff adapter uses
  `/baggage/dashboard` and persists operations through separate mutation routes.
  Staff access restrictions remain a deployment requirement, not a completed
  individual staff authorization model.
- Flight status is staff-maintained, not an external airline feed. Risk-model
  outputs use demo inputs and are not verified airport telemetry.
- The ESP32 firmware receives an NDEF record and renders locally. Readback and
  refresh-receipt logic exist; physical behavior still needs device validation.
  This powered prototype does not establish passive RF energy harvesting.

## Configuration and deployment

- Each app has its own environment example. Client URLs are public, build-time
  configuration; passwords, signing keys, device keys, and staff credentials are
  server-only.
- Cloud Run uses a container image from Artifact Registry. A separate job runs
  migrations; data and seed operations do not run in each API replica.
- AWS RDS allows the Google Cloud NAT outbound IP on TCP 5432. The container
  verifies RDS TLS using the AWS CA bundle. The documented demo uses Hong Kong
  regions (`asia-east2` / `ap-east-1`).
- Local and cloud databases remain separate. Use synthetic data and back up
  existing data before migrations. Authentication gaps, demo assumptions, and
  physical hardware limits prevent describing this as production-ready.

See the [root setup guide](../README.md) and
[API deployment runbook](../apps/api/README.md) for executable commands.
