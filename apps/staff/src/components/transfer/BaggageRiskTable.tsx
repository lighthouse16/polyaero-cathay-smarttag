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
  getLatestEvent,
  isAtRiskBag,
} from "../../lib/utils";

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
  const [tab, setTab] = useState("risk");
  const [search, setSearch] = useState("");
  const [flight, setFlight] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState("");
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

  // Keep inspection aligned to visible results; polling never resets filters, sort, or focus.
  useEffect(() => {
    if (isLoading) return;
    if (!data.some((b) => b.tag_number === selectedTagNumber))
      onSelectBag(data[0]?.tag_number ?? "");
  }, [data, selectedTagNumber, onSelectBag, isLoading]);

  const columns = useMemo<ColumnDef<LiveBag>[]>(
    () => [
      {
        id: "selection",
        header: "Select",
        enableSorting: false,
        cell: ({ row }) => (
          <input
            type="radio"
            name="selected-bag"
            aria-label={`Inspect ${row.original.tag_number}`}
            checked={row.original.tag_number === selectedTagNumber}
            onChange={() => onSelectBag(row.original.tag_number)}
          />
        ),
      },
      {
        accessorKey: "tag_number",
        header: "Bag Tag",
        cell: ({ row }) => (
          <button
            className={styles["tag-link"]}
            onClick={() => onSelectBag(row.original.tag_number)}
          >
            {row.original.tag_number}
          </button>
        ),
      },
      { accessorKey: "passenger_name", header: "Passenger" },
      {
        accessorKey: "flight_number",
        header: "Flight / route",
        cell: ({ row }) =>
          `${row.original.flight_number} · ${row.original.departure_airport} → ${row.original.arrival_airport}`,
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
        header: "Risk",
        cell: ({ row }) => (
          <span
            className={`${styles["risk-score"]} ${row.original.risk_level === "HIGH_PRIORITY" ? styles.critical : ""}`}
          >
            {row.original.risk_score}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className={styles["status-label"]}>
            {formatStatusLabel(row.original.status)}
          </span>
        ),
      },
      {
        id: "latest",
        accessorFn: (b) => Date.parse(getLatestEvent(b)?.timestamp ?? "") || 0,
        header: "Last event · HKT",
        cell: ({ row }) => formatLastEventSummary(row.original),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={() =>
              onQuickAction?.(row.original, "RECOVERY_IN_PROGRESS")
            }
            aria-label={`Record recovery for ${row.original.tag_number}`}
          >
            Record recovery
          </button>
        ),
      },
    ],
    [selectedTagNumber, onSelectBag, onQuickAction],
  );
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (b) => b.tag_number,
  });

  return (
    <section
      className={`card-surface ${styles["risk-table"]}`}
      aria-label="Baggage connection risk queue"
    >
      <div className={styles["queue-toolbar"]}>
        <div className={styles["queue-tabs"]} aria-label="Baggage queue scope">
          <button aria-pressed={tab === "risk"} onClick={() => setTab("risk")}>
            Connection Risk ({riskRows.length})
          </button>
          <button aria-pressed={tab === "all"} onClick={() => setTab("all")}>
            All Bags ({filtered.length})
          </button>
        </div>
        <div className={styles["queue-filters"]}>
          <input
            aria-label="Search baggage table"
            type="search"
            placeholder="Tag, PNR, passenger…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter by flight"
            value={externalFlightFilter || flight}
            onChange={(e) => {
              onClearExternalFlight();
              setFlight(e.target.value);
            }}
          >
            <option value="">Flight</option>
            {[...new Set(bags.map((b) => b.flight_number))].sort().map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
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
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Status</option>
            {[...new Set(bags.map((b) => b.status))].sort().map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch("");
              setFlight("");
              setRisk("");
              setStatus("");
              onClearExternalFlight();
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
      <div
        className={styles["table-scroll"]}
        tabIndex={0}
        role="region"
        aria-label="Scrollable baggage table"
      >
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}{" "}
                        {header.column.getIsSorted() === "asc"
                          ? "↑"
                          : header.column.getIsSorted() === "desc"
                            ? "↓"
                            : "↕"}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9}>Loading baggage records…</td>
              </tr>
            ) : !data.length ? (
              <tr>
                <td colSpan={9}>No baggage matches current filters.</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.id === selectedTagNumber ? styles.selected : ""
                  }
                  onClick={(e) => {
                    if (
                      !(e.target as HTMLElement).closest("button,input,select")
                    )
                      onSelectBag(row.id);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      title={
                        typeof cell.getValue() === "string"
                          ? String(cell.getValue())
                          : undefined
                      }
                    >
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
