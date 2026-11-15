# CATHAY GROUND OPERATIONS — RECOVERY PERFORMANCE DASHBOARD
## Executable Coding-Agent Brief | Approved Visual Baseline | 14 Nov 2026

**Task:** Implement the existing staff portal's Performance tab as a premium, responsive, production-quality RECOVERY PERFORMANCE AND BUSINESS IMPACT dashboard. This is a WEB APP screen, NOT a presentation, slide, screenshot background, static mockup, mobile React Native app, or redesign of Transfer Control.

**Approved screenshot reference:** "bảng_điều_khiển_hiệu_suất_thu_hồi_hành_lý.png" (provided in ChatGPT conversation; ask user for the image attachment if not available to coding agent). Reproduce its page geometry, design language, chart composition and data hierarchy; the NUMBERS in the picture are illustrative only, not live Cathay stats.

Repo: lighthouse16/polyaero-cathay-smarttag
Correct worktree: D:\projects\Hack\polyaero-staff-v2
Current branch at handoff: feat/flight-first-transfer-control
Primary source: apps/staff (Next.js / React / TypeScript)
Entry: apps/staff/src/components/views/SecondaryViews.tsx -> PerformanceView, mounted from apps/staff/src/app/page.tsx
Snapshot API: apps/staff/src/app/api/v1/transfer-control/route.ts
Existing API/domain: apps/staff/src/lib/types.ts, transferControl.ts, lib/dashboard.ts and tests
Local staff preview: http://localhost:3000
Scope: Performance tab + required verified reporting data contracts, tests, visual QA. Do not modify mobile/NFC/firmware or unrelated application surfaces.

# I. Mission and information architecture

Portal user: baggage transfer control officer, shift supervisor and operations lead at HKG.
Primary question: "How much high-risk baggage did the engine identify, how many alerts led to timely interventions and confirmed onward transfers, and what operational/business benefit can we actually substantiate?"
This is a retrospective/near-real-time OUTCOME reporting page. Transfer Control remains the action queue and flight workbench. Performance is for measuring effectiveness and learning which flights, delays and interventions drive results.

The approved reference has this one-page reading sequence:
A. WHITE global Cathay header (existing app component, unchanged except active Performance tab).
B. Page heading "Performance", subtitle "Transfer performance and recovery impact". Right aligned selectors: reporting window (reference Last 7 days), station HKG and outbound flight filter; refresh if supported.
C. Exactly FOUR dominant KPI cards: High-risk bags identified; Recovery actions taken; Recovered before cutoff; Transfer success %. Large figures, restrained comparison annotations only with valid matched baseline.
D. Two equally important primary visualizations: left Recovery Funnel; right Recovery Performance Over Time.
E. Lower analysis region: wider Outbound Flight Impact table; compact Risk-Cause Breakdown chart; Operational Efficiency breakdown.
F. Full-width bottom Business Impact strip for validated/estimated values only. This must clearly separate observed counts from model estimates.
All within existing desktop grid, no redundant section explanations outside the product UI, no labelled A/B/C design notes, no screenshots embedded as interface, no decorative giant hero.

# II. Cathay styling is LOCKED

Inspect current app's OperationsHeader, tokens, global CSS, font imports, existing typography/color tests, table styles, border radius, shadows, spacings and icons before editing. Reuse them rather than inventing a new system.

- WHITE global header, same exact logo, navbar labels Transfer Control / Baggage Trace / Performance, HKG T1, operational local time, search and operator context as current site. Active Performance link.
- Current polished rounded cards, modest shadows, neat borders and good data density; no hard square-corner rebrand.
- Main text and ALL ordinary icons: Cathay neutral black #2D2D2D; secondary text #66686A or existing neutral where needed; white on genuine dark primary interactive surfaces only.
- Official logo brand #005D63 is reserved for logo. Cathay primary active darkcyan #163230, default #367878, darkgreen active #002527, default #2C4036. Choose one restrained green family for chart series/selection (not many unrelated greens).
- White, #F9F9F9 and neutral #E6E7E8 for surfaces/dividers. Deep red/maroon only where high risk or adverse outcome semantically requires it.
- NO pastel mint, pale pink, baby blue, pastel yellow, colored icon bubble, rainbow statuses, large tinted card backgrounds, glassmorphism, gradients, neon glow, AI sparkles, generic SaaS template, random donut charts or fake sparkline ornamentation. Exception: charts may use a tonal green scale so distinct series are readable; use legend, texture/labels where required.
- Use the actual Cathay font in the repository if present; otherwise existing fallback. Keep heading and chart text crisp and spelling exact.
- Build semantic HTML and accessible SVG/chart components. Never use the image itself as UI background.

# III. Exact functional modules

1) HEADER AND COHORT FILTERS:
- Reporting period (Last 24 hours / Last 7 days / Last 30 days / custom when supported), station HKG, outbound flight (All or chosen flight); all filters update the SAME reporting cohort across KPI, funnel, trend, table and impact.
- Each KPI/chart must surface its analysis period, eligible population, source freshness, and any unavailable prerequisites unobtrusively.
- Historical data may not exist. Disable unsupported choices or show a precise data-unavailable state; do not pretend a 7-day period contains real history merely because UI allows it.
- Refresh refetches verified reporting source; loading, error, no data and stale states gracefully handled, no blank dashboard or jumpy poll.

2) FOUR TOP KPIs:
- High-risk bags identified: unique high-risk baggage transfer CASES first assessed in selected window, de-duplicated by bag + specific connection + risk episode; threshold from documented engine, not arbitrary UI constants.
- Recovery actions taken: unique cases with a recorded, acknowledged recovery action/dispatch by staff; recommendation itself != action, click alone != completed action.
- Recovered before cutoff: unique previously high-risk cases with a verified handling/loaded milestone BEFORE the authoritative outbound loading cutoff; ensure operational definition is precise; if final onward transfer confirmation required, expose distinction from merely "loaded".
- Transfer success %: all eligible transfer connections successfully loaded/transferred divided by all eligible resolved connections in same window (or exact upstream contract definition), with denominator and exclusions. Do not substitute risk cohort for this denominator.
- Never hardcode 1,482 / 1,376 / 1,289 / 97.2%. No invented "+15.4%", "+1.9 pp" or week-on-week baseline. Unavailable or not yet measurable must be shown as "—" with a concise reason where appropriate.

3) RECOVERY FUNNEL:
- Five named stages matching reference: High-risk detected -> Actioned -> Located -> Loaded -> Successfully transferred.
- A cohort-based, UNIQUE CASE stage model; one case progresses through distinct verified milestones. Each stage <= previous stage for same cohort; late-arriving events, skipped stages and re-opened cases need documented handling; never count repeated scans as new bags.
- Each segment shows stage count and conversion share / prior stage when available. Do not invent counts. If event fields do not support particular stage, show stage "— / data unavailable" (not misleading 0). Visually preserve horizontal progressive funnel layout with restrained dark-to-light neutral/green accents; no rainbow.
- "Saved from missing connection" is NOT synonymous with "high-risk loaded". A causal prevented-miss claim needs a validated counterfactual/control method. Without it, use "Confirmed high-risk transfers before cutoff" not "saved" as a literal fact.

4) RECOVERY PERFORMANCE OVER TIME:
- Faithful combo chart from screenshot: grouped bars for High-risk identified and Recovered/confirmed high-risk transfers, plus a separate line for recovery success rate when data permits.
- Honest time buckets aligned with reporting filter (hour/day/week); accurate timezone Asia/Hong_Kong; no interpolated fictional points.
- Two Y axes properly labeled (counts left, % right 0–100), legible tick marks, values/tooltips, accessible table alternative. Avoid false axis scaling, misleading percentages or unlabeled dual axis.
- If historical buckets unavailable, provide a polished empty-state chart frame and reason, NOT fake trend bars or a flat line.

5) OUTBOUND FLIGHT IMPACT:
- Reuse dense existing table styling and sorting. Columns: Outbound Flight, Route, Transfer bags, High-risk bags, Recovered/confirmed before cutoff, Save rate (clearly operationally defined). Optional open connection action opens existing Transfer Control workbench for that outbound flight when relationship is real.
- Group by STABLE outbound flight LEG including operating date, not by flight number alone across dates; only use explicit inbound→outbound transfer mapping.
- Rates use each flight's completed/eligible high-risk cases with correct denominator; if unresolved, say pending or show excluded counts. No passenger name/PNR in analytics.
- Never assert 8 rows from screenshot are real. With current snapshot, show known leg(s) and unavailable fields honestly.

6) RISK-CAUSE BREAKDOWN:
- Chart only if underlying per-case risk factor evidence exists. Prefer a horizontal bar breakdown or compact donut matching reference if a unique PRIMARY CAUSE per case is defined; no category duplication hidden.
- Example categories (Inbound delay, Short connection, Missing transfer scan, Hub congestion, Loading pressure) are illustrative; only show categories supported by engine's recorded evidence.
- If multiple factors per bag, label "mentions" and do NOT force sum to 100%; if single primary factor, sum of mutually exclusive categories may be 100%.
- Accessible labels/legend, source attribution, clear "Unavailable" if not captured.

7) OPERATIONAL EFFICIENCY:
- Median alert -> first acknowledged action; median action -> verified location; cases resolved before cutoff, all computed with consistent event ordering and timezone, sample sizes. Show actual units and n.
- Do not use fabricated improvements against nonexistent baseline. Click/filter should cross-highlight relevant cohort only when backed by real data.
- Avoid inflating stats via manually created or repeated scan events.

8) BUSINESS IMPACT:
- Clear hierarchy: Observed metrics (confirmed high-risk transfers before cutoff, actions executed) vs ESTIMATES / scenario projections.
- Potential missed connections avoided: requires causally grounded expected missed-connection probability without intervention, comparison/control or documented predictive model. NEVER claim all recovered high-risk bags represent missed connections avoided. Without valid attribution => N/A (model unavailable).
- Staff hours saved: needs measured change in labor minutes versus comparable baseline or explicitly assumption-based scenario with visible formula/assumptions, confidence bounds if possible.
- Estimated service recovery cost avoided: needs currency, applicable unit costs, service recovery incidence, sourced assumptions. If not verified, do not fabricate HK$1.36M. Show unavailable or an clearly opt-in assumption model separately from operational facts.
- Data freshness and coverage can be a small factual footnote, not "Demo data" banner everywhere. Never imply test manifests are actual Cathay airline statistics.

# IV. Current code/data situation (verified at handoff)

- Existing PerformanceView (apps/staff/src/components/views/SecondaryViews.tsx) currently shows only "Current authorized snapshot only. Historical operational metrics unavailable", snapshot coverage and back button.
- Existing Transfer Control endpoint /api/v1/transfer-control returns unavailable with empty bags/legs/connections in production until authorized upstream sources are configured; test fixture can only load locally if STAFF_QA_FIXTURE=1 and NODE_ENV != production.
- Earlier QA fixture contained 46 bags and one inbound flight CX616: 28 connect to CX255, 18 to CX777; this fixture is not 7-day recovery history and must NOT be used as proof of outcomes. Current local data may change.
- LiveBag bag risk data and transfer-connection relationship are not enough for recovered cases, action approval timeline, missed-connection counterfactual, cost savings or historical trends. Build explicit reporting contracts and safe empty states. Add an adapter only if source data exists and provenance is verified; don't silently invent a second data store or produce random synthetic history in the app.

# V. Engineering structure

1. Audit local worktree, Git branch/status, files and existing tests. Do not reset or overwrite preexisting changes; preserve pnpm-lock.yaml or any other dirty user edits. Do not touch IoT/NFC worktree. Create task-specific branch if safe.
2. Build reusable web components: PerformanceFilterBar, PerformanceKPI, RecoveryFunnel, RecoveryTrendChart, OutboundImpactTable, RiskCauseBreakdown, OperationalEfficiency, BusinessImpact. Prefer existing staff tokens and chart dependencies; add a lightweight charting library only if necessary and compatible.
3. Create typed analytics data contract and aggregation (server-side or isolated pure functions): event lifecycle/provenance, risk episodes, action acknowledgements, load/connection confirmations, cutoff, cohort/window and baseline metadata.
4. Update PerformanceView ONLY; preserve existing Transfer Control, Baggage Trace, FlightWorkbench and other workflow behavior. No page routing invention or duplicate headers.
5. Implement interactions: period, flight, refresh, sorting, chart tooltips/legend, drilldown to existing flight workbench only if valid IDs, keyboard navigation, accessible semantics. Do not ship dead controls.
6. Animations: restrained premium entrance transitions 160–320 ms; number count-up only when verified values exist; funnel reveal, bars rise and line path draw once on initial/period load. No replay each polling tick. Respect prefers-reduced-motion; preserve legibility and avoid flashy loops.
7. Screenshot comparison at 1648x928 and 1536x960 using SAME global header; test 1440x900, 1280x800, tablet 768px and mobile 390px. No overlapping cards, clipped tables, absent labels or unintended sideways scroll.
8. Add unit/integration tests for case dedupe, stage ordering, percent denominators, unknown vs zero, time window, HKT boundaries, cutoff semantics, multiple leg dates, missing evidence, no invented values, baseline availability and failure states.
9. Run pnpm lint, pnpm typecheck, pnpm --filter @polyaero/staff test, pnpm --filter @polyaero/staff build. Also backend tests if touched.
10. Report: screenshots, exact source/metric definitions/formulas, constraints and unavailable metrics, commands/results, changed files/commit and PR if allowed. Do NOT merge/deploy/force-push without approval.

# VI. Acceptance criteria

- [ ] Pixel-conscious faithful implementation of approved website screenshot's layout and chart hierarchy (not slide and not standalone HTML mock).
- [ ] Same white Cathay app shell and existing visual style, neutral black text/icons, professional rounded components; NO pastel/AI slop.
- [ ] Four business-outcome KPI cards with accurate definitions and honest unavailable states.
- [ ] Funnel stage transitions and count math correct with tests and verified provenance.
- [ ] Trend graph visualizations use actual time-series buckets and accurate axes; no fake history.
- [ ] Flight impact is outbound/connection-level, sorted and actionable; no PII.
- [ ] Root-cause and operations efficiency charts are evidence-driven.
- [ ] Business value distinguishes OBSERVED from ESTIMATED and from unproven CAUSAL impact.
- [ ] Filters, interactions, screen sizes, animations/reduced-motion and accessibility work.
- [ ] Current flight-first Transfer Control still works; backend/mobile/NFC unchanged unless explicitly needed.
- [ ] All tests/builds and actual browser screenshot QA reported, branch safe, no deployment/merge.

**START WORK:** Execute the audit, implementation, tests and screenshot iteration within this task now. Do not stop after producing a plan. Escalate only a real missing external data/access dependency; build an honest reporting UI with unavailable states meanwhile.
