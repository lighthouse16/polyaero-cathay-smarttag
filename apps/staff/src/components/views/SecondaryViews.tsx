"use client";
import React, { useId, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { formatStatusLabel, scannerBadgeLabel } from "../../lib/utils";
import { ChevronRightIcon, CloseIcon } from "../icons/DashboardIcons";
import { stationTime } from "../transfer/OutboundFlightQueue";
import { HighlightMatch } from "../ui/HighlightMatch";

interface Props {
  bags: LiveBag[];
  selectedTagNumber: string;
  onSelectBag: (tag: string) => void;
  onSwitchToTransferControl: () => void;
}

function traceTone(status: string): "action" | "risk" | "track" {
  const s = (status || "").toUpperCase();
  if (s === "MISROUTED" || s === "MISSING" || s === "RECOVERY_IN_PROGRESS") return "action";
  if (s === "IN_TRANSFER" || s === "AWAITING_SYNC") return "risk";
  return "track";
}

export function BaggageTraceView({ bags, selectedTagNumber, onSelectBag }: Props) {
  const [query, setQuery] = useState("");
  const id = useId();
  const filtered = bags.filter((b) =>
    `${b.tag_number} ${b.tag_code} ${b.flight_number}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <section className="view-stage" aria-labelledby="trace-title">
      <div className="page-heading">
        <div>
          <h1 id="trace-title">Baggage Trace</h1>
          <p>Source-reported custody records · HKT (UTC+8)</p>
        </div>
        <div className="snapshot-time">
          {query.trim() ? `${filtered.length} of ${bags.length} records` : `${bags.length} records`}
        </div>
      </div>
      <div className="card-surface">
        <div className="table-toolbar trace-toolbar">
          <label htmlFor={id} className="sr-only">
            Search bag tag, tag UID or flight
          </label>
          <div className="toolbar-search-wrap">
            <input
              id={id}
              type="search"
              placeholder="Search bag tag, tag UID or flight"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="clear-field-btn"
                aria-label="Clear baggage trace filter"
                onClick={() => setQuery("")}
              >
                <CloseIcon size={12} color="#66686A" />
              </button>
            )}
          </div>
        </div>
        <div className="operational-scroll">
          <table className="operational-table">
            <thead>
              <tr>
                <th scope="col">Bag ID</th>
                <th scope="col">Reported flight</th>
                <th scope="col">Status</th>
                <th scope="col">Last reported event</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const event = [...b.events].sort(
                  (a, c) => Date.parse(c.timestamp) - Date.parse(a.timestamp),
                )[0];
                return (
                  <tr
                    key={b.tag_number}
                    tabIndex={0}
                    className="interactive-row"
                    aria-selected={selectedTagNumber === b.tag_number}
                    onClick={() => onSelectBag(b.tag_number)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                      } else if (e.key === "Enter" || e.key === " ") {
                        if ((e.target as HTMLElement).tagName !== "BUTTON") {
                          e.preventDefault();
                          onSelectBag(b.tag_number);
                        }
                      }
                    }}
                  >
                    <td>
                      <button
                        className="row-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBag(b.tag_number);
                        }}
                      >
                        <HighlightMatch text={b.tag_number} query={query} />
                      </button>
                    </td>
                    <td>
                      <HighlightMatch text={b.flight_number} query={query} />
                    </td>
                    <td>
                      <span className="status-pill" data-tone={traceTone(b.status)}>
                        {formatStatusLabel(b.status)}
                      </span>
                    </td>
                    <td>
                      {event ? `${stationTime(event.timestamp)} · ${formatStatusLabel(event.event_type)}` : "—"}
                    </td>
                    <td>
                      <span className="status-cell-wrap">
                        <span>
                          {event ? `${scannerBadgeLabel(event.scanner_type)} · reported` : "Unavailable"}
                        </span>
                        <ChevronRightIcon size={14} className="row-chevron" />
                      </span>
                    </td>
                  </tr>
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

export function PerformanceView({ bags, onSwitchToTransferControl }: Props) {
  return (
    <section className="view-stage" aria-labelledby="performance-title">
      <div className="page-heading">
        <div>
          <h1 id="performance-title">Performance</h1>
          <p>Current authorized snapshot only. Historical operational metrics unavailable.</p>
        </div>
      </div>
      <div className="card-surface performance-summary">
        <h2>Snapshot coverage</h2>
        <p>
          {bags.length
            ? `${bags.length} baggage records · ${bags.reduce((n, b) => n + b.events.length, 0)} source-reported events`
            : "Authorized baggage records unavailable"}
        </p>
        <p>
          Historical transfer outcomes, recovery durations and station-wide eligible population require upstream
          integration.
        </p>
        <button className="back-button" onClick={onSwitchToTransferControl}>
          Back to Transfer Control
        </button>
      </div>
    </section>
  );
}
