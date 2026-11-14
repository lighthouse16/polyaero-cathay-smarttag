import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  aggregateRecoveryPerformance,
  buildUnavailablePerformanceReport,
  computeMedian,
  validateRecoveryPerformanceReport,
} from "../src/lib/performance";
import type {
  EligibleTransferRecord,
  OperationalProvenance,
  RecoveryEpisodeRecord,
  TransferControlSnapshot,
} from "../src/lib/types";
import { PerformanceKpiGrid } from "../src/components/performance/PerformanceKpiGrid";
import { RecoveryFunnel } from "../src/components/performance/RecoveryFunnel";
import { RecoveryTrendChart } from "../src/components/performance/RecoveryTrendChart";
import { PerformanceDashboard } from "../src/components/performance/PerformanceDashboard";

const PROV: OperationalProvenance = {
  system: "unit-test",
  recordId: "rec-1",
  observedAt: "2026-11-14T10:00:00Z",
  validUntil: "2026-11-14T18:00:00Z",
};

function makeEpisode(
  overrides: Partial<RecoveryEpisodeRecord> = {},
): RecoveryEpisodeRecord {
  return {
    episodeId: "ep-default",
    bagTag: "0160000100",
    connectionId: "conn-1",
    inboundLegId: "in-1",
    outboundLegId: "out-cx255-13",
    outboundFlightNumber: "CX255",
    outboundOperatingDate: "2026-11-13",
    origin: "HKG",
    destination: "NRT",
    station: "HKG",
    detectedAt: "2026-11-13T04:00:00Z",
    actionedAt: "2026-11-13T04:05:00Z", // 5 min
    locatedAt: "2026-11-13T04:17:00Z", // 12 min
    loadedAt: "2026-11-13T04:25:00Z",
    transferredAt: "2026-11-13T04:50:00Z",
    loadingCutoffAt: "2026-11-13T04:30:00Z",
    outcome: "recovered",
    primaryRiskCause: "Inbound delay",
    riskFactors: ["Inbound delay", "Short connection"],
    provenance: PROV,
    ...overrides,
  };
}

function makeTransfer(
  overrides: Partial<EligibleTransferRecord> = {},
): EligibleTransferRecord {
  return {
    bagTag: "0160000100",
    connectionId: "conn-1",
    outboundLegId: "out-cx255-13",
    outboundFlightNumber: "CX255",
    outboundOperatingDate: "2026-11-13",
    origin: "HKG",
    destination: "NRT",
    station: "HKG",
    observedAt: "2026-11-13T04:50:00Z",
    transferred: true,
    provenance: PROV,
    ...overrides,
  };
}

describe("recovery performance aggregation contracts", () => {
  const now = new Date("2026-11-14T12:00:00Z");

  it("deduplicates repeat episodes and custody scans and enforces monotonic funnel stages", () => {
    const duplicate = makeEpisode({ episodeId: "ep-1", bagTag: "01601" });
    const repeatedScan = makeEpisode({
      episodeId: "ep-1",
      bagTag: "01601",
      provenance: { ...PROV, observedAt: "2026-11-14T10:30:00Z" },
    });
    // Episode with invalid out-of-order locatedAt (< actionedAt) must not increment located/loaded/transferred
    const outOfOrder = makeEpisode({
      episodeId: "ep-2",
      bagTag: "01602",
      detectedAt: "2026-11-13T06:00:00Z",
      actionedAt: "2026-11-13T06:10:00Z",
      locatedAt: "2026-11-13T06:08:00Z",
      loadedAt: "2026-11-13T06:20:00Z",
      transferredAt: null,
      outcome: "pending",
    });

    const report = aggregateRecoveryPerformance({
      episodes: [duplicate, repeatedScan, outOfOrder],
      eligibleTransfers: [
        makeTransfer({ bagTag: "01601" }),
        makeTransfer({ bagTag: "01601" }),
        makeTransfer({ bagTag: "01602", transferred: false }),
      ],
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now,
      generatedAt: now.toISOString(),
      validUntil: "2026-11-14T18:00:00Z",
      source: "test-warehouse",
    });

    expect(validateRecoveryPerformanceReport(report)).toBe(true);
    expect(report.kpis.find((k) => k.id === "highRisk")?.value).toBe(2);
    expect(report.kpis.find((k) => k.id === "actioned")?.value).toBe(2);
    expect(report.kpis.find((k) => k.id === "recoveredBeforeCutoff")?.value).toBe(1);
    // Transfer success is 1/2 = 50.0% because ep-1 repeated scan was deduplicated
    expect(report.kpis.find((k) => k.id === "transferSuccess")?.value).toBe(50);

    const counts = report.funnel.map((s) => s.count);
    expect(counts).toEqual([2, 2, 1, 1, 1]);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!);
    }

    // Pending episode excluded from resolved cutoff denominator
    expect(report.efficiency.resolvedBeforeCutoffDenominator).toBe(1);
    expect(report.efficiency.pendingExcludedCount).toBe(1);
  });

  it("keeps uncaptured stages as null instead of zero and separates dates for identical flight numbers", () => {
    const day1 = makeEpisode({
      episodeId: "ep-d1",
      bagTag: "01611",
      outboundLegId: "leg-nov12",
      outboundOperatingDate: "2026-11-12",
      detectedAt: "2026-11-12T04:00:00Z",
      primaryRiskCause: null,
      riskFactors: ["Short connection", "Hub congestion"],
    });
    const day2 = makeEpisode({
      episodeId: "ep-d2",
      bagTag: "01612",
      outboundLegId: "leg-nov13",
      outboundOperatingDate: "2026-11-13",
      detectedAt: "2026-11-13T04:00:00Z",
      outcome: "missed",
      loadedAt: "2026-11-13T04:40:00Z", // After 04:30 cutoff -> not recovered before cutoff
      transferredAt: null,
      primaryRiskCause: null,
      riskFactors: ["Short connection"],
    });

    const report = aggregateRecoveryPerformance({
      episodes: [day1, day2],
      eligibleTransfers: [],
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now,
      generatedAt: now.toISOString(),
      validUntil: "2026-11-14T18:00:00Z",
      source: "test-warehouse",
      capturedStages: ["detected", "actioned", "transferred"],
    });

    expect(report.funnel.find((s) => s.key === "located")?.count).toBeNull();
    expect(report.funnel.find((s) => s.key === "loaded")?.count).toBeNull();
    expect(report.outboundImpact).toHaveLength(2);
    expect(report.outboundImpact.map((r) => r.operatingDate).sort()).toEqual([
      "2026-11-12",
      "2026-11-13",
    ]);
    // Multi-factor mentions mode never claims mutually exclusive 100% shares
    expect(report.riskCauses.mode).toBe("multi_factor_mentions");
    expect(report.riskCauses.items[0]).toMatchObject({
      category: "Short connection",
      count: 2,
      sharePct: 100,
    });
  });

  it("computes statistical medians accurately and suppresses modeled business impact without assumptions", () => {
    expect(computeMedian([])).toBeNull();
    expect(computeMedian([3, 10, 5])).toBe(5);
    expect(computeMedian([2, 4, 8, 10])).toBe(6);

    const e1 = makeEpisode({
      episodeId: "e1",
      bagTag: "01621",
      detectedAt: "2026-11-13T04:00:00Z",
      actionedAt: "2026-11-13T04:04:00Z", // 4 min
      locatedAt: "2026-11-13T04:14:00Z", // 10 min
    });
    const e2 = makeEpisode({
      episodeId: "e2",
      bagTag: "01622",
      detectedAt: "2026-11-13T05:00:00Z",
      actionedAt: "2026-11-13T05:08:00Z", // 8 min
      locatedAt: "2026-11-13T05:22:00Z", // 14 min
    });

    const withoutAssumptions = aggregateRecoveryPerformance({
      episodes: [e1, e2],
      eligibleTransfers: [],
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now,
      generatedAt: now.toISOString(),
      validUntil: null,
      source: "test",
    });

    expect(withoutAssumptions.efficiency.medianAlertToActionMin).toBe(6);
    expect(withoutAssumptions.efficiency.alertToActionSampleSize).toBe(2);
    expect(withoutAssumptions.efficiency.medianActionToLocateMin).toBe(12);
    expect(withoutAssumptions.businessImpact.every((b) => b.value === null)).toBe(true);

    const withAssumptions = aggregateRecoveryPerformance({
      episodes: [e1, e2],
      eligibleTransfers: [],
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now,
      generatedAt: now.toISOString(),
      validUntil: null,
      source: "test",
      counterfactualAssumptions: {
        counterfactualModelVersion: "cf-v1",
        missedConnectionBaselineRate: 0.5,
        methodologyNote: "Estimated historical non-intervened miss rate",
        provenance: PROV,
      },
      laborAssumptions: {
        minutesSavedPerHandledCase: 15,
        methodologyNote: "Time-motion baseline",
        provenance: PROV,
      },
      costAssumptions: {
        currency: "HKD",
        costPerAvoidedMisconnection: 1200,
        methodologyNote: "Standard rerouting/hotel unit assumption",
        provenance: PROV,
      },
    });

    expect(
      withAssumptions.businessImpact.find((b) => b.id === "avoidedMisconnections")
        ?.value,
    ).toBe(1);
    expect(
      withAssumptions.businessImpact.find((b) => b.id === "staffHoursSaved")?.value,
    ).toBe(0.5);
    expect(
      withAssumptions.businessImpact.find((b) => b.id === "costAvoided")?.value,
    ).toBe(1200);
  });

  it("never extrapolates 24h snapshot transferSuccess into 7d/30d reports", () => {
    const snapshot: TransferControlSnapshot = {
      availability: "available",
      generatedAt: "2026-11-14T12:00:00Z",
      validUntil: "2026-11-14T18:00:00Z",
      source: "test-manifest",
      missingInputs: [],
      bags: [],
      legs: [
        {
          id: "in-1",
          flightNumber: "CX616",
          operatingDate: "2026-11-14",
          origin: "BKK",
          destination: "HKG",
          scheduledDepartureAt: "2026-11-14T08:00:00Z",
          scheduledArrivalAt: "2026-11-14T11:30:00Z",
          estimatedDepartureAt: null,
          estimatedArrivalAt: null,
          actualArrivalAt: null,
          provenance: PROV,
        },
        {
          id: "out-1",
          flightNumber: "CX255",
          operatingDate: "2026-11-14",
          origin: "HKG",
          destination: "NRT",
          scheduledDepartureAt: "2026-11-14T14:00:00Z",
          scheduledArrivalAt: null,
          estimatedDepartureAt: null,
          estimatedArrivalAt: null,
          actualArrivalAt: null,
          provenance: PROV,
        },
      ],
      connections: [
        {
          id: "c-1",
          bagTag: "01690001",
          inboundLegId: "in-1",
          outboundLegId: "out-1",
          status: "pending",
          attention: "action_required",
          deadline: null,
          provenance: PROV,
        },
      ],
      flightRisks: [],
      bagRisks: [],
      transferSuccess: {
        successful: 90,
        eligible: 100,
        windowStart: "2026-11-13T12:00:00Z",
        windowEnd: "2026-11-14T12:00:00Z",
        provenance: PROV,
      },
    };

    const report24h = buildUnavailablePerformanceReport({
      filters: { window: "24h", station: "HKG", outboundLegId: "all" },
      now,
      snapshot,
    });
    expect(report24h.kpis.find((k) => k.id === "transferSuccess")?.value).toBe(90);
    expect(report24h.kpis.find((k) => k.id === "highRisk")?.value).toBeNull();
    expect(report24h.outboundImpact).toHaveLength(1);
    expect(report24h.outboundImpact[0]).toMatchObject({
      flightNumber: "CX255",
      transferBags: 1,
      highRiskBags: 1,
      saveRatePct: null,
      inActiveSnapshot: true,
    });

    const report7d = buildUnavailablePerformanceReport({
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now,
      snapshot,
    });
    expect(report7d.kpis.find((k) => k.id === "transferSuccess")?.value).toBeNull();
  });

  it("renders PerformanceDashboard faithfully in both populated and unavailable SSR states", () => {
    const nowDate = new Date("2026-11-14T12:00:00Z");
    const unavailable = buildUnavailablePerformanceReport({
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now: nowDate,
    });
    const unavailableHtml = renderToStaticMarkup(
      <PerformanceDashboard initialReport={unavailable} now={nowDate} />,
    );
    expect(unavailableHtml).toContain("Performance");
    expect(unavailableHtml).toContain("Recovery Funnel");
    expect(unavailableHtml).toContain("Historical time-series unavailable");
    expect(unavailableHtml).toContain("Model unavailable");
    expect(unavailableHtml).not.toContain("1,482");
    expect(unavailableHtml).not.toContain("HK$1.36M");

    const populated = aggregateRecoveryPerformance({
      episodes: [
        makeEpisode({ episodeId: "p-1", bagTag: "01681" }),
        makeEpisode({
          episodeId: "p-2",
          bagTag: "01682",
          primaryRiskCause: "Short connection",
        }),
      ],
      eligibleTransfers: [
        makeTransfer({ bagTag: "01681", transferred: true }),
        makeTransfer({ bagTag: "01682", transferred: true }),
      ],
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now: nowDate,
      generatedAt: nowDate.toISOString(),
      validUntil: "2026-11-14T18:00:00Z",
      source: "qa-fixture",
    });

    const populatedHtml = renderToStaticMarkup(
      <PerformanceDashboard initialReport={populated} now={nowDate} />,
    );
    expect(populatedHtml).toContain("CX255");
    expect(populatedHtml).toContain("Inbound delay");
    expect(populatedHtml).toContain("Short connection");
    expect(populatedHtml).toContain("100.0%");
    expect(populatedHtml).not.toContain('class="operational-table');
    expect(populatedHtml).toContain("<colgroup>");
    expect(populatedHtml).toContain('scope="col"');
    expect(populatedHtml).toContain('aria-sort="descending"');
    expect(populatedHtml).not.toContain("WONG");
    expect(populatedHtml).not.toContain("CX4M1P");
  });
});


describe("performance interaction presentation", () => {
  it("keeps KPI definitions in disclosure, not on compact card face, without inventing deltas", () => {
    const report = aggregateRecoveryPerformance({
      episodes: [makeEpisode()], eligibleTransfers: [makeTransfer()],
      filters: { window: "7d", station: "HKG", outboundLegId: "all" },
      now: new Date("2026-11-14T12:00:00Z"), generatedAt: "2026-11-14T12:00:00Z",
      validUntil: "2026-11-14T18:00:00Z", source: "test",
    });
    const html = renderToStaticMarkup(<PerformanceKpiGrid kpis={report.kpis} loading={false} />);
    expect(html).toContain('aria-label="Key recovery metrics"');
    expect(html).not.toContain(report.kpis[0].definition);
    expect(html).not.toContain("deltaTag");
    expect(html).toContain('aria-label="Methodology: High-risk bags identified"');
    const loading = renderToStaticMarkup(<PerformanceKpiGrid kpis={report.kpis.map(k => ({ ...k, value: null }))} loading />);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("kpiSkeleton");
  });

  it("labels trend inspection as keyboard-accessible data, not nonfunctional buttons", () => {
    const html = renderToStaticMarkup(<RecoveryTrendChart note={null} buckets={[{
      bucketKey: "day", label: "14 Nov", rangeLabel: "14 Nov HKT", detectedCount: 8,
      recoveredCount: 2, eligibleTransferCount: 12, successfulTransferCount: 6, successRatePct: 50,
    }]} />);
    expect(html).toContain("Transfer success rate");
    expect(html).toContain('aria-label="Inspect reporting periods"');
    expect(html).toContain("Use arrow keys");
    expect(html).not.toContain('role="button"');
  });
});


it("plots rates below 80 without clamping and preserves native funnel button semantics", () => {
  const chart = renderToStaticMarkup(<RecoveryTrendChart note={null} buckets={[{
    bucketKey: "day", label: "14 Nov", rangeLabel: "14 Nov HKT", detectedCount: 8,
    recoveredCount: 2, eligibleTransferCount: 100, successfulTransferCount: 76, successRatePct: 76,
  }]} />);
  expect(chart).toContain('cy="60.72"');
  const funnel = renderToStaticMarkup(<RecoveryFunnel note={null} stages={[]} />);
  expect(funnel).not.toContain('role="list"');
});
