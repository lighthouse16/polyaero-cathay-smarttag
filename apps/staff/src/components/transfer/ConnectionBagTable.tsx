"use client";
import React, { useMemo, useState } from "react";
import type { TransferControlSnapshot } from "../../lib/types";
import {
  bagsForConnection,
  bagRiskScore,
  timeToActMinutes,
  isTransferSnapshotFresh,
  isConnectionFresh,
} from "../../lib/transferControl";
import { formatStatusLabel } from "../../lib/utils";
import { ChevronRightIcon, CloseIcon, SortArrowIcon } from "../icons/DashboardIcons";
import { HighlightMatch } from "../ui/HighlightMatch";
import { formatTimeToAct } from "./OutboundFlightQueue";

type BagSortKey = "risk" | "deadline" | "tag";
type SortDir = "asc" | "desc";

const DEFAULT_BAG_DIR: Record<BagSortKey, SortDir> = {
  risk: "desc",
  deadline: "asc",
  tag: "asc",
};

function bagStatusTone(status: string): "action" | "risk" | "track" {
  const s = (status || "").toUpperCase();
  if (s === "MISROUTED" || s === "MISSING" || s === "RECOVERY_IN_PROGRESS") return "action";
  if (s === "IN_TRANSFER" || s === "AWAITING_SYNC") return "risk";
  return "track";
}

function bagTier(score: number | null): "critical" | "high" | "medium" | "low" | "none" {
  if (score === null || !Number.isFinite(score)) return "none";
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export function ConnectionBagTable({
  snapshot,
  inboundId,
  outboundId,
  selectedTag,
  now,
  onSelect,
  stale = false,
  inert = false,
}: {
  snapshot: TransferControlSnapshot;
  inboundId: string;
  outboundId: string;
  selectedTag: string | null;
  now: Date;
  onSelect: (tag: string) => void;
  stale?: boolean;
  inert?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<BagSortKey>("risk");
  const [dir, setDir] = useState<SortDir>("desc");

  const inbound = snapshot.legs.find((l) => l.id === inboundId);
  const outbound = snapshot.legs.find((l) => l.id === outboundId);
  const fresh = !stale && isTransferSnapshotFresh(snapshot, now);
  const connectionBags = bagsForConnection(snapshot, inboundId, outboundId);

  function selectSort(nextKey: BagSortKey) {
    if (sort === nextKey) {
      setDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(nextKey);
      setDir(DEFAULT_BAG_DIR[nextKey]);
    }
  }

  const rows = useMemo(() => {
    const mult = dir === "asc" ? 1 : -1;
    return bagsForConnection(snapshot, inboundId, outboundId)
      .map((bag) => {
        const connection = snapshot.connections.find(
          (c) =>
            c.bagTag === bag.tag_number &&
            c.inboundLegId === inboundId &&
            c.outboundLegId === outboundId,
        );
        const deadline =
          fresh && connection?.status === "pending" && isConnectionFresh(snapshot, connection, now)
            ? connection.deadline
            : null;
        return {
          bag,
          risk: fresh ? bagRiskScore(snapshot, bag.tag_number, now) : null,
          time: timeToActMinutes(deadline, now),
        };
      })
      .filter(
        (r) =>
          r.bag.tag_number.toLowerCase().includes(query.trim().toLowerCase()) &&
          (!status || r.bag.status === status),
      )
      .sort((a, b) => {
        if (sort === "tag") {
          return a.bag.tag_number.localeCompare(b.bag.tag_number) * mult;
        }
        if (sort === "deadline") {
          const at = a.time ?? Infinity;
          const bt = b.time ?? Infinity;
          if (at === bt) return 0;
          if (!Number.isFinite(at)) return 1;
          if (!Number.isFinite(bt)) return -1;
          return (at - bt) * mult;
        }
        return ((a.risk ?? -1) - (b.risk ?? -1)) * mult;
      });
  }, [snapshot, inboundId, outboundId, now, query, status, sort, dir, fresh]);

  const statuses = [...new Set(connectionBags.map((b) => b.status))];

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

  return (
    <section className="bags-pane" inert={inert} aria-labelledby="bags-title">
      <div className="pane-heading">
        <div>
          <h3 id="bags-title">Connection bags</h3>
          <p>
            {outbound?.flightNumber ?? "—"} ← {inbound?.flightNumber ?? "—"}
          </p>
        </div>
        <span>
          {query || status ? `${rows.length} of ${connectionBags.length} bags` : `${connectionBags.length} bags`}
        </span>
      </div>
      <div className="table-toolbar">
        <div className="toolbar-search-wrap">
          <input
            type="search"
            aria-label="Search connection bag tags"
            placeholder="Search full bag tag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="clear-field-btn"
              aria-label="Clear bag tag filter"
              onClick={() => setQuery("")}
            >
              <CloseIcon size={12} color="#66686A" />
            </button>
          )}
        </div>
        <select
          aria-label="Filter bag status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {formatStatusLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort connection bags"
          value={sort}
          onChange={(e) => {
            const nextKey = e.target.value as BagSortKey;
            setSort(nextKey);
            setDir(DEFAULT_BAG_DIR[nextKey]);
          }}
        >
          <option value="risk">Bag risk, highest first</option>
          <option value="deadline">Time to Act, earliest first</option>
          <option value="tag">Bag ID</option>
        </select>
      </div>
      <div className="operational-scroll">
        <table className="operational-table bag-pair-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sort === "tag" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                <button
                  type="button"
                  className="th-sort-btn"
                  data-active={sort === "tag" ? "true" : undefined}
                  onClick={() => selectSort("tag")}
                >
                  Bag ID
                  <SortArrowIcon direction={sort === "tag" ? dir : "none"} />
                </button>
              </th>
              <th scope="col">Outbound</th>
              <th scope="col">Inbound</th>
              <th scope="col" aria-sort={sort === "risk" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                <button
                  type="button"
                  className="th-sort-btn"
                  data-active={sort === "risk" ? "true" : undefined}
                  onClick={() => selectSort("risk")}
                >
                  Bag risk /100
                  <SortArrowIcon direction={sort === "risk" ? dir : "none"} />
                </button>
              </th>
              <th scope="col" aria-sort={sort === "deadline" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                <button
                  type="button"
                  className="th-sort-btn"
                  data-active={sort === "deadline" ? "true" : undefined}
                  onClick={() => selectSort("deadline")}
                >
                  Time to Act
                  <SortArrowIcon direction={sort === "deadline" ? dir : "none"} />
                </button>
              </th>
              <th scope="col">Reported status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bag, risk, time }) => {
              const pct = risk !== null ? Math.max(0, Math.min(100, risk)) : 0;
              const statusLabel = fresh ? formatStatusLabel(bag.status) : "Unavailable";
              return (
                <tr
                  key={bag.tag_number}
                  tabIndex={0}
                  className="interactive-row"
                  onClick={() => onSelect(bag.tag_number)}
                  onKeyDown={handleRowKeyDown}
                  aria-selected={selectedTag === bag.tag_number}
                >
                  <td>
                    <button
                      data-bag={bag.tag_number}
                      className="row-link"
                      aria-label={`Inspect bag ${bag.tag_number}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(bag.tag_number);
                      }}
                    >
                      <HighlightMatch text={bag.tag_number} query={query} />
                    </button>
                  </td>
                  <td>{outbound?.flightNumber ?? "—"}</td>
                  <td>{inbound?.flightNumber ?? "—"}</td>
                  <td
                    data-risk-tier={bagTier(risk)}
                    style={{ "--score-pct": `${pct}%` } as React.CSSProperties}
                    className="score-cell"
                  >
                    {risk ?? "—"}
                  </td>
                  <td>{formatTimeToAct(time)}</td>
                  <td>
                    <span className="status-cell-wrap">
                      <span
                        className="status-pill"
                        data-tone={fresh ? bagStatusTone(bag.status) : "unknown"}
                      >
                        {statusLabel}
                      </span>
                      <ChevronRightIcon size={14} className="row-chevron" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="table-empty" role="status">
            No bags match this connection and current filters.
          </p>
        )}
      </div>
    </section>
  );
}
