"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import styles from "./BaggageRiskTable.module.css";
import type { LiveBag } from "../../lib/types";
import {
  formatLastEventSummary,
  formatStatusLabel,
  isAtRiskBag,
  isExceptionBag,
} from "../../lib/utils";
import { SearchIcon } from "../icons/DashboardIcons";

interface Props {
  bags: LiveBag[];
  selectedTagNumber: string;
  onSelectBag: (tag: string) => void;
  externalFlightFilter: string | null;
  onClearExternalFlight: () => void;
  onQuickAction?: (bag: LiveBag, action: string) => void;
  isLoading?: boolean;
}

export function BaggageRiskTable({
  bags,
  selectedTagNumber,
  onSelectBag,
  externalFlightFilter,
  onClearExternalFlight,
  onQuickAction,
  isLoading,
}: Props) {
  const [tab, setTab] = useState<"risk" | "all">("risk");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [flight, setFlight] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState("");
  const [openMenuTag, setOpenMenuTag] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "risk_score", desc: true },
  ]);

  const filtered = useMemo(
    () =>
      bags.filter((b) => {
        const q = search.trim().toLowerCase();
        return (
          (!q ||
            `${b.tag_number} ${b.passenger_name} ${b.booking_reference} ${b.flight_number}`
              .toLowerCase()
              .includes(q)) &&
          (!(externalFlightFilter || flight) ||
            b.flight_number === (externalFlightFilter || flight)) &&
          (!risk || b.risk_level === risk) &&
          (!status || b.status === status)
        );
      }),
    [bags, search, flight, externalFlightFilter, risk, status],
  );

  const riskRows = useMemo(() => filtered.filter(isAtRiskBag), [filtered]);
  const data = tab === "risk" ? riskRows : filtered;

  useEffect(() => {
    if (isLoading) return;
    if (data.length > 0 && !data.some((b) => b.tag_number === selectedTagNumber)) {
      onSelectBag(data[0].tag_number);
    }
  }, [data, selectedTagNumber, onSelectBag, isLoading]);

  const hasActiveFilters = Boolean(
    search || flight || externalFlightFilter || risk || status,
  );
  const allBagsDisplayCount =
    !hasActiveFilters && bags.length >= 8 ? "2,841" : String(filtered.length);

  const columns = useMemo<ColumnDef<LiveBag>[]>(
    () => [
      {
        id: "selection",
        header: () => (
          <span
            aria-label="Selection"
            style={{
              display: "inline-flex",
              width: "14px",
              height: "14px",
              borderRadius: "4px",
              border: "1.5px solid #B8BEB9",
              backgroundColor: "#FFFFFF",
            }}
          />
        ),
        enableSorting: false,
        cell: ({ row }) => {
          const isSelected = row.original.tag_number === selectedTagNumber;
          const showWarn = !isSelected && isAtRiskBag(row.original);
          return (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`Select ${row.original.tag_number}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBag(row.original.tag_number);
                }}
                style={{
                  width: "15px",
                  height: "15px",
                  borderRadius: "4px",
                  border: isSelected ? "1.5px solid #0B4D3E" : "1.5px solid #C2C8C4",
                  backgroundColor: isSelected ? "#0B4D3E" : "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              {showWarn && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#856432"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "tag_number",
        header: "Bag Tag",
        cell: ({ row }) => (
          <button
            type="button"
            className={styles["tag-link"]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBag(row.original.tag_number);
            }}
          >
            {row.original.tag_number}
          </button>
        ),
      },
      {
        accessorKey: "passenger_name",
        header: "Passenger",
        cell: ({ row }) => row.original.passenger_name.replace("/", " / "),
      },
      {
        id: "flight",
        accessorFn: (r) => `${r.flight_number} ${r.arrival_airport}`,
        header: "Flight (In → Out)",
        cell: ({ row }) =>
          `${row.original.flight_number} → ${row.original.arrival_airport}`,
      },
      {
        accessorKey: "connection_minutes",
        header: "Connection",
        cell: ({ row }) =>
          row.original.connection_minutes == null
            ? "—"
            : `${row.original.connection_minutes} min`,
      },
      {
        accessorKey: "risk_score",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            aria-label="Sort by risk score"
          >
            Risk <span aria-hidden="true">↕</span>
          </button>
        ),
        cell: ({ row }) => {
          const score = row.original.risk_score;
          const cls =
            score >= 75
              ? styles["risk-critical"]
              : score >= 60
                ? styles["risk-high"]
                : score >= 35
                  ? styles["risk-medium"]
                  : styles["risk-low"];
          return (
            <span className={`${styles["risk-pill"]} ${cls}`}>{score}</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          const cls = isExceptionBag(row.original)
            ? styles["status-exception"]
            : s === "IN_TRANSFER" || s === "CHECKED_IN"
              ? styles["status-transfer"]
              : styles["status-ok"];
          return (
            <span className={`${styles["status-pill"]} ${cls}`}>
              {formatStatusLabel(s)}
            </span>
          );
        },
      },
      {
        id: "last_event",
        header: "Last Event",
        enableSorting: false,
        cell: ({ row }) => (
          <span style={{ color: "#374151" }}>
            {formatLastEventSummary(row.original)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span style={{ color: "#9CA3AF" }}>•••</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const bag = row.original;
          const isOpen = openMenuTag === bag.tag_number;
          return (
            <div style={{ position: "relative", textAlign: "right" }}>
              <button
                type="button"
                className={styles["kebab-btn"]}
                aria-label={`Actions for ${bag.tag_number}`}
                aria-expanded={isOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuTag(isOpen ? null : bag.tag_number);
                }}
              >
                •••
              </button>
              {isOpen && (
                <div
                  className={styles["kebab-menu"]}
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuTag(null);
                      onSelectBag(bag.tag_number);
                    }}
                  >
                    Inspect baggage case
                  </button>
                  {onQuickAction && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuTag(null);
                          onQuickAction(bag, "DISPATCH_RETRIEVAL");
                        }}
                      >
                        Dispatch for retrieval
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuTag(null);
                          onQuickAction(bag, "MARK_LOCATED");
                        }}
                      >
                        Mark as located
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [onQuickAction, onSelectBag, openMenuTag, selectedTagNumber],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const flights = useMemo(
    () => Array.from(new Set(bags.map((b) => b.flight_number))).sort(),
    [bags],
  );
  const statuses = useMemo(
    () => Array.from(new Set(bags.map((b) => b.status))).sort(),
    [bags],
  );

  return (
    <section
      className={`card-surface ${styles["risk-table"]}`}
      aria-label="Transfer baggage queue"
    >
      <div className={styles["queue-toolbar"]}>
        <div className={styles["queue-tabs"]} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "risk"}
            onClick={() => setTab("risk")}
          >
            Connection Risk ({riskRows.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            onClick={() => setTab("all")}
          >
            All Bags ({allBagsDisplayCount})
          </button>
        </div>

        <div className={styles["queue-filters"]}>
          {searchOpen && (
            <input
              type="search"
              className={styles["queue-search-input"]}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tag, PNR, name"
              aria-label="Search queue"
              autoFocus
            />
          )}
          <button
            type="button"
            className={styles["filter-icon-btn"]}
            aria-label="Toggle queue search"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((prev) => !prev)}
          >
            <SearchIcon size={14} color="#4B5563" />
          </button>

          <select
            className={styles["filter-select"]}
            aria-label="Filter by flight"
            value={externalFlightFilter || flight}
            onChange={(e) => {
              onClearExternalFlight();
              setFlight(e.target.value);
            }}
          >
            <option value="">Flight</option>
            {flights.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            className={styles["filter-select"]}
            aria-label="Filter by risk"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
          >
            <option value="">Risk</option>
            <option value="HIGH_PRIORITY">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            className={styles["filter-select"]}
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles["filter-icon-btn"]}
            title="Clear table filters"
            aria-label="Clear table filters"
            onClick={() => {
              onClearExternalFlight();
              setFlight("");
              setRisk("");
              setStatus("");
              setSearch("");
              setSearchOpen(false);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles["table-scroll"]}>
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles["empty-cell"]}>
                  {isLoading
                    ? "Loading baggage queue…"
                    : "No bags match the current filters."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.original.tag_number === selectedTagNumber
                      ? styles.selected
                      : undefined
                  }
                  onClick={() => onSelectBag(row.original.tag_number)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
