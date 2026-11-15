"use client";
import React, { useMemo, useState } from "react";
import type { OutboundFlightSummary } from "../../lib/types";
import { isOperationalProvenanceFresh } from "../../lib/transferControl";
import { ChevronRightIcon, CloseIcon, SortArrowIcon } from "../icons/DashboardIcons";
import { HighlightMatch } from "../ui/HighlightMatch";

export function formatTimeToAct(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return minutes < 0 ? `${Math.ceil(Math.abs(minutes))} min overdue` : `${Math.floor(minutes)} min`;
}

export function stationTime(at: string | null | undefined): string {
  if (!at || !Number.isFinite(Date.parse(at))) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at));
}

export function flightAttention(f: OutboundFlightSummary): string {
  return f.actionRequiredCount
    ? "Action required"
    : f.atRiskCount
      ? "At risk"
      : f.unknownCount
        ? "Unavailable"
        : f.onTrackCount
          ? "On track"
          : "No active transfers";
}

function attentionTone(label: string): "action" | "risk" | "track" | "unknown" {
  if (label === "Action required") return "action";
  if (label === "At risk") return "risk";
  if (label === "On track") return "track";
  return "unknown";
}

function scoreTier(score: number | null | undefined): "critical" | "high" | "medium" | "low" | "none" {
  if (score === null || score === undefined || !Number.isFinite(score)) return "none";
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

type SortKey = "risk" | "deadline" | "action" | "flight";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  risk: "desc",
  deadline: "asc",
  action: "desc",
  flight: "asc",
};

export function OutboundFlightQueue({
  flights,
  now,
  onSelect,
  unavailable,
  loading,
  actionOnly = false,
  statusFilter,
  onStatusFilterChange,
  onClearActionOnly,
}: {
  flights: OutboundFlightSummary[];
  now: Date;
  onSelect: (id: string) => void;
  unavailable: boolean;
  loading: boolean;
  actionOnly?: boolean;
  statusFilter?: string;
  onStatusFilterChange?: (next: string) => void;
  onClearActionOnly?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [localStatus, setLocalStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("risk");
  const [dir, setDir] = useState<SortDir>("desc");

  const status = statusFilter ?? localStatus;
  const setStatus = (next: string) => {
    if (onStatusFilterChange) onStatusFilterChange(next);
    else setLocalStatus(next);
  };

  function selectSort(nextKey: SortKey) {
    if (unavailable) return;
    if (sort === nextKey) {
      setDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(nextKey);
      setDir(DEFAULT_DIR[nextKey]);
    }
  }

  function handleSelectChange(nextKey: SortKey) {
    setSort(nextKey);
    setDir(DEFAULT_DIR[nextKey]);
  }

  const rows = useMemo(() => {
    const mult = dir === "asc" ? 1 : -1;
    return flights
      .filter(
        (f) =>
          `${f.leg.flightNumber} ${f.leg.origin} ${f.leg.destination} ${f.leg.operatingDate}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()) &&
          (unavailable ||
            ((!status || flightAttention(f) === status) &&
              (!actionOnly || f.actionRequiredCount > 0))),
      )
      .sort((a, b) => {
        if (unavailable || sort === "flight") {
          return a.leg.flightNumber.localeCompare(b.leg.flightNumber) * (unavailable ? 1 : mult);
        }
        if (sort === "deadline") {
          const aTime = a.earliestActionAt ? Date.parse(a.earliestActionAt) : Infinity;
          const bTime = b.earliestActionAt ? Date.parse(b.earliestActionAt) : Infinity;
          if (aTime === bTime) return 0;
          if (!Number.isFinite(aTime)) return 1;
          if (!Number.isFinite(bTime)) return -1;
          return (aTime - bTime) * mult;
        }
        if (sort === "action") {
          return (a.actionRequiredCount - b.actionRequiredCount) * mult;
        }
        return ((a.riskScore ?? -1) - (b.riskScore ?? -1)) * mult;
      });
  }, [flights, query, status, sort, dir, actionOnly, unavailable]);

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      (event.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      (event.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      const target = event.target as HTMLElement;
      if (target.tagName !== "BUTTON") {
        event.preventDefault();
        event.currentTarget.click();
      }
    }
  }

  const hasFilters = Boolean(query.trim() || status || actionOnly);
  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    unavailable || sort !== key ? "none" : dir === "asc" ? "ascending" : "descending";

  return (
    <section
      id="outbound-queue"
      className="card-surface flight-queue"
      aria-labelledby="outbound-title"
      aria-busy={loading}
    >
      <div className="queue-heading">
        <div>
          <h2 id="outbound-title">Outbound Flight Risk Queue</h2>
          <p>Transfer departures from HKG</p>
        </div>
        <span className="queue-count">
          {unavailable
            ? "Data unavailable"
            : hasFilters
              ? `${rows.length} of ${flights.length} outbound flights`
              : `${flights.length} outbound flights`}
        </span>
      </div>
      <div className="table-toolbar">
        <div className="toolbar-search-wrap">
          <input
            id="outbound-flight-search"
            name="outbound-flight-search"
            type="search"
            aria-label="Search outbound flights"
            placeholder="Flight or destination"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="clear-field-btn"
              aria-label="Clear flight search"
              onClick={() => setQuery("")}
            >
              <CloseIcon size={12} color="#66686A" />
            </button>
          )}
        </div>
        <select
          id="outbound-status-filter"
          name="outbound-status-filter"
          disabled={unavailable}
          aria-label="Filter outbound status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["Action required", "At risk", "On track", "Unavailable"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          id="outbound-sort-select"
          name="outbound-sort-select"
          disabled={unavailable}
          aria-label="Sort outbound flights"
          value={sort}
          onChange={(e) => handleSelectChange(e.target.value as SortKey)}
        >
          <option value="risk">Flight risk, highest first</option>
          <option value="deadline">Deadline, earliest first</option>
          <option value="action">Action required, highest first</option>
          <option value="flight">Flight number</option>
        </select>
        {hasFilters && !unavailable && (
          <button
            type="button"
            className="filter-reset-chip"
            onClick={() => {
              setQuery("");
              setStatus("");
              onClearActionOnly?.();
            }}
          >
            Reset filters
          </button>
        )}
      </div>
      <div className="operational-scroll">
        <table className="operational-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort("flight")}>
                <button
                  type="button"
                  className="th-sort-btn"
                  disabled={unavailable}
                  data-active={!unavailable && sort === "flight" ? "true" : undefined}
                  onClick={() => selectSort("flight")}
                >
                  Outbound flight
                  <SortArrowIcon direction={!unavailable && sort === "flight" ? dir : "none"} />
                </button>
              </th>
              <th scope="col">HKG → destination</th>
              <th scope="col">Departure / ETD</th>
              <th scope="col">Transfer bags</th>
              <th scope="col" aria-sort={ariaSort("risk")}>
                <button
                  type="button"
                  className="th-sort-btn"
                  disabled={unavailable}
                  data-active={!unavailable && sort === "risk" ? "true" : undefined}
                  onClick={() => selectSort("risk")}
                >
                  Flight risk /100
                  <SortArrowIcon direction={!unavailable && sort === "risk" ? dir : "none"} />
                </button>
              </th>
              <th scope="col" aria-sort={ariaSort("deadline")}>
                <button
                  type="button"
                  className="th-sort-btn"
                  disabled={unavailable}
                  data-active={!unavailable && sort === "deadline" ? "true" : undefined}
                  onClick={() => selectSort("deadline")}
                >
                  Earliest Time to Act
                  <SortArrowIcon direction={!unavailable && sort === "deadline" ? dir : "none"} />
                </button>
              </th>
              <th scope="col" aria-sort={ariaSort("action")}>
                <button
                  type="button"
                  className="th-sort-btn"
                  disabled={unavailable}
                  data-active={!unavailable && sort === "action" ? "true" : undefined}
                  onClick={() => selectSort("action")}
                >
                  Action required
                  <SortArrowIcon direction={!unavailable && sort === "action" ? dir : "none"} />
                </button>
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const riskVal = unavailable ? null : f.riskScore;
              const tier = scoreTier(riskVal);
              const attention = unavailable ? "Unavailable" : flightAttention(f);
              const pct = riskVal !== null && riskVal !== undefined ? Math.max(0, Math.min(100, riskVal)) : 0;
              return (
                <tr
                  key={f.leg.id}
                  tabIndex={0}
                  className="interactive-row"
                  onClick={() => onSelect(f.leg.id)}
                  onKeyDown={handleRowKeyDown}
                >
                  <td>
                    <button
                      className="row-link"
                      data-outbound={f.leg.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(f.leg.id);
                      }}
                      aria-label={`Inspect outbound ${f.leg.flightNumber} ${f.leg.operatingDate}`}
                    >
                      <HighlightMatch text={f.leg.flightNumber} query={query} />
                    </button>
                    <small>{f.leg.operatingDate}</small>
                  </td>
                  <td>
                    {f.leg.origin} → <HighlightMatch text={f.leg.destination} query={query} />
                  </td>
                  <td>
                    {unavailable || !isOperationalProvenanceFresh(f.leg.provenance, now)
                      ? "—"
                      : stationTime(f.leg.estimatedDepartureAt ?? f.leg.scheduledDepartureAt)}
                    <small>
                      {f.leg.estimatedDepartureAt ? "Estimated" : f.leg.scheduledDepartureAt ? "Scheduled" : "Unavailable"}
                    </small>
                  </td>
                  <td>{f.transferBagCount}</td>
                  <td
                    data-risk-tier={tier}
                    style={{ "--score-pct": `${pct}%` } as React.CSSProperties}
                    className="score-cell"
                  >
                    {unavailable || f.riskScore === null || f.riskScore === undefined
                      ? "—"
                      : `${f.riskScore}%`}
                  </td>
                  <td>
                    {formatTimeToAct(
                      !unavailable && f.earliestActionAt
                        ? (Date.parse(f.earliestActionAt) - now.getTime()) / 60000
                        : null,
                    )}
                  </td>
                  <td>{unavailable ? "—" : f.actionRequiredCount}</td>
                  <td>
                    <span className="status-cell-wrap">
                      <span className="status-pill" data-tone={attentionTone(attention)}>
                        {attention}
                      </span>
                      <ChevronRightIcon size={14} className="row-chevron" />
                    </span>
                  </td>
                </tr>
              );
            })}
            {loading && rows.length === 0 && (
              <>
                <tr className="skeleton-row" aria-hidden="true">
                  <td colSpan={8}><div className="skeleton-line" /></td>
                </tr>
                <tr className="skeleton-row" aria-hidden="true">
                  <td colSpan={8}><div className="skeleton-line short" /></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        {rows.length === 0 && !loading && (
          <div className="table-empty" role="status">
            {unavailable ? "Outbound flight associations unavailable" : "No outbound flights match current filters"}
          </div>
        )}
      </div>
    </section>
  );
}
