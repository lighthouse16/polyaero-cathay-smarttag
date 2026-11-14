"use client";
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SidebarView, TransferControlSnapshot } from "../lib/types";
import { aggregateInboundFlights, findBagConnection, transferMetrics, validateTransferSnapshot, isTransferSnapshotFresh } from "../lib/transferControl";
import { OperationsHeader } from "../components/layout/OperationsHeader";
import { IncomingFlightQueue, stationTime } from "../components/transfer/IncomingFlightQueue";
import { FlightWorkbench } from "../components/transfer/FlightWorkbench";
import { emptySelection, transferSelection } from "../components/transfer/selection";
import { GlobalSearchModal } from "../components/search/GlobalSearchModal";
import { BaggageTraceView, PerformanceView } from "../components/views/SecondaryViews";

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
  const flights = snapshot ? aggregateInboundFlights(snapshot, clock) : [];
  const displayMetrics = stale ? null : metrics;
  const bags = snapshot?.bags ?? [];
  function locateBag(tag: string) {
    setSearchOpen(false);
    const relation = snapshot ? findBagConnection(snapshot, tag) : null;
    if (!relation) { setContextError(`Incoming / onward flight context unavailable for bag ${tag}. No flight association inferred.`); return; }
    setContextError(null);
    setView("transfer-control");
    select({ type: "inbound", id: relation.inboundLegId });
    select({ type: "outbound", id: relation.outboundLegId });
    select({ type: "bag", id: tag });
  }
  return <div className="staff-app">
    <a href="#staff-main" className="skip-link">Skip to main content</a>
    <OperationsHeader station="HKG · T1" activeView={view} onSelectView={next => { setView(next); setActionOnly(false); }} onOpenSearch={() => setSearchOpen(true)} actionRequiredCount={displayMetrics?.actionRequired ?? null} onOpenAlerts={() => { setView("transfer-control"); setActionOnly(true); }} />
    <main id="staff-main" className="staff-main">
      {error && <div className="data-notice" role="alert">{error}<button onClick={() => void fetchSnapshot()}>Retry</button></div>}
      {contextError && <div className="data-notice" role="status">{contextError}<button onClick={() => setContextError(null)}>Dismiss</button></div>}
      {view === "transfer-control" && <>
        <div className="page-heading"><div><h1 tabIndex={-1}>Transfer Control</h1><p>Prioritize incoming flights, then inspect onward connections and individual bags.</p></div><div className="snapshot-time">{loading ? "Loading snapshot…" : snapshot ? `Received ${stationTime(snapshot.generatedAt)} HKT` : "Snapshot unavailable"}</div></div>
        <div className="kpi-grid">{[
          { label: "Action required", value: displayMetrics?.actionRequired, detail: "Bags requiring intervention" },
          { label: "At risk", value: displayMetrics?.atRisk, detail: "Bags flagged at risk" },
          { label: "On track", value: displayMetrics?.onTrack, detail: "Bags reported on track" },
          { label: "Transfer success %", value: displayMetrics?.success, detail: snapshot?.transferSuccess && !stale ? `${snapshot.transferSuccess.successful} / ${snapshot.transferSuccess.eligible} eligible bags · ${stationTime(snapshot.transferSuccess.windowStart)}–${stationTime(snapshot.transferSuccess.windowEnd)} HKT` : "Eligible population / window unavailable" },
        ].map(metric => <section className="card-surface metric-card" key={metric.label}><h2>{metric.label}</h2><strong className="tabular-nums">{metric.value == null ? "—" : metric.label.endsWith("%") ? `${metric.value.toFixed(1)}%` : metric.value.toLocaleString("en-GB")}</strong><p>{metric.detail}</p></section>)}</div>
        <div className="availability-line" role="status">{stale ? loading ? "Loading authoritative transfer records." : snapshot?.missingInputs.join(" · ") || "Authoritative transfer associations unavailable." : `${metrics?.total ?? 0} eligible transfer bags · ${metrics?.unknown ?? 0} with attention unavailable`}{actionOnly && <button className="text-button" onClick={() => setActionOnly(false)}>Clear action-required filter</button>}</div>
        <IncomingFlightQueue flights={flights} now={clock} onSelect={id => select({ type: "inbound", id })} unavailable={stale} loading={loading} actionOnly={actionOnly} />
      </>}
      {view === "baggage-trace" && <BaggageTraceView bags={bags} selectedTagNumber={selection.bag ?? ""} onSelectBag={locateBag} onSwitchToTransferControl={() => setView("transfer-control")} />}
      {view === "performance" && <PerformanceView bags={bags} selectedTagNumber={selection.bag ?? ""} onSelectBag={locateBag} onSwitchToTransferControl={() => setView("transfer-control")} />}
    </main>
    <GlobalSearchModal open={searchOpen && !selection.inbound} bags={bags} onClose={() => setSearchOpen(false)} onSelectBag={locateBag} />
    {snapshot && <FlightWorkbench snapshot={snapshot} selection={selection} now={clock} stale={stale} onSelection={select} />}
  </div>;
}
