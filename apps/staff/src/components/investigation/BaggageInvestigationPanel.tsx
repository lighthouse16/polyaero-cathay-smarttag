"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { InvestigationTab, LiveBag } from "../../lib/types";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  CloseIcon,
  PlaneIcon,
} from "../icons/DashboardIcons";
import { RiskScoreGauge } from "./RiskScoreGauge";
import { RiskFactorsList } from "./RiskFactorsList";
import { RecommendedActionPanel } from "./RecommendedActionPanel";
import { SmartTagStatusPanel } from "./SmartTagStatusPanel";
import type { PendingStaffAction } from "./ActionConfirmationModal";
import {
  formatStatusLabel,
  formatTimeHHMM,
  isExceptionBag,
  scannerBadgeLabel,
} from "../../lib/utils";

export interface RiskEvaluationFeatures {
  transfer_minutes: number;
  weather_severity: number;
  load_factor_pct: number;
  airport_congestion: number;
}

interface BaggageInvestigationPanelProps {
  bag: LiveBag | null;
  isSyncing: boolean;
  onRequestAction: (action: PendingStaffAction) => void;
  onEvaluateRisk: (
    features: RiskEvaluationFeatures,
    tagNumber: string,
  ) => void | boolean | undefined | Promise<void | boolean | undefined>;
  onClose?: () => void;
}

const TABS: Array<{ id: InvestigationTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "journey", label: "Journey" },
  { id: "smarttag", label: "SmartTag" },
  { id: "history", label: "History" },
];

export function BaggageInvestigationPanel({
  bag,
  isSyncing,
  onRequestAction,
  onEvaluateRisk,
  onClose,
}: BaggageInvestigationPanelProps) {
  const [activeTab, setActiveTab] = useState<InvestigationTab>("overview");
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const riskTargetRef = useRef("");
  useEffect(() => {
    setRiskModalOpen(false);
  }, [bag?.tag_number]);

  // Operator-entered simulation inputs for risk evaluation
  const [simTransferMins, setSimTransferMins] = useState<number>(45);
  const [simWeather, setSimWeather] = useState<number>(3);
  const [simLoadFactor, setSimLoadFactor] = useState<number>(88);
  const [simCongestion, setSimCongestion] = useState<number>(3);

  const riskDialogRef = useRef<HTMLDialogElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});


  // Sync native dialog open/close
  useEffect(() => {
    const dialog = riskDialogRef.current;
    if (!dialog) return;
    if (riskModalOpen && !dialog.open) {
      dialog.showModal();
    } else if (!riskModalOpen && dialog.open) {
      dialog.close();
    }
  }, [riskModalOpen]);

  // Actual recorded events sorted chronologically (oldest first for journey timeline)
  const journeyEvents = useMemo(() => {
    if (!bag?.events) return [];
    return [...bag.events].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [bag?.events]);

  // Newest first for audit log tab
  const auditEvents = useMemo(() => {
    if (!bag?.events) return [];
    return [...bag.events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [bag?.events]);

  if (!bag) {
    return (
      <aside
        className="card-surface"
        style={{ padding: "36px 24px", textAlign: "center", color: "#000000" }}
      >
        Select a baggage tag from the queue to inspect transfer status and
        recovery controls.
      </aside>
    );
  }

  const isExc = isExceptionBag(bag);
  const statusBadge = isExc
    ? {
        bg: "#F3F1EC",
        border: "#D8D3CB",
        color: "#000000",
        icon: <AlertTriangleIcon size={12} color="#762830" />,
      }
    : {
        bg: "#EFEEE9",
        border: "#C8D1CB",
        color: "#000000",
        icon: <CheckIcon size={12} color="#004B4A" />,
      };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let targetIndex: number | null = null;
    if (e.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = TABS.length - 1;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      const nextTab = TABS[targetIndex].id;
      setActiveTab(nextTab);
      tabButtonRefs.current[nextTab]?.focus();
    }
  };

  const handleRiskFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSyncing || !bag || riskTargetRef.current !== bag.tag_number) return;
    const result = await onEvaluateRisk(
      {
        transfer_minutes: Number(simTransferMins),
        weather_severity: Number(simWeather) || 1,
        load_factor_pct: Number(simLoadFactor),
        airport_congestion: Number(simCongestion) || 1,
      },
      riskTargetRef.current,
    );
    if (result !== false) {
      setRiskModalOpen(false);
    }
  };

  return (
    <aside aria-label="Baggage Case Investigation" style={{ minWidth: 0 }}>
      <div className="card-surface" style={{ padding: "20px 22px" }}>
        {/* Case Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "12.5px",
                color: "#000000",
                fontWeight: 500,
              }}
            >
              Baggage case
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "4px",
                flexWrap: "wrap",
              }}
            >
              <span
                className="tabular-nums"
                style={{
                  fontSize: "clamp(24px, 2.1vw, 34px)",
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: "#000000",
                  letterSpacing: "-0.03em",
                }}
              >
                {bag.tag_number}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  backgroundColor: statusBadge.bg,
                  border: `1px solid ${statusBadge.border}`,
                  color: "#000000",
                  fontSize: "11.5px",
                  fontWeight: 600,
                }}
              >
                {statusBadge.icon}
                <span>{formatStatusLabel(bag.status)}</span>
              </span>
            </div>

            <div
              style={{
                fontSize: "12.5px",
                color: "#000000",
                marginTop: "6px",
                fontWeight: 500,
              }}
            >
              <span style={{ fontWeight: 500, color: "#000000" }}>
                {bag.passenger_name.replace("/", " / ")}
              </span>
              <span style={{ margin: "0 6px", color: "#000000" }}>·</span>
              <span className="tabular-nums">PNR {bag.booking_reference}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
                fontSize: "13px",
                color: "#000000",
                fontWeight: 600,
              }}
            >
              <PlaneIcon size={14} color="#4C5755" />
              <span>{bag.flight_number}</span>
              <span
                style={{
                  width: "1px",
                  height: "12px",
                  backgroundColor: "#D6D1C6",
                }}
              />
              <span>
                {bag.departure_airport} → {bag.arrival_airport}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div
                style={{ fontSize: "11.5px", color: "#000000", fontWeight: 500 }}
              >
                Connection buffer
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#000000",
                  marginTop: "2px",
                }}
              >
                {bag.connection_minutes != null
                  ? `${bag.connection_minutes} min`
                  : "Unavailable"}
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close baggage case"
                title="Close baggage case"
                className="focus-ring"
                style={{
                  background: "#FAF9F5",
                  border: "1px solid #E5E2DA",
                  color: "#000000",
                  cursor: "pointer",
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  marginTop: "-2px",
                  transition: "background-color 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#EAE7DF";
                  e.currentTarget.style.color = "#000000";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#FAF9F5";
                  e.currentTarget.style.color = "#000000";
                }}
              >
                <CloseIcon size={14} color="#000000" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Case detail sections"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: "1px solid #EAE7DF",
            marginTop: "16px",
            marginBottom: "16px",
          }}
        >
          {TABS.map((tab, idx) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                id={`case-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`case-panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className="focus-ring"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: active
                    ? "2.5px solid #004B4A"
                    : "2.5px solid transparent",
                  padding: "8px 2px",
                  fontSize: "clamp(11px, 2.8vw, 12.5px)",
                  fontWeight: active ? 700 : 500,
                  color: "#000000",
                  cursor: "pointer",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview */}
        <div
          role="tabpanel"
          id="case-panel-overview"
          aria-labelledby="case-tab-overview"
          hidden={activeTab !== "overview"}
        >
          {activeTab === "overview" && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "18px",
                  flexWrap: "wrap",
                }}
              >
                <RiskScoreGauge score={bag.risk_score} />
                <RiskFactorsList bag={bag} />
              </div>

              {/* Restrained Risk / Recovery Callout */}
              <div
                style={{
                  marginTop: "14px",
                  padding: "11px 13px",
                  borderRadius: "10px",
                  backgroundColor: "#faf9f6",
                  border: `1px solid ${isExc || bag.risk_score >= 65 ? "#D8D3CB" : "#C8D1CB"}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <span style={{ marginTop: "1px", flexShrink: 0 }}>
                  {isExc || bag.risk_score >= 65 ? (
                    <AlertCircleIcon size={17} color="#87323A" />
                  ) : (
                    <CheckIcon size={16} color="#004B4A" />
                  )}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#000000",
                    }}
                  >
                    {isExc || bag.risk_score >= 70
                      ? "High risk of missed connection"
                      : bag.risk_score >= 45
                        ? "Monitored connection transfer"
                        : "Transfer on schedule"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#000000",
                      marginTop: "2px",
                      lineHeight: 1.4,
                    }}
                  >
                    {bag.passenger_risk_summary ||
                      (bag.connection_minutes != null
                        ? `Bag tracked at ${bag.last_known_location} with ${bag.connection_minutes} min buffer.`
                        : bag.recommended_action)}
                  </div>
                </div>
              </div>

              {bag.passenger_recovery_choice && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#FAF9F5",
                    border: "1px solid #E5E2DA",
                    fontSize: "12px",
                    color: "#000000",
                  }}
                >
                  <strong>Passenger recovery preference: </strong>
                  {bag.passenger_recovery_choice.replace(/_/g, " ")}
                  {bag.recovery_eta ? ` · ETA ${bag.recovery_eta}` : ""}
                </div>
              )}

              <RecommendedActionPanel
                bag={bag}
                isSyncing={isSyncing}
                onRequestAction={onRequestAction}
                onEvaluateRisk={() => {
                  riskTargetRef.current = bag.tag_number;
                  setSimTransferMins(bag.connection_minutes ?? 45);
                  setRiskModalOpen(true);
                }}
              />
            </div>
          )}
        </div>

        {/* Tab 2: Journey — Pure Recorded Events, No Synthetic Milestones */}
        <div
          role="tabpanel"
          id="case-panel-journey"
          aria-labelledby="case-tab-journey"
          hidden={activeTab !== "journey"}
        >
          {activeTab === "journey" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  backgroundColor: "#FAF9F5",
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border: "1px solid #EAE7DF",
                  fontSize: "12px",
                }}
              >
                <div>
                  <div style={{ color: "#000000", fontSize: "11px" }}>
                    Tier &amp; Cabin
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#000000",
                      marginTop: "1px",
                    }}
                  >
                    {bag.tier_status} · {bag.cabin_class}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#000000", fontSize: "11px" }}>
                    Weight &amp; Carousel
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontWeight: 600,
                      color: "#000000",
                      marginTop: "1px",
                    }}
                  >
                    {bag.weight_kg} kg · {bag.carousel_assigned || "Unassigned"}
                  </div>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#000000",
                    marginBottom: "8px",
                  }}
                >
                  Recorded custody events ({journeyEvents.length})
                </div>

                {journeyEvents.length === 0 ? (
                  <div
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      fontSize: "12.5px",
                      color: "#000000",
                    }}
                  >
                    No journey scan events recorded in station custody log.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {journeyEvents.map((evt, idx) => (
                      <div
                        key={evt.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          backgroundColor: "#FAF9F5",
                          border: "1px solid #EAE7DF",
                        }}
                      >
                        <span
                          className="tabular-nums"
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            backgroundColor: "#004B4A",
                            color: "#FFFFFF",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: "1px",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 700,
                                color: "#000000",
                              }}
                            >
                              {formatStatusLabel(evt.event_type)}
                            </span>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 600,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                backgroundColor: "#EFEEE9",
                                color: "#000000",
                              }}
                            >
                              {scannerBadgeLabel(evt.scanner_type)}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "11.5px",
                              color: "#000000",
                              marginTop: "2px",
                            }}
                          >
                            {evt.station_name} ·{" "}
                            <span className="tabular-nums">
                              {evt.location_code}
                            </span>
                          </div>
                          {evt.notes && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#000000",
                                marginTop: "2px",
                                lineHeight: 1.35,
                              }}
                            >
                              {evt.notes}
                            </div>
                          )}
                          <div
                            className="tabular-nums"
                            style={{
                              fontSize: "10.5px",
                              color: "#000000",
                              marginTop: "3px",
                            }}
                          >
                            Recorded: {formatTimeHHMM(evt.timestamp)}
                            {evt.handled_by_staff_id
                              ? ` · Operator ${evt.handled_by_staff_id}`
                              : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab 3: SmartTag Telemetry & Hardware Context */}
        <div
          role="tabpanel"
          id="case-panel-smarttag"
          aria-labelledby="case-tab-smarttag"
          hidden={activeTab !== "smarttag"}
        >
          {activeTab === "smarttag" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "12.5px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#FAF9F5",
                  borderRadius: "9px",
                  padding: "12px",
                  border: "1px solid #E8E5DE",
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  rowGap: "6px",
                }}
              >
                <span style={{ color: "#000000" }}>NFC Tag UID</span>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontWeight: 600,
                    color: "#000000",
                  }}
                >
                  {bag.tag_code}
                </span>
                <span style={{ color: "#000000" }}>Tag Interface</span>
                <span style={{ fontWeight: 600, color: "#000000" }}>
                  {bag.tag_interface || "Standard SmartTag"}
                </span>
                <span style={{ color: "#000000" }}>E-Ink Banner</span>
                <span style={{ fontWeight: 700, color: "#000000" }}>
                  {bag.eink_banner || "—"}
                </span>
                <span style={{ color: "#000000" }}>Last Location</span>
                <span style={{ fontWeight: 500, color: "#000000" }}>
                  {bag.last_known_location}
                </span>
                <span style={{ color: "#000000" }}>Hardware Telemetry</span>
                <span style={{ fontWeight: 500, color: "#000000" }}>
                  Hardware confirmation unavailable
                </span>
              </div>
              <div
                style={{
                  fontSize: "11.5px",
                  color: "#000000",
                  lineHeight: 1.45,
                }}
              >
                Tag records are stored in station database. Physical PN532 NFC
                scans record scanner type{" "}
                <code style={{ color: "#000000" }}>NFC_TAP</code>; staff portal
                actions record{" "}
                <code style={{ color: "#000000" }}>MANUAL_OVERRIDE</code>.
              </div>
            </div>
          )}
        </div>

        {/* Tab 4: Audit Log */}
        <div
          role="tabpanel"
          id="case-panel-history"
          aria-labelledby="case-tab-history"
          hidden={activeTab !== "history"}
        >
          {activeTab === "history" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "9px",
                maxHeight: "280px",
                overflowY: "auto",
              }}
            >
              {auditEvents.length === 0 ? (
                <div style={{ fontSize: "12.5px", color: "#000000" }}>
                  No audit events recorded.
                </div>
              ) : (
                auditEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: "9px 11px",
                      borderRadius: "8px",
                      border: "1px solid #ECEAE3",
                      backgroundColor: "#FAF9F5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#000000",
                        }}
                      >
                        {formatStatusLabel(evt.event_type)}
                      </span>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          backgroundColor: "#EFEEE9",
                          color: "#000000",
                        }}
                      >
                        {scannerBadgeLabel(evt.scanner_type)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: "#000000",
                        marginTop: "3px",
                      }}
                    >
                      {evt.notes || evt.station_name}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: "10.5px",
                        color: "#000000",
                        marginTop: "3px",
                      }}
                    >
                      {formatTimeHHMM(evt.timestamp)} · {evt.location_code}
                      {evt.handled_by_staff_id
                        ? ` · Operator ${evt.handled_by_staff_id}`
                        : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Enclosed SmartTag E-paper Preview Section */}
        <SmartTagStatusPanel bag={bag} />
      </div>

      {/* Native <dialog> Modal for AI Risk Evaluation Form */}
      <dialog
        ref={riskDialogRef}
        aria-labelledby="risk-eval-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!isSyncing) setRiskModalOpen(false);
        }}
        onClick={(e) => {
          if (e.target === riskDialogRef.current && !isSyncing) {
            setRiskModalOpen(false);
          }
        }}
      >
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E2E1DB",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              padding: "22px",
            }}
          >
            <h3
              id="risk-eval-dialog-title"
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "#000000",
              }}
            >
              Evaluate AI Transfer Risk
            </h3>
            <p
              style={{
                margin: "6px 0 14px",
                fontSize: "12.5px",
                color: "#000000",
                lineHeight: 1.45,
              }}
            >
              Enter simulation parameters to test model prediction for bag{" "}
              {bag.tag_number}. Fields are operator-entered.
            </p>

            <form onSubmit={handleRiskFormSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <label style={{ display: "block" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#000000",
                      marginBottom: "4px",
                    }}
                  >
                    Connection buffer (mins)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    required
                    value={simTransferMins}
                    onChange={(e) => setSimTransferMins(Number(e.target.value))}
                    className="focus-ring"
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 10px",
                      borderRadius: "8px",
                      border: "1px solid #D1D5DB",
                      fontSize: "13px",
                    }}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#000000",
                      marginBottom: "4px",
                    }}
                  >
                    Route weather severity (1–5)
                  </span>
                  <select
                    value={simWeather}
                    onChange={(e) => setSimWeather(Number(e.target.value))}
                    className="focus-ring"
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 8px",
                      borderRadius: "8px",
                      border: "1px solid #D1D5DB",
                      fontSize: "13px",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <option value="1">1 - Clear / Calm</option>
                    <option value="2">2 - Minor crosswinds</option>
                    <option value="3">3 - Moderate weather</option>
                    <option value="4">4 - Thunderstorm alert</option>
                    <option value="5">5 - Severe typhoon / freeze</option>
                  </select>
                </label>

                <label style={{ display: "block" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#000000",
                      marginBottom: "4px",
                    }}
                  >
                    Load factor (% cargo/pax)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={simLoadFactor}
                    onChange={(e) => setSimLoadFactor(Number(e.target.value))}
                    className="focus-ring"
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 10px",
                      borderRadius: "8px",
                      border: "1px solid #D1D5DB",
                      fontSize: "13px",
                      color: "#000000",
                    }}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#000000",
                      marginBottom: "4px",
                    }}
                  >
                    Terminal congestion (1–5)
                  </span>
                  <select
                    value={simCongestion}
                    onChange={(e) => setSimCongestion(Number(e.target.value))}
                    className="focus-ring"
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 8px",
                      borderRadius: "8px",
                      border: "1px solid #D1D5DB",
                      fontSize: "13px",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <option value="1">1 - Low volume</option>
                    <option value="2">2 - Normal operations</option>
                    <option value="3">3 - Peak hour volume</option>
                    <option value="4">4 - High BHS backlog</option>
                    <option value="5">5 - Severe congestion</option>
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!isSyncing) setRiskModalOpen(false);
                  }}
                  className="focus-ring touch-target"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #D6D1C6",
                    backgroundColor: "#FFFFFF",
                    color: "#000000",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="focus-ring touch-target"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#004B4A",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isSyncing ? "wait" : "pointer",
                  }}
                >
                  {isSyncing ? "Evaluating..." : "Apply Simulation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </aside>
  );
}
