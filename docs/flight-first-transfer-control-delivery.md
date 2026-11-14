# Flight-first transfer control — delivery report

## Status

**Draft / visual QA pending.** Staff lint, typecheck,103tests and production build pass. Root lint/typecheck fail pre-existing mobile workspace errors. Browser captures20state/viewport screenshots and confirms core data/DOM behavior, but current tools cannot inspect image pixels, computed contrast or console. Exact mobile overflow and stable Escape/polling behavior remain pending verification. No merge or deployment.

User explicitly waived ChatGPT review on2026-11-14 (“sao rồi, không cần reviewer chatgpt đâu”); independent source review used. No external reviewer approval claimed.

## Base and protected changes

- Worktree `D:/projects/Hack/polyaero-staff-v2`; branch `feat/flight-first-transfer-control` from `feat/staff-dashboard-v2` at `91253d8e608a4dcfe2c3fd005fdd3fc34e4368a8`.
- Protected pre-existing [pnpm-lock.yaml](file:///D:/projects/Hack/polyaero-staff-v2/pnpm-lock.yaml) unchanged SHA256 `E3F412362E3B8855DC21E4EA69BBB2BF30FFDCFE3C8A61828EC4C8F7CABFCCCC`,367663bytes.
- Protected untracked [task contract](file:///D:/projects/Hack/polyaero-staff-v2/docs/agent-tasks/FLIGHT_FIRST_TRANSFER_CONTROL.md) unchanged SHA256 `754EEB6D4C7131E27DD1E46DB767736A94B091D0FAE4345A91E1D822E857E985`,15206bytes. Not included in task commit.
- Mobile/NFC worktree, firmware, FastAPI/shared packages, network and existing port3000server untouched. No dependencies or lock changes.
- QA uses own4318/4319ports and ignored `.next/qa-*` output directories. Next-generated config paths restored before staging; no generated output committed.

## Data source and formulas

[route.ts](file:///D:/projects/Hack/polyaero-staff-v2/apps/staff/src/app/api/v1/transfer-control/route.ts) provides same-origin read-only `GET /api/v1/transfer-control`, `Cache-Control:no-store`. Staff views share this single snapshot. No join against legacy Next/FastAPI demo stores. Production default is explicitly unavailable with all arrays empty and null transfer success because authorized operational source is absent.

[types.ts](file:///D:/projects/Hack/polyaero-staff-v2/apps/staff/src/lib/types.ts) models upstream stable FlightLeg IDs plus operating date, explicit BagTransferConnection bag/inbound/outbound IDs, separate FlightRiskAssessment/BagRiskAssessment metadata and source validity. Single legacy flight_number never infers incoming/outgoing association.

[transferControl.ts](file:///D:/projects/Hack/polyaero-staff-v2/apps/staff/src/lib/transferControl.ts) validates copied, allowlisted records. It rejects ambiguous IDs, dangling/HKG-incompatible associations, non10digit tags, duplicate event IDs, malformed dates/offsets, causality errors and incoherent terminal status. Passenger/PNR/seat/delivery data blanked; unknown properties dropped.

- Counts use unique active HKG bag relations; incoming total equals summed outbound totals. Supplied action_required/at_risk/on_track/unknown are disjoint; missing attention is not on track.
- Flight risk and bag risk use independent upstream model/version/assessment/evidence/validity. Never average bag scores, never fall back to bare legacy risk_score. Stale or superseded inputs suppress score; unsupported connection risk remains unavailable.
- Time to Act minutes: `(Date.parse(deadline.at) - now.getTime()) / 60000`, only supplied `latest_intervention` deadline with fresh snapshot, relation, both legs and cutoff provenance. No departure offset or connection-buffer subtraction. Overdue stays negative; missing/stale unavailable. Timestamps displayed Asia/Hong_Kong with date.
- Transfer success: `100 * successful / eligible`, only supplied complete eligible population/window, nonzero denominator and current provenance. Queue/filter counts never denominator.
- Journey records source-reported; scanner string not proof of hardware gate. SmartTag preview has no Online/battery/physical-update claim. No staff writes/allocation without authorized durable API.

## UI changes

Shared white Cathay header, fixed Transfer Control/Baggage Trace/Performance navigation, actual official logo and local CathaySans/GT-Walsheim. No sidebar or network Inter. Four KPI headings only.

[FlightWorkbench.tsx](file:///D:/projects/Hack/polyaero-staff-v2/apps/staff/src/components/transfer/FlightWorkbench.tsx) keeps S2onward connections, S3pair bags and S4case in one native dialog. Full bag tags; no PII lists/search. Parent selection clears incompatible child; in-dialog search resolves real pair. Covered compact drawer panes inert. Four inspector tabs retained, reported event ordering and bounded childless LLM area. No fake narratives, controls, telemetry or dataset banner.

## Validation

Exact commands run in staff worktree; production build fixture env unset and `STAFF_QA_DIST_DIR=.next/qa-delivery`. Final CSS containment validation rerun passed17:12.

| Command | Result |
|---|---|
| `pnpm lint` | **FAIL exit1**, existing mobile12errors/3warnings: unresolved @polyaero/shared/design-tokens. Staff/shared/design-tokens lint Done. Same baseline before changes. |
| `pnpm typecheck` | **FAIL exit1**, existing mobile TS2307 plus related TS7006/TS2322/TS2731. Not full-workspace pass. |
| `pnpm --filter @polyaero/staff lint` | **PASS exit0** |
| `pnpm --filter @polyaero/staff typecheck` | **PASS exit0** |
| `pnpm --filter @polyaero/staff test` | **PASS103/103,9/9files**, no skips |
| `pnpm --filter @polyaero/staff build` | **PASS exit0**, no warnings |

No FastAPI changes, so no backend Python run required. Modified Next API covered by staff tests. Tests cover46=28+18, risk92vs82, identity/count/PII boundaries, causal/freshness/timezone/overnight/null/negative/stale cases, newer evidence, terminal status, success denominator, unavailable vs available-empty, selection reducer, blankLLM and source-level responsive/style contracts. SSR/source-string tests supplement browser proof, not replace it.

## Browser QA provenance

- Fixture browser conversation `e1793e9a-c57e-44b5-8707-19ad1e5e7b2d`: own `http://127.0.0.1:4318` dev server. Explicit `STAFF_QA_FIXTURE=1`; fixed ignored local `.next/qa-fixtures/transfer-control.json`. Test fixture never loaded in production.
- Default-production browser conversation `a26db80d-15a4-4f7f-9309-f11d1b3315f5`: own4319 production build, fixture env unset. Observed API200 unavailable source `operational-transfer-source-unconfigured`, empty arrays/null success, four emdashKPIs, no default popup/PII/data rows, five-second polling, local font200. Server stopped after QA. Fixture server also stopped after browser cancellation.
- Browser used sanctioned tools; no shell HTTP/curl/Playwright workaround.
- Fixture observed incoming46/flight92, connection28+18, selected pair28/bag82, inspector own82separate from flight92; LLM0children/emptytext, four reported tabs, no fake telemetry.
- Initial active-development captures predate final17:10CSS containment/source freeze, so they are historical runtime evidence, NOT final pixel acceptance. Captured S1–S4 at each1648×928,1440×900,1280×800,768×1024,390×844:20images. Header geometry x0/y0:82px desktop1648/1440,112px1280/768/390; dialogs bounded. NativeS2trap, bagheading focus, tab arrows/Home/End and popupXreturn observed.
- Initial interaction run had HMR during edits, so Escape3layers/mobiletrap/polling-state persistence remain NOT RUN after user canceled browser QA17:10:38; no equivalent retry without new approval. Exact mobile document overflow uncertain due inconsistent returned geometry; CSS containment added but not certified.
- Screenshots are actual saved files. Tools expose no inspectable pixels; visual mockup match, console cleanliness and contrast NOT certified. Source references1672×941 versus required runtime1648×928.

Parent local [delivery evidence](file:///C:/Users/dqmgb/.gemini/antigravity/brain/3ff08a2e-5252-45e2-94d3-eebcb787846a/flight_first_delivery_report.md) links all20screenshots and raw browser outputs; machine-local evidence is not part of repository.

## Local QA reproduction

```powershell
Set-Location D:/projects/Hack/polyaero-staff-v2/apps/staff
node --experimental-strip-types tests/fixtures/generate-qa-fixture.mts
$env:STAFF_QA_FIXTURE='1'
$env:STAFF_QA_DIST_DIR='.next/qa-dev'
pnpm exec next dev --hostname 127.0.0.1 --port 4318
```

This explicit local fixture uses illustrative CX616/46, CX255/28 and bag0160892014/82 only. Generated timestamps move relative to generation and source validity expires four hours later. No factual Cathay/hardware claim. Unset `STAFF_QA_FIXTURE` for honest unavailable default; production ignores it even if set.

## Unresolved dependencies

Authorized transfer manifest/operating-date/schedule/ETA, independent risk/evidence/freshness, latest credible intervention cutoff, complete success population/window, staff identity/PII authorization, durable audited roster/assignment API, authenticated physical telemetry. No operational integration or physical hardware validation claimed.

Commit/PR pending coordinator acceptance; draft/QA-pending PR appropriate while visual tooling gaps remain. Never merge/deploy.

## Changed-file summary

29task files: app header/layout/styles/page and progressive workbench/list/search/inspector; stable transfer types, boundary/selectors and read-only route; exact official logo; regression fixtures/tests; this delivery report. Old hardcoded narratives, telemetry, writes and redundant page UI removed. No dependency/backend/mobile/shared changes. Task manifest recorded separately for explicit path staging; protected files and generated output excluded.
