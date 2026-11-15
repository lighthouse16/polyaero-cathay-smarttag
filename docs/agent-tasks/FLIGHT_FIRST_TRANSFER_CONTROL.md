# CATHAY GROUND OPERATIONS — FLIGHT-FIRST TRANSFER CONTROL
## Coding Agent Implementation Contract (2026-11-14)

STATUS: Design baseline approved, coding NOT yet started.
Repo: lighthouse16/polyaero-cathay-smarttag.
Correct staff worktree: D:\projects\Hack\polyaero-staff-v2
Start branch: feat/staff-dashboard-v2
Target app: apps/staff (Next.js/React/TypeScript).
Scope: staff portal + verified backend data contracts + tests as required. Do not change Android/mobile app, NFC firmware or unrelated services.

## 1. Mission and user

The actual portal user is an HKG baggage transfer control officer, not a passenger or a general aviation executive. Their goal is to identify incoming aircraft carrying transfer bags that may miss onward flights and organize intervention BEFORE the cutoff.

The operational decision order:
1. Incoming flight: select which aircraft to prioritize, using a distinct Flight Risk Score, count of bags needing attention and earliest actionable deadline.
2. Outbound connection: within that incoming flight, select an onward flight to inspect the relevant transfer-bag workload.
3. Individual bag: select a particular bag with its own independent Bag Risk Score, Time to Act, last event and status.
4. Baggage Case: examine validated evidence and tab history. Reserve the main copilot/LLM content area completely EMPTY until actual LLM integration.

**This is a flight-first TRANSFER CONTROL redesign of workflow/placement, NOT a new visual design system.**

## 2. First audit and change protection — mandatory

- Verify the current staff worktree Git status, worktrees, branches, open PRs, staff app structure, existing local API, FastAPI endpoints and current UI. Do not blindly checkout/rebase.
- A pre-existing modified pnpm-lock.yaml was observed in D:\projects\Hack\polyaero-staff-v2. Preserve all user modifications; do not reset, restore, stash, auto-stage, or overwrite unrelated files.
- The separate worktree D:\projects\Hack\polyaero-cathay-smarttag is currently an IoT/NFC branch. Do not change or switch that worktree.
- Create a safe implementation branch from the staff dashboard code without breaking worktree ownership.
- Read existing apps/staff/src/app/page.tsx, globals.css, layout.tsx, OperationsHeader.tsx, OperationsSidebar.tsx, BaggageRiskTable.tsx, BaggageInvestigationPanel.tsx, CaseJourney.tsx when present, components/views, lib/types.ts, lib/dashboard.ts, lib/baggageStore.ts, the Next.js baggage API routes and FastAPI routes.
- Do not use the pre-existing AGENT_BUILD_PROMPT.md as instructions for this task: it is about passenger mobile UI.
- Treat existing backend/API and actual operational records as functional truth. Treat approved mockups as structural/visual concept only, NOT verified data or hardware telemetry.

## 3. Frozen Cathay design style — absolutely no AI slop

Preserve existing staff dashboard typography, scale, spacing, card elevation, border radius, layout density, table interactions and professional Cathay visual language.

One consistent WHITE global header, same dimensions/alignment and navigational options on S1–S4. Move relevant existing sidebar nav into the top header; remove sidebar. Use actual existing logo asset and preserve global search, HKG/T1 station, station-local clock (if supported), operator identity, notifications (if actionable).

Header navigation should consistently expose Transfer Control, Baggage Trace, Performance. Do not invent separate Operations, Reports, resources pages or change navigation labels between screens.

Text and ordinary icons must use Cathay neutral black #2D2D2D; supporting text may use neutral #66686A when needed for legibility, and white text only when necessary over dark CTA. Cathay logo color #005D63 is for the logo only. Reference brand colors: darkcyan active #163230, default #367878; darkgreen active #002527, default #2C4036. Use brand color sparingly for selected navigation/CTA; default surface white or #F9F9F9, borders #E6E7E8, #BCBEC0. Existing secondary gold #886521 is not license for colored cards.

BANNED: pastel pink, mint, yellow, baby-blue cards, tinted risk rows, rainbow badges, colored icon bubbles, decorative gradients, AI sparkles, glows, glassmorphism, floating decorative surfaces, square-corner rebrand, oversized empty cards, unnecessary status pills, all-purpose wizard templates. Use current nicely ROUNDED card controls, subtle shadows and dense operational tables.

NO breadcrumb stepper or progress UI (e.g., 1 Select feeder -> 2 Bags -> 3 Case). These are data selections, NOT a procedure. No independent screens/pages replacing the workflow modal.

## 4. Four successive states, ONE app and ONE progressive popup

### S1 — Incoming Flight Risk Queue (main Transfer Control page)
- No popup, no Baggage Case, no transfer timeline.
- EXACTLY four top-level indicators: Action required; At risk; On track; Transfer success %.
- State units clearly (bag counts vs flight counts), count eligible records correctly, define the transfer-success denominator; do not hardcode statistics.
- Data table prioritizes INCOMING flights to HKG. Suggested columns: Inbound flight, Origin -> HKG, ETA/arrival, Transfer bags, FLIGHT risk /100, Earliest Time to Act, Action required, Status. If data missing, visibly unavailable; do not fabricate.
- Search/sort/filter by flight, deadline, risk, action-required count and status. Select row opens S2 modal with that inbound flight.

### S2 — Selected Incoming Flight -> Outbound Connections (popup opened)
- One accessible large dialog, dim backdrop, app's WHITE header remains visually unchanged.
- Modal header fixed across S2–S4: selected incoming flight number, origin to HKG, arrival/ETA, separate Flight Risk Score, affected-bag count, earliest actionable deadline (if known).
- Modal body shows a TABLE of onward/outbound connections associated with that incoming leg: outbound flight, HKG destination, departure/loading cutoff (if known), eligible bag count, bags needing action, connection-level risk ONLY when independently supported.
- Select connection -> S3 inside SAME modal. No popup on popup. No wizard stepper.
- Resource allocation belongs at incoming-flight or inbound/outbound connection level; implement an action ONLY if an authorized team/roster/assignment API with real persistence, audit, and success/failure exists. Otherwise do not show active misleading allocation buttons.

### S3 — Selected Outbound Connection -> Bags (same popup)
- Keep modal header exactly unchanged.
- Two-pane body: left = outbound connection selector for chosen inbound; right = only bags in selected inbound->outbound pair.
- Bag table target columns: Bag ID | Flight | Connection | Risk | Time to Act | Status. Avoid redundant data if already visible in workbench header.
- Show FULL, UNMASKED bag tags, e.g. 0160892014. NO passenger names or PNR in main bag list.
- Bag Risk Score is distinct from Flight Risk Score; show Time to Act only when computed from an authoritative actionable cutoff.
- Keep practical search/filter/sort, selected row and stable scrolling. Select bag -> S4.

### S4 — Selected Bag -> Baggage Case Inspector (same popup)
- Three pane body: left outbound connections, center selected pair's bags, right selected Baggage Case inspector.
- Reuse existing BaggageInvestigationPanel, existing cathay card styling, existing tabs Overview / Journey / SmartTag / History where supported. Do not redesign them as generic independent pages.
- Inspector header: full bag ID, selected inbound/outbound connection, own bag risk score, real Time to Act and status. Passenger/PNR not on main lists; only show in case details when legitimately authorized/operationally necessary.
- Journey uses genuine custody events with correct station-local timestamps, source/provenance, and proper ordering. Never label manual staff events as verified NFC/RFID gates.
- Preserve actual SmartTag flows where verified; do not claim battery 98%, Online or E-paper physically updated without telemetry.
- IMPORTANT: KEEP LLM AREA COMPLETELY EMPTY. Remove generic hardcoded risk narrative, fabricated Incoming flight delayed 17 min / no scan detected, fabricated Recommended action and Expected outcome, and unbacked Approve Recovery / Dispatch buttons. Retain a quiet, bounded neutral blank content region for later LLM integration, with NO AI-coming-soon caption, placeholder, spinner, fake controls or decorative illustration.
- Verified structured risk/time/status information outside the blank LLM region may remain.

### Interaction contract
S1 click incoming -> S2.
S2 click outgoing -> S3.
S3 click bag -> S4.
Close case -> S3; unselect outbound -> S2; popup X -> S1.
Escape should close one layer at a time, returning keyboard focus correctly. No stacked dialogs.
Switching outbound connection clears incompatible bag selection; switching bag updates inspector without closing popup. Polling never erases current selection, filters, table scroll or selected tabs. Global bag search should locate real incoming/outgoing pair context, if the relation exists.
Use full-width workbench with anchored header, independently scrolling panes, compact tablet layout and mobile inspector drawer instead of overflowing the page.

## 5. Data modeling and no-fabrication rules

KNOWN GAP: Existing apps/staff/src/lib/types.ts LiveBag contains a single flight_number plus departure_airport/arrival_airport, connection_minutes, bag risk_score and events. This is INSUFFICIENT to infer the incoming flight->outbound flight pair.

Before shipping operational-looking grouping:
- Add/reuse stable FlightLeg (flight ID + operating date + origin/destination + scheduled/estimated timestamps).
- Add/reuse BagTransferConnection (bag tag, inbound leg ID, outbound leg ID, status, cutoff, source/provenance).
- Make inbound flight aggregation and outbound connection aggregation precise; count each transfer bag once in intended scope.
- Model incoming FlightRiskAssessment separately from existing BagRiskAssessment, with model/heuristic version, assessment time, evidence, missing-input status. Do NOT derive flight risk by arbitrary average of bag risk values.
- Time to Act must be time until latest credible intervention/handling deadline in Asia/Hong_Kong, not the whole connection buffer and not an arbitrary fixed offset. If unknown, render "—"/unavailable.
- Validate delayed inbound, tight connections, missing scans, late scan, timezone/overnight connection, stale data, null deadlines, multiple outbound flights and mixed bag scores.
- Reconcile FastAPI vs Next.js local backend/API stores. Maintain one documented frontend source of truth; avoid silently making two independent baggage states.
- No hardcoded counts or 93.4%, no fictional live Cathay data. UI should NOT have a "Demo data" badge/banner (owner requested its removal); isolate fixtures in test/dev code and label source in docs. When no valid records, show transparent unavailable/empty states rather than inventing data.
- The reference scenario can be used ONLY as a design/testing fixture: CX616 BKK->HKG (46 transfer bags, possible illustrative flight risk 92); 28 of those bags connect onward CX255 HKG->NRT, and bag 0160892014 has possible bag risk 82. For validation, connection counts must add up; never replace 46 incoming total with 28 connection total. Treat ALL risk/count values as sample fixture, not factual records.

## 6. Engineering plan for coding agent

A. Audit target staff worktree, code, branch, pre-existing changes, API/risks, existing component styles, and screenshots.
B. Define explicit flight/connection/bag data types and grouping methods; implement safe backend contracts or adapters with tested evidence and missing-data behavior.
C. Implement one WHITE horizontal Cathay header, remove sidebar only in staff dashboard, preserve existing global search, views and shortcuts.
D. Implement four view states, reusing current rounded cards/tables and typography: incoming queue -> outbound connections -> connection bags -> case inspector. Keep one dialog with progressive contents.
E. Remove static fake Copilot action/reason content; leave reserved LLM region visually empty. Preserve existing real staff actions only outside the empty future-Copilot slot when properly authorized and backed.
F. Test and visually QA S1–S4 at the SAME 1648x928 viewport; also 1440x900, 1280x800, tablet and 390px mobile. Compare header position/font, radius, shadows, pane proportions and no pastel/stepper rule. Fix UI defects BEFORE reporting completed.
G. Run pnpm lint, pnpm typecheck, pnpm --filter @polyaero/staff test, pnpm --filter @polyaero/staff build; backend tests if modified. Add coverage for flight/connection counting, risk separation, time-to-act, selected context, filtering, Escape/close focus, polling stability, API error/stale state and PII.
H. Commit only task-specific changes on safe feature branch; send screenshots, QA report, test outcomes, changed-file summary, commit SHA and a PR for review if authorized. Do not deploy, merge, force push or disrupt other worktrees.

Avoid creating huge single-file UI, avoid redundant component frameworks, preserve existing Next.js/React/TypeScript architecture. If missing backend data is a real blocker, implement data contracts and honest unavailable state; document which upstream integration is needed. Do not pretend the flow has been physically validated.

## 7. Acceptance checklist

[ ] Shared WHITE header, same menu/spacing/icons across S1–S4; no sidebar.
[ ] Cathay existing font/radius/shadow/tables; black neutral text and icons; no AI-slop pastel surfaces.
[ ] Four KPI headings only, accurately defined counts and success denominator.
[ ] Incoming flight risk score displayed as primary flight-level prioritization; separate from bag risk.
[ ] Outbound connection list belongs to selected incoming; no fake relationship inference.
[ ] Connection bag table shows full Bag ID, per-bag risk, real Time to Act, status; no passenger/PNR.
[ ] Baggage Inspector stays in same one modal; validated journey/status tabs.
[ ] LLM region COMPLETELY BLANK and no simulated action/reason/approve recovery.
[ ] No wizard stepper, stacked popup, screen-specific header changes, fake data banners.
[ ] Proper selection/back/close/Escape, keyboard, polling, loading/error/empty, responsive.
[ ] No fabricated time/score/operational claim or fake hardware telemetry.
[ ] Existing mobile/NFC/firmware and user pre-existing changes untouched.
[ ] Tests/build/screenshot QA report provided; no merge or deployment without approval.

## 8. Mandatory delivery report

Report (1) base worktree/branch and protected dirty files, (2) exact source for inbound/outbound association, flight risk vs bag risk, time-to-act formula and provenance, (3) screenshots of S1–S4, (4) typecheck/lint/test/build results, (5) accessible interactions and responsive QA, (6) unresolved dependencies, (7) commit/PR link if available.

Activation: once the owner explicitly invokes this document, execute phases A–H end-to-end now. Do not ask for generic confirmation, do not stop after writing a plan, and do not assume missing operational data exists.
