"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BaggageEventItem, LiveBag, TransferControlSnapshot } from "../../lib/types";
import { formatStatusLabel, scannerBadgeLabel } from "../../lib/utils";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  SearchIcon,
  SortArrowIcon,
} from "../icons/DashboardIcons";
import { PerformanceDashboard } from "../performance/PerformanceDashboard";
import { stationTime } from "../transfer/OutboundFlightQueue";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { copyToClipboard } from "../ui/clipboard";
import { HighlightMatch } from "../ui/HighlightMatch";

interface Props {
  bags: LiveBag[];
  selectedTagNumber: string;
  onSelectBag: (tag: string) => void;
  onSwitchToTransferControl: () => void;
  snapshot?: TransferControlSnapshot | null;
  now?: Date;
  onInspectOutboundFlight?: (outboundLegId: string) => void;
}

type TraceTone = "action" | "risk" | "track" | "unknown";
type TraceSortKey = "latest" | "status" | "tag" | "flight" | "events" | "source";
type SortDir = "asc" | "desc";

const DEFAULT_TRACE_SORT_DIR: Record<TraceSortKey, SortDir> = {
  latest: "desc",
  status: "asc",
  tag: "asc",
  flight: "asc",
  events: "desc",
  source: "asc",
};

const TONE_PRIORITY: Record<TraceTone, number> = {
  action: 0,
  risk: 1,
  track: 2,
  unknown: 3,
};

export function traceTone(status: string): TraceTone {
  const s = (status || "").toUpperCase();
  if (s === "MISROUTED" || s === "MISSING" || s === "RECOVERY_IN_PROGRESS") return "action";
  if (s === "AWAITING_SYNC") return "risk";
  if (["IN_TRANSFER", "LOADED", "IN_TRANSIT", "ARRIVED", "ON_CAROUSEL", "COLLECTED", "TRANSFERRED", "DELIVERED", "TAGGED", "CHECKED_IN"].includes(s)) return "track";
  return "unknown";
}

function chronologicalEvents(events: BaggageEventItem[]): BaggageEventItem[] {
  return [...(events || [])].sort((a, b) => {
    const tA = Date.parse(a.timestamp);
    const tB = Date.parse(b.timestamp);
    if (!Number.isFinite(tA)) return Number.isFinite(tB) ? 1 : 0;
    if (!Number.isFinite(tB)) return -1;
    return tA - tB;
  });
}

export function BaggageTraceView({ bags, selectedTagNumber, onSelectBag }: Props) {
  const [query, setQuery] = useState("");
  const [toneFilter, setToneFilter] = useState<"" | TraceTone>("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sortKey, setSortKey] = useState<TraceSortKey>("latest");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const id = useId();

  // Press "/" to focus trace search when not typing in an input
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const enrichedBags = useMemo(() => {
    return bags.map((bag) => {
      const ordered = chronologicalEvents(bag.events || []);
      const latestEvent = [...ordered].reverse().find((event) => Number.isFinite(Date.parse(event.timestamp))) ?? null;
      const latestMs = latestEvent ? Date.parse(latestEvent.timestamp) : -1;
      const sourceLabel = latestEvent ? scannerBadgeLabel(latestEvent.scanner_type) : "Unavailable";
      const tone = traceTone(bag.status);
      return {
        bag,
        ordered,
        latestEvent,
        latestMs: Number.isFinite(latestMs) ? latestMs : -1,
        sourceLabel,
        tone,
      };
    });
  }, [bags]);

  const summary = useMemo(() => {
    let actionCount = 0;
    let riskCount = 0;
    let trackCount = 0;
    let totalScans = 0;
    for (const item of enrichedBags) {
      totalScans += item.ordered.length;
      if (item.tone === "action") actionCount++;
      else if (item.tone === "risk") riskCount++;
      else if (item.tone === "track") trackCount++;
    }
    return {
      total: enrichedBags.length,
      actionCount,
      riskCount,
      trackCount,
      totalScans,
    };
  }, [enrichedBags]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const item of enrichedBags) {
      for (const ev of item.ordered) {
        if (ev.scanner_type) set.add(scannerBadgeLabel(ev.scanner_type));
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enrichedBags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mult = sortDir === "asc" ? 1 : -1;

    return enrichedBags
      .filter((item) => {
        if (toneFilter && item.tone !== toneFilter) return false;
        if (sourceFilter) {
          const matchesSource = item.ordered.some(
            (ev) => scannerBadgeLabel(ev.scanner_type) === sourceFilter,
          );
          if (!matchesSource) return false;
        }
        if (!q) return true;
        const haystack = [
          item.bag.tag_number,
          item.bag.tag_code,
          item.bag.flight_number,
          item.bag.departure_airport,
          item.bag.arrival_airport,
          formatStatusLabel(item.bag.status),
          item.sourceLabel,
          ...item.ordered.map((e) => `${e.location_code} ${e.station_name} ${e.event_type}`),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "tag":
            cmp = a.bag.tag_number.localeCompare(b.bag.tag_number) * mult;
            break;
          case "flight":
            cmp = a.bag.flight_number.localeCompare(b.bag.flight_number) * mult;
            break;
          case "status":
            cmp =
              (TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone] ||
                formatStatusLabel(a.bag.status).localeCompare(formatStatusLabel(b.bag.status))) *
              mult;
            break;
          case "events":
            cmp = (a.ordered.length - b.ordered.length) * mult;
            break;
          case "source":
            cmp = a.sourceLabel.localeCompare(b.sourceLabel) * mult;
            break;
          case "latest":
          default:
            cmp = (a.latestMs - b.latestMs) * mult;
            break;
        }
        if (cmp !== 0) return cmp;
        return (
          TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone] ||
          a.bag.tag_number.localeCompare(b.bag.tag_number)
        );
      });
  }, [enrichedBags, query, toneFilter, sourceFilter, sortKey, sortDir]);

  function toggleSort(nextKey: TraceSortKey) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir(DEFAULT_TRACE_SORT_DIR[nextKey]);
    }
  }

  async function handleCopyTag(e: React.MouseEvent, tagNumber: string) {
    e.stopPropagation();
    if (await copyToClipboard(tagNumber)) {
      setCopiedTag(tagNumber);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        setCopiedTag((prev) => (prev === tagNumber ? null : prev));
      }, 1600);
    }
  }

  const hasActiveFilters = Boolean(query.trim() || toneFilter || sourceFilter);
  const ariaSort = (key: TraceSortKey): "ascending" | "descending" | "none" =>
    sortKey !== key ? "none" : sortDir === "asc" ? "ascending" : "descending";

  const kpiCards: Array<{
    key: "" | TraceTone;
    label: string;
    value: number;
    detail: string;
    active: boolean;
  }> = [
    {
      key: "",
      label: "Traced custody records",
      value: summary.total,
      detail: `${summary.totalScans} source-reported scans in HKT`,
      active: toneFilter === "" && !sourceFilter && !query.trim(),
    },
    {
      key: "action",
      label: "Exceptions & recovery",
      value: summary.actionCount,
      detail: "Misrouted, missing or active recovery",
      active: toneFilter === "action",
    },
    {
      key: "risk",
      label: "In transfer / tag synced",
      value: summary.riskCount,
      detail: "Checked in, synced or in transfer",
      active: toneFilter === "risk",
    },
    {
      key: "track",
      label: "Loaded / onward status reported",
      value: summary.trackCount,
      detail: "Loaded, arrived or collected",
      active: toneFilter === "track",
    },
  ];

  return (
    <section className="view-stage" aria-labelledby="trace-title">
      <div className="page-heading">
        <div>
          <h1 id="trace-title" className="sr-only">Baggage Trace</h1>
        </div>
        <div className="snapshot-meta">
          <div className="snapshot-time">
            <span className="live-dot" aria-hidden="true" />
            <span>
              {hasActiveFilters
                ? `${filtered.length} of ${bags.length} records`
                : `${bags.length} records · ${summary.totalScans} scans`}
            </span>
          </div>
        </div>
      </div>

      <div className="kpi-grid trace-kpi-grid" aria-label="Custody status summary">
        {kpiCards.map((card, idx) => {
          const isFilterCard = card.key !== "";
          const isSelected = isFilterCard && toneFilter === card.key;
          return (
            <section
              key={card.label}
              className="card-surface metric-card"
              style={{ "--card-index": idx } as React.CSSProperties}
              data-interactive="true"
              data-active={isSelected ? "true" : undefined}
            >
              <div className="metric-card-top">
                <h2>{card.label}</h2>
                <button
                  type="button"
                  className="metric-card-toggle"
                  aria-pressed={isSelected}
                  aria-label={
                    isFilterCard
                      ? `${isSelected ? "Clear filter for" : "Filter trace by"} ${card.label}`
                      : "Show all traced custody records"
                  }
                  onClick={() => {
                    if (!isFilterCard) {
                      setToneFilter("");
                      setSourceFilter("");
                      setQuery("");
                    } else {
                      setToneFilter((prev) => (prev === card.key ? "" : card.key));
                    }
                  }}
                >
                  {isFilterCard ? (isSelected ? "Filtered" : "Filter") : "All"}
                </button>
              </div>
              <strong className="tabular-nums">
                <AnimatedNumber value={card.value} durationMs={340} />
              </strong>
              <p>{card.detail}</p>
            </section>
          );
        })}
      </div>

      <div className="card-surface trace-surface">
        <div className="queue-heading trace-queue-heading">
          <div>
            <h2>Custody Scan Ledger</h2>
            <p>
              Select any record to open its transfer flight workbench, or expand inline scan
              provenance
            </p>
          </div>
          <span className="queue-count">
            {hasActiveFilters
              ? `${filtered.length} of ${bags.length} matching bags`
              : `${bags.length} traced bags`}
          </span>
        </div>

        <div className="table-toolbar trace-toolbar">
          <label htmlFor={id} className="sr-only">
            Search bag tag, tag UID or flight
          </label>
          <div className="toolbar-search-wrap trace-search-wrap">
            <span className="trace-search-icon" aria-hidden="true">
              <SearchIcon size={15} color="#66686A" />
            </span>
            <input
              ref={searchInputRef}
              id={id}
              name="trace-search"
              type="search"
              placeholder="Search bag tag, tag UID, flight, airport or location… (Press /)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="clear-field-btn"
                aria-label="Clear baggage trace filter"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <CloseIcon size={12} color="#66686A" />
              </button>
            )}
          </div>

          <select
            id={`${id}-status`}
            name="trace-status-filter"
            aria-label="Filter custody status"
            value={toneFilter}
            onChange={(e) => setToneFilter(e.target.value as "" | TraceTone)}
          >
            <option value="">All custody states</option>
            <option value="action">Exceptions &amp; recovery</option>
            <option value="risk">In transfer / tag synced</option>
            <option value="track">Loaded / onward status reported</option>
          </select>

          <select
            id={`${id}-source`}
            name="trace-source-filter"
            aria-label="Filter scanner source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">All scanner sources</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          <select
            id={`${id}-sort`}
            name="trace-sort-select"
            aria-label="Sort custody records"
            value={sortKey}
            onChange={(e) => {
              const next = e.target.value as TraceSortKey;
              setSortKey(next);
              setSortDir(DEFAULT_TRACE_SORT_DIR[next]);
            }}
          >
            <option value="latest">Latest scan, newest first</option>
            <option value="status">Status priority (Exceptions first)</option>
            <option value="events">Scan count, highest first</option>
            <option value="flight">Reported flight</option>
            <option value="tag">Bag ID</option>
            <option value="source">Scanner source</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className="filter-reset-chip"
              onClick={() => {
                setQuery("");
                setToneFilter("");
                setSourceFilter("");
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="operational-scroll">
          <table className="operational-table trace-table">
            <thead>
              <tr>
                <th scope="col" aria-sort={ariaSort("tag")}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    data-active={sortKey === "tag" ? "true" : undefined}
                    onClick={() => toggleSort("tag")}
                  >
                    Bag ID
                    <SortArrowIcon direction={sortKey === "tag" ? sortDir : "none"} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("flight")}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    data-active={sortKey === "flight" ? "true" : undefined}
                    onClick={() => toggleSort("flight")}
                  >
                    Reported flight
                    <SortArrowIcon direction={sortKey === "flight" ? sortDir : "none"} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("status")}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    data-active={sortKey === "status" ? "true" : undefined}
                    onClick={() => toggleSort("status")}
                  >
                    Status
                    <SortArrowIcon direction={sortKey === "status" ? sortDir : "none"} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("events")}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    data-active={sortKey === "events" ? "true" : undefined}
                    onClick={() => toggleSort("events")}
                  >
                    Custody chain
                    <SortArrowIcon direction={sortKey === "events" ? sortDir : "none"} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("latest")}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    data-active={sortKey === "latest" ? "true" : undefined}
                    onClick={() => toggleSort("latest")}
                  >
                    Last reported event
                    <SortArrowIcon direction={sortKey === "latest" ? sortDir : "none"} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("source")}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    data-active={sortKey === "source" ? "true" : undefined}
                    onClick={() => toggleSort("source")}
                  >
                    Source
                    <SortArrowIcon direction={sortKey === "source" ? sortDir : "none"} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ bag: b, ordered, latestEvent: event, sourceLabel, tone }) => {
                const isExpanded = expandedTag === b.tag_number;
                const isCopied = copiedTag === b.tag_number;
                const recentChain = ordered.slice(-3);
                return (
                  <React.Fragment key={b.tag_number}>
                    <tr
                      tabIndex={0}
                      className="interactive-row trace-row"
                      aria-selected={selectedTagNumber === b.tag_number}
                      data-expanded={isExpanded ? "true" : undefined}
                      onClick={() => onSelectBag(b.tag_number)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          (e.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>("tr.trace-row")[filtered.findIndex((item) => item.bag.tag_number === b.tag_number) + 1])?.focus();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          (e.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>("tr.trace-row")[filtered.findIndex((item) => item.bag.tag_number === b.tag_number) - 1])?.focus();
                        } else if (e.key === "Enter" || e.key === " ") {
                          if (!(e.target as HTMLElement).closest("button")) {
                            e.preventDefault();
                            onSelectBag(b.tag_number);
                          }
                        }
                      }}
                    >
                      <td>
                        <div className="trace-bag-cell">
                          <button
                            type="button"
                            className="row-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBag(b.tag_number);
                            }}
                          >
                            <HighlightMatch text={b.tag_number} query={query} />
                          </button>
                          <button
                            type="button"
                            className="trace-copy-btn"
                            aria-label={`Copy bag tag ${b.tag_number}`}
                            title="Copy bag tag"
                            onClick={(e) => void handleCopyTag(e, b.tag_number)}
                          >
                            {isCopied ? (
                              <>
                                <CheckIcon size={11} color="#163230" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <CopyIcon size={12} color="currentColor" />
                            )}
                          </button>
                        </div>
                        {b.tag_code && (
                          <small className="trace-uid-sub">
                            UID <HighlightMatch text={b.tag_code} query={query} />
                          </small>
                        )}
                      </td>
                      <td>
                        <strong className="trace-flight-code">
                          <HighlightMatch text={b.flight_number} query={query} />
                        </strong>
                        <small>
                          {b.departure_airport} → {b.arrival_airport}
                        </small>
                      </td>
                      <td>
                        <span className="status-pill" data-tone={tone}>
                          {formatStatusLabel(b.status)}
                        </span>
                      </td>
                      <td>
                        {ordered.length > 0 ? (
                          <div className="trace-chain-cell">
                            <div className="trace-chain-steps" aria-label={`${ordered.length} custody events`}>
                              {ordered.length > 3 && (
                                <span className="trace-step-more">+{ordered.length - 3}</span>
                              )}
                              {recentChain.map((ev, idx) => (
                                <React.Fragment key={ev.id}>
                                  {idx > 0 && (
                                    <span className="trace-step-sep" aria-hidden="true">
                                      →
                                    </span>
                                  )}
                                  <span
                                    className="trace-step-chip"
                                    data-latest={idx === recentChain.length - 1 ? "true" : undefined}
                                  >
                                    {formatStatusLabel(ev.event_type)}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                            <small>
                              {ordered.length} {ordered.length === 1 ? "recorded scan" : "recorded scans"}
                            </small>
                          </div>
                        ) : (
                          <span className="trace-muted">—</span>
                        )}
                      </td>
                      <td>
                        {event ? (
                          <div>
                            <span>
                              {stationTime(event.timestamp)} · {formatStatusLabel(event.event_type)}
                            </span>
                            <small>
                              <HighlightMatch
                                text={event.location_code || event.station_name || "Location unavailable"}
                                query={query}
                              />
                            </small>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="status-cell-wrap trace-source-cell">
                          <span className="trace-source-text">
                            {event ? `${sourceLabel} · reported` : "Unavailable"}
                          </span>
                          <span className="trace-row-actions">
                            {ordered.length > 0 && (
                              <button
                                type="button"
                                className="trace-expand-btn"
                                aria-expanded={isExpanded}
                                aria-controls={`${id}-audit-${b.tag_number}`}
                                aria-label={`${isExpanded ? "Hide" : "Inspect"} ${ordered.length} custody events for bag ${b.tag_number}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTag((prev) =>
                                    prev === b.tag_number ? null : b.tag_number,
                                  );
                                }}
                              >
                                <span>Audit ({ordered.length})</span>
                                <span
                                  className={`trace-expand-chevron ${isExpanded ? "is-open" : ""}`}
                                  aria-hidden="true"
                                >
                                  <ChevronDownIcon size={12} />
                                </span>
                              </button>
                            )}
                            <ChevronRightIcon size={14} className="row-chevron" />
                          </span>
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="trace-audit-row">
                        <td colSpan={6}>
                          <div
                            className="trace-audit-drawer"
                            id={`${id}-audit-${b.tag_number}`}
                            role="region"
                            aria-label={`Custody scan audit trail for bag ${b.tag_number}`}
                          >
                            <div className="trace-audit-header">
                              <div>
                                <strong>
                                  Custody Audit Trail · Bag {b.tag_number}
                                </strong>
                                <span>
                                  {b.flight_number} ({b.departure_airport} → {b.arrival_airport}) ·{" "}
                                  {ordered.length} chronological scan{" "}
                                  {ordered.length === 1 ? "entry" : "entries"} (Asia/Hong_Kong)
                                </span>
                              </div>
                              <button
                                type="button"
                                className="trace-workbench-cta"
                                onClick={() => onSelectBag(b.tag_number)}
                              >
                                <span>Open in Transfer Workbench</span>
                                <ChevronRightIcon size={13} color="currentColor" />
                              </button>
                            </div>

                            <ol className="trace-audit-timeline">
                              {ordered.map((ev, idx) => {
                                const isLatest = idx === ordered.length - 1;
                                return (
                                  <li
                                    key={ev.id}
                                    className="trace-audit-step"
                                    data-latest={isLatest ? "true" : undefined}
                                  >
                                    <div className="trace-audit-step-top">
                                      <span className="trace-audit-index">
                                        {String(idx + 1).padStart(2, "0")}
                                      </span>
                                      <strong>{formatStatusLabel(ev.event_type)}</strong>
                                      {ev.location_code && (
                                        <span className="trace-audit-loc-badge">
                                          {ev.location_code}
                                        </span>
                                      )}
                                    </div>
                                    <div className="trace-audit-step-meta">
                                      <span>{stationTime(ev.timestamp)} HKT</span>
                                      <span>·</span>
                                      <span>{scannerBadgeLabel(ev.scanner_type)} (reported)</span>
                                    </div>
                                    {ev.station_name &&
                                      ev.station_name.toUpperCase() !==
                                        (ev.location_code || "").toUpperCase() && (
                                        <div className="trace-audit-station">{ev.station_name}</div>
                                      )}
                                    {ev.provenance && (
                                      <div className="trace-audit-prov">
                                        Source: {ev.provenance.system} · ID {ev.provenance.recordId}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="table-empty" role="status">
              No authorized baggage records available for current search.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function PerformanceView({
  snapshot = null,
  now,
  onInspectOutboundFlight,
  onSwitchToTransferControl,
}: Props) {
  return (
    <PerformanceDashboard
      snapshot={snapshot}
      now={now}
      onInspectOutboundFlight={onInspectOutboundFlight}
      onSwitchToTransferControl={onSwitchToTransferControl}
    />
  );
}
