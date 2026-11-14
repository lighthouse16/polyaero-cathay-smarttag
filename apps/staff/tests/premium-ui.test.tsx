import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BaggageTraceView, traceTone } from "../src/components/views/SecondaryViews";
import { PerformanceDashboard } from "../src/components/performance/PerformanceDashboard";
import { RecoveryFunnel } from "../src/components/performance/RecoveryFunnel";
import { PerformanceKpiGrid } from "../src/components/performance/PerformanceKpiGrid";
import { OperationalEfficiency } from "../src/components/performance/OperationalEfficiency";
import { RiskCauseBreakdown } from "../src/components/performance/RiskCauseBreakdown";
import { buildUnavailablePerformanceReport } from "../src/lib/performance";

it("unknown custody status is not a successful or verified record", () => {
  expect(traceTone("UNRECOGNIZED")).toBe("unknown");
  expect(traceTone("LOADED")).toBe("track");
  const html = renderToStaticMarkup(<BaggageTraceView bags={[]} selectedTagNumber="" onSelectBag={() => {}} onSwitchToTransferControl={() => {}} />);
  expect(html).not.toContain("airside verified");
  expect(html).not.toContain("is-live");
});

it("counts without denominators have no invented full meter", () => {
  const report = buildUnavailablePerformanceReport({ filters: { window: "7d", station: "HKG", outboundLegId: "all" }, now: new Date("2026-11-14T12:00:00Z") });
  const metric = { ...report.kpis[0], value: 8, numerator: 8, denominator: null };
  const html = renderToStaticMarkup(<PerformanceKpiGrid kpis={[metric]} loading={false} />);
  expect(html).not.toContain("kpiMeterTrack");
});

it("efficiency medians have no invented SLA denominator", () => {
  const html = renderToStaticMarkup(<OperationalEfficiency efficiency={{ medianAlertToActionMin: 5, alertToActionSampleSize: 8, medianActionToLocateMin: 11, actionToLocateSampleSize: 6, resolvedBeforeCutoffCount: null, resolvedBeforeCutoffPct: null, resolvedBeforeCutoffDenominator: null, pendingExcludedCount: 0, availabilityNote: null }} />);
  expect(html).not.toContain("efficiencyMeterTrack");
});

it("risk cause inspection uses keyboard-operable native buttons", () => {
  const html = renderToStaticMarkup(<RiskCauseBreakdown summary={{ mode: "primary_exclusive", totalCases: 2, items: [{ category: "Inbound delay", count: 2, sharePct: 100 }], availabilityNote: null }} />);
  expect(html).toMatch(/<button[^>]*aria-pressed="false"/);
  expect(html).not.toMatch(/<li[^>]*tabindex/);
});


it("expired reports never render retained KPI values as current", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const report = buildUnavailablePerformanceReport({ filters: { window: "7d", station: "HKG", outboundLegId: "all" }, now });
  report.availability = "available";
  report.validUntil = "2026-11-14T11:59:00Z";
  report.kpis[0].value = 7654321;
  expect(renderToStaticMarkup(<PerformanceDashboard initialReport={report} now={now} />)).not.toContain("7,654,321");
});

it("zero-count funnel stages keep zero-width proportions", () => {
  const html = renderToStaticMarkup(<RecoveryFunnel note={null} stages={[
    { key: "detected", label: "Detected", count: 100, stepConversionPct: null, cumulativePct: 100, definition: "Detected", availabilityNote: null },
    { key: "actioned", label: "Actioned", count: 0, stepConversionPct: 0, cumulativePct: 0, definition: "Actioned", availabilityNote: null },
  ]} />);
  expect(html).toContain("width:0%");
  expect(html).not.toContain("width:8%");
});
