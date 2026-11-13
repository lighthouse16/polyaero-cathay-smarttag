"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LiveBag, SidebarView } from "../lib/types";
import { formatStatusLabel } from "../lib/utils";
import { validateBags, snapshotMetrics } from "../lib/dashboard";
import { OperationsHeader } from "../components/layout/OperationsHeader";
import { OperationsSidebar } from "../components/layout/OperationsSidebar";
import { OperationalMetricCard } from "../components/transfer/OperationalMetricCard";
import { FlightTransferTimeline } from "../components/transfer/FlightTransferTimeline";
import { BaggageRiskTable } from "../components/transfer/BaggageRiskTable";
import { BaggageInvestigationPanel } from "../components/investigation/BaggageInvestigationPanel";
import {
  ActionConfirmationModal,
  type PendingStaffAction,
} from "../components/investigation/ActionConfirmationModal";
import { GlobalSearchModal } from "../components/search/GlobalSearchModal";
import {
  ExceptionsView,
  BaggageTraceView,
  PerformanceView,
} from "../components/views/SecondaryViews";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  LuggageIcon,
} from "../components/icons/DashboardIcons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const STAFF_ID = "STF-8821";

export default function StaffDashboardPage() {
  const [bags, setBags] = useState<LiveBag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTagNum, setSelectedTagNum] = useState<string>("0160892014");
  const [caseOpen, setCaseOpen] = useState(true);
  const [activeView, setActiveView] = useState<SidebarView>("transfer-control");
  const [timeRange, setTimeRange] = useState<"4h" | "today" | "7d">("4h");
  const requestBusy = useRef(false);
  const mutationBusy = useRef(false);
  const readVersion = useRef(0);
  const station = "HKG · T1";
  const [selectedFlightFilter, setSelectedFlightFilter] = useState<
    string | null
  >(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingTag, setPendingTag] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingStaffAction | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const fetchBags = useCallback(async (signal?: AbortSignal) => {
    if (requestBusy.current || mutationBusy.current) return;
    requestBusy.current = true;
    const version = readVersion.current;
    try {
      const res = await fetch(`${API_BASE}/baggage`, {
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("API unavailable");
      const data = validateBags(await res.json());
      if (signal?.aborted || version !== readVersion.current) return;
      setBags(data);
      setIsLiveConnected(true);
    } catch {
      if (!signal?.aborted && version === readVersion.current)
        setIsLiveConnected(false);
    } finally {
      requestBusy.current = false;
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchBags(controller.signal);
    const interval = setInterval(() => {
      if (!document.hidden) void fetchBags(controller.signal);
    }, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchBags]);

  // Global shortcuts: Ctrl+K (search), Ctrl+B (toggle sidebar)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]") && !searchOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedBag = useMemo(
    () => bags.find((b) => b.tag_number === selectedTagNum) ?? null,
    [bags, selectedTagNum],
  );
  const kpi = useMemo(() => snapshotMetrics(bags), [bags]);

  const executeScanUpdate = async (
    bag: LiveBag,
    newStatus: string,
    customNotes?: string,
  ) => {
    if (mutationBusy.current) return false;
    mutationBusy.current = true;
    readVersion.current++;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/${bag.tag_number}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          event_type: newStatus,
          location_code: station.replace(/[^A-Z0-9]/gi, "-").toUpperCase(),
          station_name: `${station} · Ground Operations`,
          scanner_type: "MANUAL_OVERRIDE",
          staff_id: STAFF_ID,
          notes:
            customNotes?.trim() ||
            `Staff portal update to ${formatStatusLabel(newStatus)}`,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      const [updated] = validateBags([await res.json()]);
      setBags((prev) =>
        prev.map((b) => (b.tag_number === updated.tag_number ? updated : b)),
      );
      setToast({
        message: `${updated.tag_number} (${updated.passenger_name}) updated to ${formatStatusLabel(newStatus)}`,
        tone: "success",
      });
      return true;
    } catch {
      setToast({
        message: "Unable to record baggage scan update. Check connection.",
        tone: "error",
      });
      return false;
    } finally {
      mutationBusy.current = false;
      setIsSyncing(false);
    }
  };

  const handleConfirmPendingAction = async (notes: string) => {
    const target = bags.find((b) => b.tag_number === pendingTag);
    if (!target || !pendingAction) return;
    if (await executeScanUpdate(target, pendingAction.targetStatus, notes))
      setPendingAction(null);
  };

  const handleEvaluateRisk = async (
    features: {
      transfer_minutes: number;
      weather_severity: number;
      load_factor_pct: number;
      airport_congestion: number;
    },
    tagNumber: string,
  ) => {
    const targetBag = bags.find((b) => b.tag_number === tagNumber);
    if (!targetBag) return false;
    if (mutationBusy.current) return false;
    mutationBusy.current = true;
    readVersion.current++;
    setIsSyncing(true);
    try {
      const res = await fetch(
        `${API_BASE}/baggage/${targetBag.tag_number}/risk/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            flight_number: targetBag.flight_number,
            origin: targetBag.departure_airport,
            destination: targetBag.arrival_airport,
            ...features,
          }),
        },
      );
      if (!res.ok) throw new Error("Risk evaluation failed");
      const assessment = await res.json();
      if (
        !assessment ||
        !Number.isFinite(assessment.risk_score) ||
        assessment.risk_score < 0 ||
        assessment.risk_score > 100 ||
        [
          "risk_level",
          "passenger_summary",
          "predicted_arrival_time",
          "carousel_estimate",
          "model_version",
          "recommended_action",
        ].some((k) => typeof assessment[k] !== "string") ||
        !Array.isArray(assessment.factors) ||
        assessment.factors.some((v: unknown) => typeof v !== "string")
      )
        throw new Error("Invalid risk assessment");
      readVersion.current++;
      setBags((previous) =>
        previous.map((b) =>
          b.tag_number === targetBag.tag_number
            ? {
                ...b,
                risk_score: assessment.risk_score,
                risk_level: assessment.risk_level,
                risk_factors: assessment.factors,
                passenger_risk_summary: assessment.passenger_summary,
                predicted_arrival_time: assessment.predicted_arrival_time,
                carousel_assigned: assessment.carousel_estimate,
                model_version: assessment.model_version,
                recommended_action: assessment.recommended_action,
                connection_minutes: features.transfer_minutes,
                is_rush_bag: assessment.risk_level === "HIGH_PRIORITY",
              }
            : b,
        ),
      );
      setToast({
        message: `Risk assessment (${assessment.risk_score}/100) evaluated for ${targetBag.tag_number}`,
        tone: "success",
      });
      return true;
    } catch {
      setToast({
        message: "Failed to apply risk assessment.",
        tone: "error",
      });
      return false;
    } finally {
      mutationBusy.current = false;
      setIsSyncing(false);
    }
  };

  const handleResetDemo = async () => {
    if (mutationBusy.current) return false;
    mutationBusy.current = true;
    readVersion.current++;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      const fresh = validateBags(await res.json());
      setBags(fresh);
      if (fresh.some((b) => b.tag_number === "0160892014")) {
        setSelectedTagNum("0160892014");
      } else if (fresh[0]) {
        setSelectedTagNum(fresh[0].tag_number);
      }
      setCaseOpen(true);
      setToast({ message: "Demo baggage dataset restored.", tone: "success" });
    } catch {
      setToast({ message: "Could not reset demo dataset.", tone: "error" });
    } finally {
      mutationBusy.current = false;
      setIsSyncing(false);
    }
  };

  const handleSelectBag = useCallback((tagNum: string) => {
    setSelectedTagNum(tagNum);
    setCaseOpen(true);
  }, []);

  const handleCloseCase = useCallback(() => {
    setCaseOpen(false);
    setSelectedTagNum("");
  }, []);

  const handleQuickAction = (bag: LiveBag, targetStatus: string) => {
    handleSelectBag(bag.tag_number);
    setPendingTag(bag.tag_number);
    setPendingAction({
      targetStatus,
      title:
        targetStatus === "RECOVERY_IN_PROGRESS"
          ? "Record recovery in progress"
          : "Record loaded status",
      description:
        targetStatus === "RECOVERY_IN_PROGRESS"
          ? `Record a manual RECOVERY_IN_PROGRESS status for ${bag.tag_number}. This does not dispatch a runner or confirm hardware refresh.`
          : `Record a manual LOADED status for ${bag.tag_number}. Confirm actual loading before proceeding.`,
      ctaLabel: "Confirm record update",
      tone: "jade",
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F6F5F1",
      }}
    >
      <OperationsHeader
        station={station}
        exceptionCount={kpi.exceptions}
        isLiveConnected={isLiveConnected}
        onOpenSearch={() => setSearchOpen(true)}
        onResetDemo={handleResetDemo}
        onOpenExceptions={() => setActiveView("exceptions")}
        isSyncing={isSyncing}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <OperationsSidebar
          activeView={activeView}
          onSelectView={setActiveView}
          exceptionCount={kpi.exceptions}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "20px 24px 36px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {toast && (
            <div
              role="status"
              style={{
                marginBottom: "16px",
                padding: "10px 16px",
                borderRadius: "10px",
                backgroundColor:
                  toast.tone === "success" ? "#EFEEE9" : "#F3F1EC",
                border: `1px solid ${toast.tone === "success" ? "#006564" : "#D8D3CB"}`,
                color: "#000000",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#000000",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          )}

          <div
            className={`ops-grid ${caseOpen && selectedBag ? "" : "case-closed"}`}
            aria-busy={isLoading}
          >
            {/* Left Primary Monitoring Column */}
            <div
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {activeView === "transfer-control" && (
                <>
                  {/* Editorial Page Title + Time Range Control */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "14px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h1
                        style={{
                          margin: 0,
                          fontSize: "clamp(24px, 2.5vw, 34px)",
                          fontWeight: 700,
                          lineHeight: 1.15,
                          color: "#000000",
                          letterSpacing: "-0.025em",
                        }}
                      >
                        Transfer Control
                      </h1>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "13px",
                          color: "#000000",
                        }}
                      >
                        Monitor connection risks and recover transfer exceptions
                        in real time.
                      </p>
                    </div>

                    <div
                      className="time-ranges"
                      role="group"
                      aria-label="Time range"
                    >
                      {(
                        [
                          { id: "4h", label: "Last 4h" },
                          { id: "today", label: "Today" },
                          { id: "7d", label: "7d" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={timeRange === opt.id}
                          onClick={() => setTimeRange(opt.id)}
                          className={
                            timeRange === opt.id ? "active-range" : undefined
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 Operational KPI Cards */}
                  <div className="kpi-grid">
                    <OperationalMetricCard
                      title="Bags in transfer"
                      value={
                        isLoading
                          ? "—"
                          : timeRange === "4h"
                            ? "2,841"
                            : timeRange === "today"
                              ? "6,420"
                              : "41,890"
                      }
                      sublabel={
                        timeRange === "4h"
                          ? "▲ +3.0% vs. prev. 4h"
                          : timeRange === "today"
                            ? "▲ +4.2% vs. yesterday"
                            : "▲ +6.1% vs. prev. 7d"
                      }
                      icon={<LuggageIcon size={16} color="#006564" />}
                      iconBg="#F0EFEB"
                      accentColor="#006564"
                      sparklinePoints={[18, 25, 22, 30, 28, 34, 38, 43]}
                      animationDelay={0}
                    />
                    <OperationalMetricCard
                      title="At risk"
                      value={isLoading ? "—" : kpi.atRisk}
                      sublabel="▲ +2"
                      icon={<AlertTriangleIcon size={16} color="#856432" />}
                      iconBg="#EFEDE8"
                      tintBackground="#FFFFFF"
                      borderColor="#DDD8CF"
                      accentColor="#856432"
                      sparklinePoints={[2, 4, 3, 5, 4, 6, 7, 7]}
                      animationDelay={100}
                    />
                    <OperationalMetricCard
                      title="Exceptions"
                      value={isLoading ? "—" : kpi.exceptions}
                      sublabel={kpi.exceptions > 0 ? "Needs recovery" : "All clear"}
                      icon={<AlertCircleIcon size={16} color="#87323A" />}
                      iconBg="#F0EEE9"
                      tintBackground="#F3F1EC"
                      borderColor={kpi.exceptions > 0 ? "#D8D3CB" : "#E8E5DE"}
                      accentColor="#87323A"
                      sparklinePoints={[0, 1, 0, 1, 2, 1, 2, 1]}
                      animationDelay={200}
                      onClick={() => setActiveView("exceptions")}
                    />
                    <OperationalMetricCard
                      title="Transfer success"
                      value={
                        timeRange === "4h"
                          ? "99.6%"
                          : timeRange === "today"
                            ? "99.4%"
                            : "99.2%"
                      }
                      sublabel="▲ +0.3 pp"
                      icon={<CheckCircleIcon size={16} color="#2D614E" />}
                      iconBg="#EFEEE9"
                      tintBackground="#FFFFFF"
                      borderColor="#E1DED6"
                      accentColor="#0D6E4E"
                      sparklinePoints={[98.8, 99.1, 99.0, 99.3, 99.4, 99.4, 99.5, 99.6]}
                      animationDelay={300}
                    />
                  </div>

                  <FlightTransferTimeline
                    bags={bags}
                    selectedFlight={selectedFlightFilter}
                    onSelectFlight={(f) =>
                      setSelectedFlightFilter((prev) => (prev === f ? null : f))
                    }
                  />

                  <BaggageRiskTable
                    bags={bags}
                    selectedTagNumber={caseOpen && selectedBag ? selectedBag.tag_number : ""}
                    onSelectBag={handleSelectBag}
                    externalFlightFilter={selectedFlightFilter}
                    onClearExternalFlight={() => setSelectedFlightFilter(null)}
                    onQuickAction={handleQuickAction}
                    isLoading={isLoading}
                  />
                </>
              )}

              {activeView === "exceptions" && (
                <ExceptionsView
                  bags={bags}
                  selectedTagNumber={caseOpen && selectedBag ? selectedBag.tag_number : ""}
                  onSelectBag={handleSelectBag}
                  onSwitchToTransferControl={() =>
                    setActiveView("transfer-control")
                  }
                />
              )}

              {activeView === "baggage-trace" && (
                <BaggageTraceView
                  bags={bags}
                  selectedTagNumber={caseOpen && selectedBag ? selectedBag.tag_number : ""}
                  onSelectBag={handleSelectBag}
                  onSwitchToTransferControl={() =>
                    setActiveView("transfer-control")
                  }
                />
              )}

              {activeView === "performance" && (
                <PerformanceView
                  bags={bags}
                  selectedTagNumber={caseOpen && selectedBag ? selectedBag.tag_number : ""}
                  onSelectBag={handleSelectBag}
                  onSwitchToTransferControl={() =>
                    setActiveView("transfer-control")
                  }
                />
              )}
            </div>

            {/* Right Investigation Drawer */}
            {caseOpen && selectedBag && (
              <div>
                <BaggageInvestigationPanel
                  bag={selectedBag}
                  isSyncing={isSyncing || !isLiveConnected}
                  onRequestAction={(action) => {
                    if (selectedBag) {
                      setPendingTag(selectedBag.tag_number);
                      setPendingAction(action);
                    }
                  }}
                  onEvaluateRisk={handleEvaluateRisk}
                  onClose={handleCloseCase}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      <GlobalSearchModal
        open={searchOpen}
        bags={bags}
        onClose={() => setSearchOpen(false)}
        onSelectBag={(tagNum) => {
          handleSelectBag(tagNum);
          setSelectedFlightFilter(null);
          setActiveView("baggage-trace");
        }}
      />

      {bags.find((b) => b.tag_number === pendingTag) && (
        <ActionConfirmationModal
          bag={bags.find((b) => b.tag_number === pendingTag)!}
          pendingAction={pendingAction}
          isSubmitting={isSyncing}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirmPendingAction}
        />
      )}

      <style jsx>{`
        .ops-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) clamp(380px, 26vw, 440px);
          gap: 20px;
          align-items: start;
          width: 100%;
        }
        .ops-grid.case-closed {
          grid-template-columns: 1fr;
        }
        .time-ranges {
          display: inline-flex;
          border: 1px solid #e4e5e1;
          border-radius: 9px;
          background: #ffffff;
          padding: 3px;
          gap: 2px;
        }
        .time-ranges button {
          padding: 6px 14px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #000000;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .time-ranges button.active-range {
          background: #0b4d3e;
          color: #ffffff;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
          gap: 12px;
          width: 100%;
        }
        @media (max-width: 1180px) {
          .ops-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
        @media (max-width: 480px) {
          .kpi-grid {
            gap: 8px;
          }
          .time-ranges button {
            padding: 5px 10px;
            font-size: 11.5px;
          }
        }
      `}</style>
    </div>
  );
}
