"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PerformanceFilterState,
  RecoveryPerformanceReport,
  TransferControlSnapshot,
} from "../../lib/types";
import {
  buildUnavailablePerformanceReport,
  validateRecoveryPerformanceReport,
} from "../../lib/performance";
import { BusinessImpact } from "./BusinessImpact";
import { OperationalEfficiency } from "./OperationalEfficiency";
import { OutboundImpactTable } from "./OutboundImpactTable";
import { PerformanceFilterBar } from "./PerformanceFilterBar";
import { PerformanceKpiGrid } from "./PerformanceKpiGrid";
import { RecoveryFunnel } from "./RecoveryFunnel";
import { RecoveryTrendChart } from "./RecoveryTrendChart";
import { RiskCauseBreakdown } from "./RiskCauseBreakdown";
import styles from "./PerformanceView.module.css";

interface PerformanceDashboardProps {
  snapshot?: TransferControlSnapshot | null;
  now?: Date;
  initialReport?: RecoveryPerformanceReport | null;
  onInspectOutboundFlight?: (outboundLegId: string) => void;
  onSwitchToTransferControl?: () => void;
}

const DEFAULT_FILTERS: PerformanceFilterState = {
  window: "7d",
  station: "HKG",
  outboundLegId: "all",
};

export function PerformanceDashboard({
  snapshot = null,
  now,
  initialReport = null,
  onInspectOutboundFlight,
}: PerformanceDashboardProps) {
  const [filters, setFilters] = useState<PerformanceFilterState>(DEFAULT_FILTERS);
  const [apiReport, setApiReport] = useState<RecoveryPerformanceReport | null>(
    initialReport,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialReport);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestIdRef = useRef(0);
  const skipFirstFetchRef = useRef(Boolean(initialReport));

  const loadReport = useCallback(
    async (
      nextFilters: PerformanceFilterState,
      signal?: AbortSignal,
    ) => {
      const id = ++requestIdRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          window: nextFilters.window,
          station: nextFilters.station,
          outboundLegId: nextFilters.outboundLegId,
        });
        const response = await fetch(
          `/api/v1/recovery-performance?${params.toString()}`,
          { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as unknown;
        if (signal?.aborted || requestIdRef.current !== id) return;
        if (validateRecoveryPerformanceReport(json)) {
          if (json.window !== nextFilters.window || json.station !== nextFilters.station) throw new Error("Reporting cohort mismatch");
          setApiReport(json);
          setLoadError(null);
        } else {
          throw new Error("Invalid performance report");
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (signal?.aborted || requestIdRef.current !== id) return;
        setApiReport(null);
        setLoadError("Performance report unavailable. Retry to load selected reporting cohort.");
      } finally {
        if (!signal?.aborted && requestIdRef.current === id) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (skipFirstFetchRef.current && refreshNonce === 0) {
      skipFirstFetchRef.current = false;
      return;
    }
    skipFirstFetchRef.current = false;
    const ctrl = new AbortController();
    void loadReport(filters, ctrl.signal);
    return () => ctrl.abort();
  }, [filters, refreshNonce, loadReport]);

  const effectiveNow = useMemo(() => now ?? new Date(), [now]);

  const report = useMemo<RecoveryPerformanceReport>(() => {
    if (apiReport && apiReport.availability !== "unavailable" &&
        apiReport.validUntil !== null && Date.parse(apiReport.validUntil) > effectiveNow.getTime()) {
      return apiReport;
    }
    return buildUnavailablePerformanceReport({
      filters,
      now: effectiveNow,
      snapshot,
      missingInputs: apiReport?.missingInputs,
    });
  }, [apiReport, filters, effectiveNow, snapshot]);

  // Merge active snapshot flight filter options alongside any upstream options cleanly
  const outboundOptions = useMemo(() => {
    if (report.outboundFilterOptions.length > 0) {
      return report.outboundFilterOptions;
    }
    return buildUnavailablePerformanceReport({
      filters,
      now: effectiveNow,
      snapshot,
    }).outboundFilterOptions;
  }, [report.outboundFilterOptions, filters, effectiveNow, snapshot]);

  const activeLegIdSet = useMemo(() => {
    const ids = new Set<string>();
    if (snapshot && snapshot.availability === "available") {
      for (const leg of snapshot.legs) {
        if (leg.origin === filters.station) ids.add(leg.id);
      }
    }
    return ids;
  }, [snapshot, filters.station]);

  const enrichedOutboundRows = useMemo(
    () =>
      report.outboundImpact.map((row) => ({
        ...row,
        inActiveSnapshot: activeLegIdSet.has(row.outboundLegId),
      })),
    [report.outboundImpact, activeLegIdSet],
  );

  return (
    <section
      className={`view-stage ${styles.performanceStage}`}
      data-updating={loading ? "true" : undefined}
      aria-labelledby="performance-title"
    >
      <h1 id="performance-title" className="sr-only" tabIndex={-1}>
        Performance
      </h1>
      <PerformanceFilterBar
        filters={filters}
        onChangeFilters={(next) => {
          if (next.window === filters.window && next.station === filters.station && next.outboundLegId === filters.outboundLegId) return;
          ++requestIdRef.current;
          setLoading(true);
          setApiReport(null);
          setLoadError(null);
          setFilters(next);
        }}
        report={report}
        outboundOptions={outboundOptions}
        loading={loading}
        onRefresh={() => {
          setLoading(true);
          setRefreshNonce((n) => n + 1);
        }}
      />

      {loadError && <p className="data-notice" role="alert">{loadError}</p>}
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? "Updating performance metrics" : "Performance metrics updated"}
      </span>
      <PerformanceKpiGrid kpis={report.kpis} loading={loading} />

      <div className={styles.upperGrid}>
        <RecoveryFunnel stages={report.funnel} note={report.funnelNote} />
        <RecoveryTrendChart buckets={report.trend} note={report.trendNote} />
      </div>

      <div className={styles.lowerGrid}>
        <OutboundImpactTable
          rows={enrichedOutboundRows}
          definition={report.outboundImpactDefinition}
          onInspectOutboundFlight={onInspectOutboundFlight}
        />

        <div className={styles.lowerRightStack}>
          <div className={styles.middleRightSplit}>
            <RiskCauseBreakdown summary={report.riskCauses} />
            <OperationalEfficiency efficiency={report.efficiency} />
          </div>
          <BusinessImpact items={report.businessImpact} />
        </div>
      </div>
    </section>
  );
}
