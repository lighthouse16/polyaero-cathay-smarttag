"use client";
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SidebarView, TransferControlSnapshot } from "../lib/types";
import { aggregateOutboundFlights, findBagConnection, transferMetrics, validateTransferSnapshot, isTransferSnapshotFresh } from "../lib/transferControl";
import { OperationsHeader } from "../components/layout/OperationsHeader";
import { OutboundFlightQueue, stationTime } from "../components/transfer/OutboundFlightQueue";
import { FlightWorkbench } from "../components/transfer/FlightWorkbench";
import { emptySelection, transferSelection } from "../components/transfer/selection";
import { GlobalSearchModal } from "../components/search/GlobalSearchModal";
import { BaggageTraceView, PerformanceView } from "../components/views/SecondaryViews";
import { RefreshIcon } from "../components/icons/DashboardIcons";
import { AnimatedNumber } from "../components/ui/AnimatedNumber";

export default function StaffDashboardPage() {
  const [snapshot, setSnapshot] = useState<TransferControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [view, setView] = useState<SidebarView>("transfer-control");
  const [selection, select] = useReducer(transferSelection, emptySelection);
  const [searchOpen, setSearchOpen] = useState(false);
  const [actionOnly, setActionOnly] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const busy = useRef(false);
  const fetchSnapshot = useCallback(async (signal?: AbortSignal) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch("/api/v1/transfer-control", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Transfer snapshot request failed (${response.status})`);
      const next = validateTransferSnapshot(await response.json());
      if (signal?.aborted) return;
      setSnapshot(next);
      setError(null);
      setNow(new Date());
    } catch {
      if (!signal?.aborted) setError("Transfer data could not be refreshed. Last received records remain visible; current risk and deadlines unavailable.");
    } finally {
      busy.current = false;
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setNow(new Date());
    void fetchSnapshot(controller.signal);
    const timer = setInterval(() => { setNow(new Date()); if (!document.hidden) void fetchSnapshot(controller.signal); }, 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [fetchSnapshot]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (selection.inbound) document.querySelector<HTMLInputElement>("[data-workbench-search]")?.focus();
      else setSearchOpen(v => !v);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [selection.inbound]);
  const clock = now ?? new Date(0);
  const stale = !!error || !snapshot || !isTransferSnapshotFresh(snapshot, clock);
  const metrics = snapshot ? transferMetrics(snapshot, clock) : null;
  const flights = snapshot ? aggregateOutboundFlights(snapshot, clock) : [];
  const displayMetrics = stale ? null : metrics;
  const bags = snapshot?.bags ?? [];
  function locateBag(tag: string) {
    setSearchOpen(false);
    const relation = snapshot ? findBagConnection(snapshot, tag) : null;
    if (!relation) { setContextError(`Outbound / incoming flight context unavailable for bag ${tag}. No flight association inferred.`); return; }
    setContextError(null);
    setView("transfer-control");
    select({ type: "outbound", id: relation.outboundLegId });
    select({ type: "inbound", id: relation.inboundLegId });
    select({ type: "bag", id: tag });
  }
  const [statusFilter, setStatusFilter] = useState("");

  function toggleKpiFilter(kind: "action" | "status", value?: string) {
    if (stale) return;
    if (kind === "action") {
      setStatusFilter("");
      setActionOnly((prev) => !prev);
      return;
    }
    setActionOnly(false);
    setStatusFilter((prev) => (prev === value ? "" : value ?? ""));
  }

  const kpiCards = [
    {
      label: "Action required",
      value: displayMetrics?.actionRequired,
      detail: "Bags requiring intervention",
      isPercent: false,
      interactive: !stale,
      active: !stale && actionOnly,
      onToggle: () => toggleKpiFilter("action"),
    },
    {
      label: "At risk",
      value: displayMetrics?.atRisk,
      detail: "Bags flagged at risk",
      isPercent: false,
      interactive: !stale,
      active: !stale && !actionOnly && statusFilter === "At risk",
      onToggle: () => toggleKpiFilter("status", "At risk"),
    },
    {
      label: "On track",
      value: displayMetrics?.onTrack,
      detail: "Bags reported on track",
      isPercent: false,
      interactive: !stale,
      active: !stale && !actionOnly && statusFilter === "On track",
      onToggle: () => toggleKpiFilter("status", "On track"),
    },
    {
      label: "Transfer success %",
      value: displayMetrics?.success,
      detail:
        snapshot?.transferSuccess && !stale
          ? `${snapshot.transferSuccess.successful} / ${snapshot.transferSuccess.eligible} eligible bags · ${stationTime(snapshot.transferSuccess.windowStart)}–${stationTime(snapshot.transferSuccess.windowEnd)} HKT`
          : "Eligible population / window unavailable",
      isPercent: true,
      interactive: false,
      active: false,
      onToggle: undefined,
    },
  ];

  return <div className="staff-app">
    <a href="#staff-main" className="skip-link">Skip to main content</a>
    <OperationsHeader
      station="HKG · T1"
      activeView={view}
      onSelectView={next => {
        setView(next);
        setActionOnly(false);
        setStatusFilter("");
      }}
      onOpenSearch={() => setSearchOpen(true)}
      actionRequiredCount={displayMetrics?.actionRequired ?? null}
      onOpenAlerts={() => {
        setView("transfer-control");
        setActionOnly(true);
        setStatusFilter("");
        requestAnimationFrame(() => {
          document.getElementById("outbound-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }}
    />
    <main id="staff-main" className="staff-main">
      {error && <div className="data-notice" role="alert">{error}<button onClick={() => void fetchSnapshot()}>Retry</button></div>}
      {contextError && <div className="data-notice" role="status">{contextError}<button onClick={() => setContextError(null)}>Dismiss</button></div>}
      {view === "transfer-control" && <div key="transfer-control" className="view-stage">
        <h1 className="sr-only" tabIndex={-1}>Transfer Control</h1>
        <div className="page-heading" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
          <div className="snapshot-meta">
            <button
              type="button"
              className="refresh-btn"
              onClick={() => void fetchSnapshot()}
              disabled={loading}
              aria-label="Refresh operational snapshot"
              title="Refresh operational snapshot"
            >
              <span className={loading ? "refresh-icon-wrap is-spinning" : "refresh-icon-wrap"} aria-hidden="true">
                <RefreshIcon size={14} color="currentColor" />
              </span>
              <span>{loading ? "Refreshing" : "Refresh"}</span>
            </button>
          </div>
        </div>
        <div className="kpi-grid">{kpiCards.map((metric, idx) => (
          <section
            className="card-surface metric-card"
            key={metric.label}
            style={{ "--card-index": idx } as React.CSSProperties}
            data-interactive={metric.interactive ? "true" : undefined}
            data-active={metric.active ? "true" : undefined}
          >
            <div className="metric-card-top">
              <h2>{metric.label}</h2>
              {metric.interactive && metric.onToggle && (
                <button
                  type="button"
                  className="metric-card-toggle"
                  aria-pressed={metric.active}
                  aria-label={`${metric.active ? "Clear filter for" : "Filter queue by"} ${metric.label}`}
                  onClick={metric.onToggle}
                >
                  {metric.active ? "Filtered" : "Filter"}
                </button>
              )}
            </div>
            <strong className="tabular-nums">
              {metric.isPercent ? (
                <AnimatedNumber value={metric.value} decimals={1} suffix="%" />
              ) : (
                <AnimatedNumber value={metric.value} />
              )}
            </strong>
            <p>{metric.detail}</p>
          </section>
        ))}</div>
        <div className="availability-line" role="status">
          <span>
            {stale
              ? loading
                ? "Loading authoritative transfer records."
                : snapshot?.missingInputs.join(" · ") || "Authoritative transfer associations unavailable."
              : `${metrics?.total ?? 0} eligible transfer bags · ${metrics?.unknown ?? 0} with attention unavailable`}
          </span>
          {actionOnly && (
            <button className="text-button" onClick={() => setActionOnly(false)}>
              Clear action-required filter
            </button>
          )}
          {!actionOnly && statusFilter && (
            <button className="text-button" onClick={() => setStatusFilter("")}>
              Clear {statusFilter.toLowerCase()} filter
            </button>
          )}
        </div>
        <OutboundFlightQueue
          flights={flights}
          now={clock}
          onSelect={id => select({ type: "outbound", id })}
          unavailable={stale}
          loading={loading}
          actionOnly={actionOnly}
          statusFilter={statusFilter}
          onStatusFilterChange={(next) => {
            setActionOnly(false);
            setStatusFilter(next);
          }}
          onClearActionOnly={() => setActionOnly(false)}
        />
      </div>}
      {view === "baggage-trace" && <BaggageTraceView bags={bags} selectedTagNumber={selection.bag ?? ""} onSelectBag={locateBag} onSwitchToTransferControl={() => setView("transfer-control")} />}
      {view === "performance" && <PerformanceView bags={bags} selectedTagNumber={selection.bag ?? ""} onSelectBag={locateBag} onSwitchToTransferControl={() => setView("transfer-control")} />}
    </main>
    <GlobalSearchModal open={searchOpen && !selection.outbound} bags={bags} onClose={() => setSearchOpen(false)} onSelectBag={locateBag} />
    {snapshot && <FlightWorkbench snapshot={snapshot} selection={selection} now={clock} stale={stale} onSelection={select} />}
  </div>;
}
