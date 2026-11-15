"use client";

import React, { useMemo, useState } from "react";
import type { OutboundFlightImpactRow } from "../../lib/types";
import { ChevronRightIcon, CloseIcon, SearchIcon, SortArrowIcon } from "../icons/DashboardIcons";
import { HighlightMatch } from "../ui/HighlightMatch";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface OutboundImpactTableProps {
  rows: OutboundFlightImpactRow[];
  definition: string;
  onInspectOutboundFlight?: (outboundLegId: string) => void;
}

type ImpactSortKey =
  | "flightNumber"
  | "transferBags"
  | "highRiskBags"
  | "recoveredBeforeCutoff"
  | "saveRatePct";

function compareNullableNumbers(
  a: number | null,
  b: number | null,
  dir: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

export function OutboundImpactTable({
  rows,
  definition,
  onInspectOutboundFlight,
}: OutboundImpactTableProps) {
  const [sortKey, setSortKey] = useState<ImpactSortKey>("saveRatePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [flightQuery, setFlightQuery] = useState("");

  const hasDuplicateFlights = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.flightNumber)) return true;
      seen.add(r.flightNumber);
    }
    return false;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const q = flightQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          `${r.flightNumber} ${r.route} ${r.operatingDate}`.toLowerCase().includes(q),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "flightNumber":
          cmp =
            sortDir === "asc"
              ? a.flightNumber.localeCompare(b.flightNumber)
              : b.flightNumber.localeCompare(a.flightNumber);
          break;
        case "transferBags":
          cmp = compareNullableNumbers(a.transferBags, b.transferBags, sortDir);
          break;
        case "highRiskBags":
          cmp = compareNullableNumbers(a.highRiskBags, b.highRiskBags, sortDir);
          break;
        case "recoveredBeforeCutoff":
          cmp = compareNullableNumbers(
            a.recoveredBeforeCutoff,
            b.recoveredBeforeCutoff,
            sortDir,
          );
          break;
        case "saveRatePct":
          cmp = compareNullableNumbers(a.saveRatePct, b.saveRatePct, sortDir);
          break;
      }
      if (cmp !== 0) return cmp;
      return (
        (b.highRiskBags ?? -1) - (a.highRiskBags ?? -1) ||
        a.flightNumber.localeCompare(b.flightNumber) ||
        b.operatingDate.localeCompare(a.operatingDate)
      );
    });
  }, [rows, sortKey, sortDir, flightQuery]);

  const toggleSort = (key: ImpactSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "flightNumber" ? "asc" : "desc");
    }
  };

  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.impactCard}`}
      aria-labelledby="outbound-impact-heading"
    >
      <div className={styles.cardHeaderRow}>
        <div>
          <div className={styles.cardTitleWrap}>
            <h2 id="outbound-impact-heading" className={styles.cardTitle}>
              Outbound Flight Impact
            </h2>
            <MetricInfoButton label="Outbound Flight Impact" text={definition} />
          </div>
          <p className={styles.cardSubtitle}>
            Transfer and recovery performance by outbound flight
          </p>
        </div>

        {rows.length > 3 && (
          <div className={styles.impactSearchBox}>
            <span className={styles.impactSearchIcon} aria-hidden="true">
              <SearchIcon size={13} color="#66686A" />
            </span>
            <input
              id="impact-flight-filter"
              name="impact-flight-filter"
              type="search"
              aria-label="Filter outbound impact flights"
              placeholder="Filter flight or route…"
              value={flightQuery}
              onChange={(e) => setFlightQuery(e.target.value)}
            />
            {flightQuery && (
              <button
                type="button"
                className={styles.impactSearchClear}
                aria-label="Clear flight filter"
                onClick={() => setFlightQuery("")}
              >
                <CloseIcon size={11} color="#66686A" />
              </button>
            )}
          </div>
        )}
      </div>

      {sortedRows.length === 0 ? (
        <div className={styles.emptyTableBox}>
          <p className={styles.emptyPlotTitle}>No outbound flight cohort records</p>
          <p className={styles.emptyPlotDesc}>
            Outbound departure impacts appear when station transfer snapshots or historical leg records match the active filter.
          </p>
        </div>
      ) : (
        <div className={styles.impactTableWrap}>
          <table className={styles.impactTable}>
            <colgroup>
              <col className={styles.flightColumn} />
              <col className={styles.routeColumn} />
              <col span={4} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" aria-sort={sortKey === "flightNumber" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className={styles.sortThBtn}
                    onClick={() => toggleSort("flightNumber")}
                  >
                    Flight
                    <SortArrowIcon
                      direction={sortKey === "flightNumber" ? sortDir : "none"}
                    />
                  </button>
                </th>
                <th scope="col">Route</th>
                <th scope="col" className={styles.numCol} aria-sort={sortKey === "transferBags" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className={`${styles.sortThBtn} ${styles.sortThRight}`}
                    onClick={() => toggleSort("transferBags")}
                  >
                    Transfer bags
                    <SortArrowIcon
                      direction={sortKey === "transferBags" ? sortDir : "none"}
                    />
                  </button>
                </th>
                <th scope="col" className={styles.numCol} aria-sort={sortKey === "highRiskBags" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className={`${styles.sortThBtn} ${styles.sortThRight}`}
                    onClick={() => toggleSort("highRiskBags")}
                  >
                    High-risk bags
                    <SortArrowIcon
                      direction={sortKey === "highRiskBags" ? sortDir : "none"}
                    />
                  </button>
                </th>
                <th scope="col" className={styles.numCol} aria-sort={sortKey === "recoveredBeforeCutoff" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className={`${styles.sortThBtn} ${styles.sortThRight}`}
                    onClick={() => toggleSort("recoveredBeforeCutoff")}
                  >
                    Recovered bags
                    <SortArrowIcon
                      direction={
                        sortKey === "recoveredBeforeCutoff" ? sortDir : "none"
                      }
                    />
                  </button>
                </th>
                <th scope="col" className={styles.numCol} aria-sort={sortKey === "saveRatePct" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className={`${styles.sortThBtn} ${styles.sortThRight}`}
                    onClick={() => toggleSort("saveRatePct")}
                  >
                    Save rate
                    <SortArrowIcon
                      direction={sortKey === "saveRatePct" ? sortDir : "none"}
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const interactive = Boolean(
                  row.inActiveSnapshot && onInspectOutboundFlight,
                );
                const savePct =
                  row.saveRatePct !== null
                    ? Math.max(0, Math.min(100, row.saveRatePct))
                    : null;
                return (
                  <tr
                    key={row.legKey}
                    className={interactive ? styles.impactRowInteractive : undefined}
                    onClick={
                      interactive
                        ? () => onInspectOutboundFlight?.(row.outboundLegId)
                        : undefined
                    }
                  >
                    <td>
                      {interactive ? (
                        <button
                          type="button"
                          className={styles.flightDrillBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectOutboundFlight?.(row.outboundLegId);
                          }}
                          title={`Inspect live transfer workbench for ${row.flightNumber} (${row.operatingDate})`}
                        >
                          <span className={styles.flightNumberText}>
                            <HighlightMatch text={row.flightNumber} query={flightQuery} />
                          </span>
                          <ChevronRightIcon size={12} />
                        </button>
                      ) : (
                        <span className={styles.flightNumberText}>
                          <HighlightMatch text={row.flightNumber} query={flightQuery} />
                        </span>
                      )}
                      {hasDuplicateFlights && (
                        <span className={styles.flightDateSub}>
                          {row.operatingDate}
                        </span>
                      )}
                    </td>
                    <td className={styles.routeCell}>
                      <HighlightMatch text={row.route} query={flightQuery} />
                    </td>
                    <td className={styles.numCol}>
                      {row.transferBags !== null
                        ? row.transferBags.toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className={styles.numCol}>
                      {row.highRiskBags !== null
                        ? row.highRiskBags.toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className={styles.numCol}>
                      {row.recoveredBeforeCutoff !== null
                        ? row.recoveredBeforeCutoff.toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td
                      className={`${styles.numCol} ${styles.saveRateCell}`}
                      style={
                        savePct !== null
                          ? {
                              color:
                                savePct >= 85
                                  ? "#163230"
                                  : savePct >= 60
                                    ? "#367878"
                                    : "#886521",
                            }
                          : undefined
                      }
                    >
                      {savePct !== null ? `${savePct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
