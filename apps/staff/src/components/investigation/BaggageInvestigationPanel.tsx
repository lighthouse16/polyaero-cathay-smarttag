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

export function BaggageInvestigationPanel({
  bag,
  bagRisk,
  timeToAct,
  connectionLabel,
  onClose,
}: BaggageInvestigationPanelProps) {
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
          {tab.id === "overview" && <div data-testid="llm-region" className={styles.llmRegion} />}
          {tab.id === "journey" && <ReportedEvents events={bag.events || []} />}
          {tab.id === "smarttag" && <SmartTagStatusPanel bag={bag} />}
          {tab.id === "history" && <ReportedEvents events={bag.events || []} history />}
        </div>
      ))}
    </aside>
  );
}
