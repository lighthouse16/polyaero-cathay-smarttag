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

`NEXT_PUBLIC_API_URL` selects the API base (including `/api/v1`); the live adapter
defaults to the hosted Cloud Run API if it is omitted. Set `STAFF_LIVE_BACKEND=1`
for the Next.js transfer/performance/action routes to use persisted operations.
The environment example selects that mode against the local API.
With live mode disabled, separate Next.js mock routes retain an isolated,
ephemeral store. It is not shared with FastAPI/mobile, durable, or authenticated.
Operator identity is demo metadata, not authenticated staff authorization.

The live dashboard defaults to the Cloud Run API and reads the full database
dataset through `GET /baggage/dashboard`; member `/baggage` is ownership-scoped.
Detail previews use `GET /tags/{tag_code}/display`. Scans and risk updates use
`POST /baggage/{tag}/scan` and `POST /baggage/{tag}/risk/apply`. A failed write is
reported as an error, never fake local success. Manual custody scans use
`TAG_TAPPED` / `MANUAL_OVERRIDE` and do not claim loading or physical NFC proof.
Unassessed database bags show unavailable risk rather than a fabricated score.
Risk re-scoring uses demo model assumptions, not verified telemetry.
FastAPI `/baggage/reset` is disabled for persistent data.

Snapshot counts use returned baggage records. The live adapter and Performance
report derive transfer cohorts, connections, and historical demo metrics from
available events plus explicit assumptions; they are not an independently
persisted recovery ledger or measured airport performance. Missing or ambiguous
timing remains unavailable rather than establishing a successful transfer.

Display payload preview never acknowledges E-paper refresh. No invented battery, revision, QR, PA2 encoding, or online state. Firmware/passenger app remain unchanged.

## UI and motion

Jade header/sidebar, ivory two-column workspace, TanStack grid, case tabs, native confirmation/search dialogs. CSS entry stagger runs on mount/navigation, not polling. SVG gauge transitions measured score; reduced motion disables drawing/translations. Actual browser visual, keyboard, overflow, stale-state, and interaction race QA remains required; unit/SSR checks do not replace it.

## Prototype release limits

Browser interaction, screenshot comparison, keyboard/accessibility, and hardware
QA are separate from unit/SSR tests. Operator identity is not production staff
authorization; restrict dashboard and operational routes to trusted demo users.
Risk/transfer assumptions must not be treated as verified airport telemetry.
See the root README for local setup, cloud deployment, and project-wide limits.

## Current backend integration handoff

See [STAFF_BACKEND_HANDOFF.md](../../docs/STAFF_BACKEND_HANDOFF.md) for current Transfer Control, Performance and Copilot contracts, provider setup, deployment limits, and known data/auth gaps. Optional model keys are server-only; without a configured provider, chat uses a deterministic snapshot preview.

## Production promotion guard

The custom domain `cathay.haidangtrih.me` was verified on 2026-11-15 pinned to deployment `dpl_Aax3cRikyJ2nVRrrFHyUcM7zcPzk` (commit `e921c86`). Vercel project `autoAssignCustomDomains` was `false`; keep this rollback guard enabled until an explicitly approved promotion. A GitHub merge or green build alone does not authorize replacing the demo.

Before promotion:

1. Verify the exact deployment commit, `READY` state, and environment (including `STAFF_LIVE_BACKEND=1`).
2. Run staff tests/lint/typecheck and an isolated build (`STAFF_QA_DIST_DIR=.next-build`) to avoid corrupting the running dev server's `.next` assets.
3. Verify the preview includes Performance trends/funnel/KPIs for the intended demo cohort, Copilot chat, and the file picker. Snapshot-only fallback is not equivalent to the full demo. Synthetic cohort metrics remain demo estimates, not measured operational outcomes.
4. Obtain explicit approval, promote only that verified deployment, and re-check the custom-domain alias. Preserve the previous deployment ID for rollback.

Do not automatically re-enable custom-domain assignment or promote a deployment merely because a PR merged. No permanent absence of regressions is guaranteed; regression tests and manual promotion are the safeguards.
