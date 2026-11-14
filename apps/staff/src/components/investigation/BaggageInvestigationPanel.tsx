"use client";

import React, { useId, useRef, useState } from "react";
import type { BaggageEventItem, InvestigationTab, LiveBag } from "../../lib/types";
import { CloseIcon } from "../icons/DashboardIcons";
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
  return value?.trim().replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase()) || "Unavailable";
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

function ReportedEvents({ events, history = false }: { events: BaggageEventItem[]; history?: boolean }) {
  return (
    <section className={styles.events}>
      <h4>{history ? "Reported event history" : "Recorded custody events"} ({events.length})</h4>
      <p className={styles.supporting}>Source-reported records · Asia/Hong_Kong. Scanner methods do not confirm hardware verification.</p>
      {events.length === 0 ? (
        <p className={styles.unavailable}>{history ? "Event history unavailable" : "Custody events unavailable"}</p>
      ) : (
        <ol className={styles.eventList}>
          {orderedEvents(events, history).map(event => (
            <li key={event.id} className={styles.event}>
              <strong>{reportedLabel(event.event_type)}</strong>
              <span>{[event.station_name, event.location_code].filter(Boolean).join(" · ") || "Location unavailable"}</span>
              <span className={styles.supporting}>Reported method: {event.scanner_type || "Unavailable"}</span>
              <time dateTime={Number.isFinite(Date.parse(event.timestamp)) ? event.timestamp : undefined}>{reportedTime(event.timestamp)}</time>
              {event.provenance && (
                <span className={styles.supporting}>
                  Source: {event.provenance.system} · Record {event.provenance.recordId} · Observed {reportedTime(event.provenance.observedAt)}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function BaggageInvestigationPanel({ bag, bagRisk, timeToAct, connectionLabel, onClose }: BaggageInvestigationPanelProps) {
  const [activeTab, setActiveTab] = useState<InvestigationTab>("overview");
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % TABS.length; break;
      case "ArrowLeft": next = (index - 1 + TABS.length) % TABS.length; break;
      case "Home": next = 0; break;
      case "End": next = TABS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  if (!bag) return <aside className={styles.inspector} aria-label="Baggage case"><p className={styles.unavailable}>Baggage case unavailable</p></aside>;

  const risk = bagRisk !== null && Number.isFinite(bagRisk) && bagRisk >= 0 && bagRisk <= 100 ? `${bagRisk}/100` : "Unavailable";
  const deadline = timeToAct === null || !Number.isFinite(timeToAct)
    ? "Unavailable"
    : timeToAct < 0 ? `${Math.ceil(Math.abs(timeToAct))} min overdue` : `${Math.floor(timeToAct)} min`;

  return (
    <aside className={styles.inspector} aria-labelledby="case-heading">
      <header>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.caption}>Baggage case</p>
            <h3 id="case-heading" tabIndex={-1} className={styles.heading}>{bag.tag_number}</h3>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close baggage case" className={styles.close}>
              <CloseIcon size={16} color="#2D2D2D" />
            </button>
          )}
        </div>
        <p className={styles.connection}>{connectionLabel || "Connection unavailable"}</p>
        <dl className={styles.metrics}>
          <div><dt>Bag risk /100</dt><dd>{risk}</dd></div>
          <div><dt>Time to Act</dt><dd>{deadline}</dd></div>
          <div><dt>Reported status</dt><dd>{reportedLabel(bag.status)}</dd></div>
        </dl>
      </header>
      <div role="tablist" aria-label="Case detail sections" className={styles.tabs}>
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={element => { tabRefs.current[index] = element; }}
            id={`${id}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${id}-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
          >{tab.label}</button>
        ))}
      </div>
      {TABS.map(tab => (
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
