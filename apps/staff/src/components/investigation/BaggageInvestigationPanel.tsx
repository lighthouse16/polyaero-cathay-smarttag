"use client";

import React, { useId, useRef, useState } from "react";
import type { BaggageEventItem, InvestigationTab, LiveBag } from "../../lib/types";
import { scannerBadgeLabel } from "../../lib/utils";
import { CheckIcon, CloseIcon, CopyIcon } from "../icons/DashboardIcons";
import { copyToClipboard } from "../ui/clipboard";
import { useSlidingIndicator } from "../ui/useSlidingIndicator";
import { SmartTagStatusPanel } from "./SmartTagStatusPanel";
import styles from "./BaggageInvestigationPanel.module.css";

interface BaggageInvestigationPanelProps {
  bag: LiveBag | null;
  bagRisk: number | null;
  timeToAct: number | null;
  connectionLabel: string;
  onClose?: () => void;
  onSnapshotMutated?: () => Promise<void> | void;
}

const TABS: Array<{ id: InvestigationTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "journey", label: "Journey" },
  { id: "smarttag", label: "SmartTag" },
  { id: "history", label: "History" },
];

const stationTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Hong_Kong",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

function reportedTime(timestamp: string) {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? stationTime.format(new Date(time)) : "Unavailable";
}

function reportedLabel(value: string) {
  return (
    value?.trim().replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) ||
    "Unavailable"
  );
}

function formatEventLocation(stationName?: string | null, locationCode?: string | null) {
  const station = stationName?.trim();
  const code = locationCode?.trim();
  if (!station && !code) return "Location unavailable";
  // Badge in eventHead already displays location_code when present, so omit redundant identical station labels.
  if (station && code && station.toUpperCase() === code.toUpperCase()) return null;
  if (station && code) return station;
  return station || null;
}

function formatScannerMethod(scannerType?: string | null) {
  const raw = scannerType?.trim();
  if (!raw) return "Unavailable";
  const mapped = scannerBadgeLabel(raw);
  return mapped === raw && raw.includes("_") ? reportedLabel(raw) : mapped;
}

function orderedEvents(events: BaggageEventItem[], newestFirst: boolean) {
  return [...events].sort((a, b) => {
    const first = Date.parse(a.timestamp);
    const second = Date.parse(b.timestamp);
    if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
    if (!Number.isFinite(second)) return -1;
    return newestFirst ? second - first : first - second;
  });
}

function ReportedEvents({
  events,
  history = false,
}: {
  events: BaggageEventItem[];
  history?: boolean;
}) {
  return (
    <section className={styles.events}>
      <h4>
        {history ? "Reported event history" : "Recorded custody events"} ({events.length})
      </h4>
      <p className={styles.supporting}>
        Source-reported records · Asia/Hong_Kong. Scanner methods do not confirm hardware
        verification.
      </p>
      {events.length === 0 ? (
        <p className={styles.unavailable}>
          {history ? "Event history unavailable" : "Custody events unavailable"}
        </p>
      ) : (
        <ol className={styles.eventList}>
          {orderedEvents(events, history).map((event, idx) => {
            const locationLine = formatEventLocation(event.station_name, event.location_code);
            return (
              <li key={event.id} className={styles.event} data-latest={idx === 0 ? "true" : undefined}>
                <div className={styles.eventHead}>
                  <strong>{reportedLabel(event.event_type)}</strong>
                  {event.location_code && <span className={styles.eventBadge}>{event.location_code}</span>}
                </div>
                {locationLine && <span>{locationLine}</span>}
                <span className={styles.supporting}>
                  Reported method: {formatScannerMethod(event.scanner_type)}
                </span>
                <time dateTime={Number.isFinite(Date.parse(event.timestamp)) ? event.timestamp : undefined}>
                  {reportedTime(event.timestamp)}
                </time>
                {event.provenance && (
                  <details className={styles.provenanceDetails}>
                    <summary>Provenance record</summary>
                    <span className={styles.supporting}>
                      Source: {event.provenance.system} · Record {event.provenance.recordId} · Observed{" "}
                      {reportedTime(event.provenance.observedAt)}
                    </span>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatOverviewStatus(status: string | undefined): {
  label: string;
  tone: "critical" | "warn" | "track";
} {
  const normalized = (status || "").trim().toUpperCase();
  switch (normalized) {
    case "MISCONNECTED":
    case "OFFLOADED":
    case "DELAYED":
      return {
        label: normalized.charAt(0) + normalized.slice(1).toLowerCase(),
        tone: "critical",
      };
    case "AT_RISK":
      return { label: "At risk", tone: "warn" };
    case "IN_TRANSFER":
      return { label: "In transfer", tone: "track" };
    case "LOADED":
      return { label: "Loaded", tone: "track" };
    default:
      return {
        label: status ? status.replace(/_/g, " ") : "Tracked",
        tone: "track",
      };
  }
}

function formatOverviewTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return "Unavailable";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return (
    parsed.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Hong_Kong",
    }) + " HKT"
  );
}

function OverviewSummary({
  bag,
  connectionLabel,
}: {
  bag: LiveBag;
  connectionLabel: string;
}) {
  const statusInfo = formatOverviewStatus(bag.status);
  const events = bag.events || [];
  const latestEvent = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  const routeValue = bag.flight_number
    ? `${bag.flight_number} · ${bag.departure_airport} → ${bag.arrival_airport}`
    : connectionLabel || "Unavailable";

  const latestScanValue = latestEvent
    ? `${
        latestEvent.station_name && latestEvent.station_name !== latestEvent.location_code
          ? `${latestEvent.location_code} · ${latestEvent.station_name}`
          : latestEvent.location_code
      } · ${formatOverviewTimestamp(latestEvent.timestamp)}`
    : "No scans recorded";

  const syncValue =
    bag.is_tag_synced === true
      ? `Synced${bag.tag_interface ? ` · ${bag.tag_interface}` : ""}`
      : bag.is_tag_synced === false
        ? `Pending sync${bag.tag_interface ? ` · ${bag.tag_interface}` : ""}`
        : "Unavailable";

  const weightValue =
    typeof bag.weight_kg === "number" && bag.weight_kg > 0
      ? `${bag.weight_kg} kg`
      : "Unavailable";

  const factors = (bag.risk_factors || []).filter((item) => item.trim().length > 0);

  return (
    <div data-testid="llm-region" className={styles.overview}>
      <div className={styles.overviewLead}>
        <div className={styles.overviewHeader}>
          <span className={styles.overviewLabel}>Operational overview</span>
          <span className={styles.overviewStatus} data-tone={statusInfo.tone}>
            {statusInfo.label}
            {bag.is_rush_bag ? " · Rush priority" : ""}
          </span>
        </div>
        {bag.passenger_risk_summary && (
          <p className={styles.overviewSummaryText}>{bag.passenger_risk_summary}</p>
        )}
        {factors.length > 0 && (
          <ul className={styles.overviewFactors}>
            {factors.map((factor, idx) => (
              <li key={`${idx}-${factor}`}>{factor}</li>
            ))}
          </ul>
        )}
      </div>

      <dl className={styles.record}>
        <div>
          <dt>Flight</dt>
          <dd>{routeValue}</dd>
        </div>
        <div>
          <dt>Last location</dt>
          <dd>{bag.last_known_location || "Unavailable"}</dd>
        </div>
        <div>
          <dt>Carousel</dt>
          <dd>{bag.carousel_assigned || "Unassigned"}</dd>
        </div>
        <div>
          <dt>Latest scan</dt>
          <dd>{latestScanValue}</dd>
        </div>
        <div>
          <dt>SmartTag sync</dt>
          <dd>{syncValue}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{weightValue}</dd>
        </div>
        <div>
          <dt>Total scans</dt>
          <dd>{events.length} recorded</dd>
        </div>
      </dl>
    </div>
  );
}

export function BaggageInvestigationPanel({
  bag,
  bagRisk,
  timeToAct,
  connectionLabel,
  onClose,
  onSnapshotMutated,
}: BaggageInvestigationPanelProps) {
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<InvestigationTab>("overview");
  const [copiedTag, setCopiedTag] = useState(false);
  const id = useId();
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const indicator = useSlidingIndicator(activeTab, tablistRef, 'button[role="tab"]');

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % TABS.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + TABS.length) % TABS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActiveTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  async function copyBagTag() {
    if (!bag?.tag_number) return;
    if (await copyToClipboard(bag.tag_number)) {
      setCopiedTag(true);
      setTimeout(() => setCopiedTag(false), 1800);
    }
  }

  if (!bag) {
    return (
      <aside className={styles.inspector} aria-label="Baggage case">
        <p className={styles.unavailable}>Baggage case unavailable</p>
      </aside>
    );
  }

  const risk =
    bagRisk !== null && Number.isFinite(bagRisk) && bagRisk >= 0 && bagRisk <= 100
      ? `${bagRisk}/100`
      : "Unavailable";
  const deadline =
    timeToAct === null || !Number.isFinite(timeToAct)
      ? "Unavailable"
      : timeToAct < 0
        ? `${Math.ceil(Math.abs(timeToAct))} min overdue`
        : `${Math.floor(timeToAct)} min`;

  return (
    <aside className={styles.inspector} aria-labelledby="case-heading">
      <header>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.caption}>Baggage case</p>
            <div className={styles.headingCopyRow}>
              <h3 id="case-heading" tabIndex={-1} className={styles.heading}>
                {bag.tag_number}
              </h3>
              <button
                type="button"
                className={styles.copyTagBtn}
                onClick={copyBagTag}
                aria-label={`Copy bag tag ${bag.tag_number}`}
                title="Copy bag tag"
              >
                {copiedTag ? (
                  <>
                    <CheckIcon size={12} color="#163230" />
                    <span>Copied</span>
                  </>
                ) : (
                  <CopyIcon size={13} color="currentColor" />
                )}
              </button>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close baggage case"
              className={styles.close}
            >
              <CloseIcon size={16} color="#2D2D2D" />
            </button>
          )}
        </div>
        <p className={styles.connection}>{connectionLabel || "Connection unavailable"}</p>
        <dl className={styles.metrics}>
          <div>
            <dt>Bag risk /100</dt>
            <dd>{risk}</dd>
          </div>
          <div>
            <dt>Time to Act</dt>
            <dd>{deadline}</dd>
          </div>
          <div>
            <dt>Reported status</dt>
            <dd>{reportedLabel(bag.status)}</dd>
          </div>
        </dl>
      </header>
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Case detail sections"
        data-indicator-ready={indicator.ready ? "true" : undefined}
        className={styles.tabs}
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            data-tab-key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${id}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${id}-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
        {indicator.ready && (
          <span
            aria-hidden="true"
            className={styles.tabInkBar}
            style={{
              width: `${indicator.width}px`,
              transform: `translate3d(${indicator.left}px, 0, 0)`,
            }}
          />
        )}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${id}-panel-${tab.id}`}
          aria-labelledby={`${id}-tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          tabIndex={0}
          className={styles.tabPanel}
        >
          {tab.id === "overview" && (
            <>
              <OverviewSummary bag={bag} connectionLabel={connectionLabel} />
              <section aria-label="Live backend actions" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(18, 43, 41, 0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#163230" }}>PostgreSQL Custody &amp; Risk Actions</span>
                  {actionBusy && <span style={{ fontSize: 11, color: "#526360" }}>Syncing…</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    disabled={actionBusy !== null}
                    onClick={async () => {
                      setActionBusy("scan");
                      setActionNotice(null);
                      try {
                        const res = await fetch(`/api/v1/baggage/${encodeURIComponent(bag.tag_number)}/actions`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "scan",
                            event_type: "TRANSFER_SCANNED",
                            location_code: "HKG-T1-TRANSFER",
                            station_name: "HKIA T1 Transfer Hub",
                            notes: "Transfer scan recorded from Staff Portal",
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
                        setActionNotice({ tone: "ok", text: "Transfer scan persisted to PostgreSQL RDS." });
                        await onSnapshotMutated?.();
                      } catch (err) {
                        setActionNotice({ tone: "err", text: err instanceof Error ? err.message : "Scan failed" });
                      } finally {
                        setActionBusy(null);
                      }
                    }}
                    style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid #006564", background: "#006564", color: "#fff", cursor: "pointer" }}
                  >
                    Record Transfer Scan
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy !== null}
                    onClick={async () => {
                      setActionBusy("load");
                      setActionNotice(null);
                      try {
                        const res = await fetch(`/api/v1/baggage/${encodeURIComponent(bag.tag_number)}/actions`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "scan",
                            event_type: "LOADED",
                            location_code: "HKG-T1-GATE",
                            station_name: `Outbound ${bag.flight_number} Hold`,
                            notes: "Confirmed loaded via Staff Portal",
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
                        setActionNotice({ tone: "ok", text: `Bag marked LOADED on ${bag.flight_number} in PostgreSQL RDS.` });
                        await onSnapshotMutated?.();
                      } catch (err) {
                        setActionNotice({ tone: "err", text: err instanceof Error ? err.message : "Load update failed" });
                      } finally {
                        setActionBusy(null);
                      }
                    }}
                    style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid rgba(18, 43, 41, 0.25)", background: "#fff", color: "#163230", cursor: "pointer" }}
                  >
                    Mark Loaded
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy !== null}
                    onClick={async () => {
                      setActionBusy("risk");
                      setActionNotice(null);
                      try {
                        const res = await fetch(`/api/v1/baggage/${encodeURIComponent(bag.tag_number)}/actions`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "risk",
                            flight_number: bag.flight_number || "CX548",
                            origin: bag.departure_airport || "HKG",
                            destination: bag.arrival_airport || "NRT",
                            transfer_minutes: typeof timeToAct === "number" && timeToAct > 0 ? Math.max(15, Math.round(timeToAct + 20)) : 35,
                            weather_severity: 2,
                            load_factor_pct: 85,
                            airport_congestion: 2,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
                        const score = data.assessment?.risk_score ?? "updated";
                        setActionNotice({ tone: "ok", text: `AI risk score persisted (${score}/100).` });
                        await onSnapshotMutated?.();
                      } catch (err) {
                        setActionNotice({ tone: "err", text: err instanceof Error ? err.message : "Risk assessment failed" });
                      } finally {
                        setActionBusy(null);
                      }
                    }}
                    style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid rgba(18, 43, 41, 0.25)", background: "#fff", color: "#163230", cursor: "pointer" }}
                  >
                    Run AI Risk Check
                  </button>
                </div>
                {actionNotice && (
                  <p
                    role="status"
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: actionNotice.tone === "ok" ? "#006564" : "#9E2A2B",
                    }}
                  >
                    {actionNotice.text}
                  </p>
                )}
              </section>
            </>
          )}
          {tab.id === "journey" && <ReportedEvents events={bag.events || []} />}
          {tab.id === "smarttag" && <SmartTagStatusPanel bag={bag} />}
          {tab.id === "history" && <ReportedEvents events={bag.events || []} history />}
        </div>
      ))}
    </aside>
  );
}
