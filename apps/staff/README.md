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

`NEXT_PUBLIC_API_URL` selects an existing API base (including `/api/v1`). Without it, Next.js uses its **isolated ephemeral demo store**. This store is not shared with FastAPI/mobile, not durable, not authenticated, and not suitable for real passenger data or production operations. Operator identity is demo metadata, not authenticated authorization.

Reads: `GET /baggage`, `GET /tags/{tag_code}/display`. Mutations: existing `POST /baggage/{tag}/scan`, `POST /baggage/{tag}/risk/apply`, and confirmed demo reset. Manual portal changes use `MANUAL_OVERRIDE`; reported event types do not establish physical proof. Risk simulation uses operator-entered assumptions and persists resulting assessment, not verified telemetry.

Snapshot metrics: tracked count = returned bag records; at risk = score >=35, exception status, or supplied connection buffer <70 minutes; exceptions = MISROUTED/MISSING/RECOVERY_IN_PROGRESS. Scope: returned dataset, no historical window. Transfer success/recovery durations unavailable without eligible completed-transfer denominators and persisted case history. Historical ranges disabled; no synthetic sparklines. Timeline plots actual event/departure timestamps in HKT, not fabricated inbound legs or transfer intervals.

Display payload preview never acknowledges E-paper refresh. No invented battery, revision, QR, PA2 encoding, or online state. Firmware/passenger app remain unchanged.

## UI and motion

Jade header/sidebar, ivory two-column workspace, TanStack grid, case tabs, native confirmation/search dialogs. CSS entry stagger runs on mount/navigation, not polling. SVG gauge transitions measured score; reduced motion disables drawing/translations. Actual browser visual, keyboard, overflow, stale-state, and interaction race QA remains required; unit/SSR checks do not replace it.

## Release gate

Draft only until screenshot comparison/E2E/accessibility QA and required ChatGPT reviewer approval pass. Monorepo typecheck has existing mobile TS2367 errors (BaggageJourneyScreen); do not suppress them or edit passenger app in this task. Production dependency audit reports existing advisories; triage before release. No production deployment or merge authorized.

## Current backend integration handoff

See [STAFF_BACKEND_HANDOFF.md](../../docs/STAFF_BACKEND_HANDOFF.md) for current Transfer Control, Performance and Copilot contracts, provider setup, deployment limits, and known data/auth gaps.

## Production promotion guard

The custom domain `cathay.haidangtrih.me` was verified on 2026-11-15 pinned to deployment `dpl_Aax3cRikyJ2nVRrrFHyUcM7zcPzk` (commit `e921c86`). Vercel project `autoAssignCustomDomains` was `false`; keep this rollback guard enabled until an explicitly approved promotion. A GitHub merge or green build alone does not authorize replacing the demo.

Before promotion:
1. Verify the exact deployment commit, `READY` state, and environment (including `STAFF_LIVE_BACKEND=1`).
2. Run staff tests/lint/typecheck and an isolated build (`STAFF_QA_DIST_DIR=.next-build`) to avoid corrupting the running dev server's `.next` assets.
3. Verify the preview includes Performance trends/funnel/KPIs for the intended demo cohort, Copilot chat, and the file picker. Snapshot-only fallback is not equivalent to the full demo. Synthetic cohort metrics remain demo estimates, not measured operational outcomes.
4. Obtain explicit approval, promote only that verified deployment, and re-check the custom-domain alias. Preserve the previous deployment ID for rollback.

Do not automatically re-enable custom-domain assignment or promote a deployment merely because a PR merged. No permanent absence of regressions is guaranteed; regression tests and manual promotion are the safeguards.
