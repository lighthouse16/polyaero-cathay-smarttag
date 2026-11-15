# Cathay staff operations dashboard

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
dataset through `GET /baggage`; it no longer guesses seed tag codes or dates.
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

## Release gate

Draft only until screenshot comparison/E2E/accessibility QA and required ChatGPT reviewer approval pass. Monorepo typecheck has existing mobile TS2367 errors (BaggageJourneyScreen); do not suppress them or edit passenger app in this task. Production dependency audit reports existing advisories; triage before release. No production deployment or merge authorized.
