# Cathay staff operations dashboard

From the repository root, copy the local environment example before starting:

```powershell
Copy-Item apps\staff\.env.example apps\staff\.env.local
```

It selects `http://localhost:8000/api/v1`. For the hosted demo, set
`NEXT_PUBLIC_API_URL=https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1`.
Restart Next.js after editing; production bundles require a rebuild.

```sh
pnpm install --frozen-lockfile
pnpm --filter @polyaero/staff dev
pnpm --filter @polyaero/staff test
pnpm --filter @polyaero/staff lint
pnpm --filter @polyaero/staff typecheck
pnpm --filter @polyaero/staff build
```

## Data contract and scope

`NEXT_PUBLIC_API_URL` selects the live API base (including `/api/v1`), defaulting
to the hackathon Cloud Run service. The separate Next.js mock routes retain an
isolated ephemeral demo store for local development/tests; they are not the
live adapter's source and are not durable or authenticated. Operator identity
is demo metadata, not authenticated authorization.

The live dashboard defaults to the Cloud Run API and reads the full database
dataset through `GET /baggage/dashboard`; member `/baggage` is ownership-scoped.
Detail previews use `GET /tags/{tag_code}/display`. Scans and risk updates use
`POST /baggage/{tag}/scan` and `POST /baggage/{tag}/risk/apply`. A failed write is
reported as an error, never fake local success. Manual custody scans use
`TAG_TAPPED` / `MANUAL_OVERRIDE` and do not claim loading or physical NFC proof.
Unassessed database bags show unavailable risk rather than a fabricated score.
Risk re-scoring uses demo model assumptions, not verified telemetry.
FastAPI `/baggage/reset` is disabled for persistent data.

Snapshot scope is the returned baggage dataset, not a historical window.
Database event/departure timestamps are retained. The existing transfer adapter
still synthesizes feeder legs and transfer timing from demo assumptions; those
are not authoritative RDS flight connections. Transfer success/recovery durations
need eligible completed-transfer denominators and persisted case history.

Display payload preview never acknowledges E-paper refresh. No invented battery, revision, QR, PA2 encoding, or online state. Firmware/passenger app remain unchanged.

## UI and motion

Jade header/sidebar, ivory two-column workspace, TanStack grid, case tabs, native confirmation/search dialogs. CSS entry stagger runs on mount/navigation, not polling. SVG gauge transitions measured score; reduced motion disables drawing/translations. Actual browser visual, keyboard, overflow, stale-state, and interaction race QA remains required; unit/SSR checks do not replace it.

## Prototype release limits

Browser interaction, screenshot comparison, keyboard/accessibility, and hardware
QA are separate from unit/SSR tests. Operator identity is not production staff
authorization; restrict dashboard and operational routes to trusted demo users.
Risk/transfer assumptions must not be treated as verified airport telemetry.
See the root README for local setup, cloud deployment, and project-wide limits.
