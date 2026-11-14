"use client";

import React, { useRef } from "react";
import type {
  OutboundFlightOption,
  PerformanceFilterState,
  PerformanceWindow,
  RecoveryPerformanceReport,
} from "../../lib/types";
import {
  ChevronDownIcon,
  CloseIcon,
  MapPinIcon,
  PlaneIcon,
  RefreshIcon,
} from "../icons/DashboardIcons";
import { useSlidingIndicator } from "../ui/useSlidingIndicator";
import styles from "./PerformanceView.module.css";

interface PerformanceFilterBarProps {
  filters: PerformanceFilterState;
  onChangeFilters: (next: PerformanceFilterState) => void;
  report: RecoveryPerformanceReport;
  outboundOptions: OutboundFlightOption[];
  loading: boolean;
  onRefresh: () => void;
}

const SHORT_WINDOW_LABELS: Record<PerformanceWindow, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
};

export function PerformanceFilterBar({
  filters,
  onChangeFilters,
  report,
  outboundOptions,
  loading,
  onRefresh,
}: PerformanceFilterBarProps) {
  const segRef = useRef<HTMLDivElement>(null);
  const indicator = useSlidingIndicator(
    filters.window,
    segRef,
    `.${styles.windowSegBtn}`,
  );

  const selectedFlightOpt = outboundOptions.find(
    (opt) => opt.outboundLegId === filters.outboundLegId,
  );

  return (
    <header className={styles.filterHeader}>
      <div
        className={styles.controlsCluster}
        role="group"
        aria-label="Performance filters"
      >
        <div
          ref={segRef}
          className={styles.windowSegmented}
          data-indicator-ready={indicator.ready ? "true" : undefined}
          role="group"
          aria-label="Quick reporting window"
        >
          {report.supportedWindows.map((win) => {
            const active = filters.window === win;
            return (
              <button
                key={`seg-${win}`}
                type="button"
                data-tab-key={win}
                aria-pressed={active}
                className={`${styles.windowSegBtn} ${
                  active ? styles.windowSegBtnActive : ""
                }`}
                onClick={() =>
                  onChangeFilters({
                    ...filters,
                    window: win,
                  })
                }
              >
                {SHORT_WINDOW_LABELS[win]}
              </button>
            );
          })}
          {indicator.ready && (
            <span
              aria-hidden="true"
              className={styles.windowSegThumb}
              style={{
                width: `${indicator.width}px`,
                transform: `translate3d(${indicator.left}px, 0, 0)`,
              }}
            />
          )}
        </div>

        <div className={styles.selectPill}>
          <span className={styles.selectLeadingIcon}>
            <MapPinIcon size={15} />
          </span>
          <select
            id="performance-station-select"
            name="performance-station"
            aria-label="Station"
            className={styles.selectControl}
            value={filters.station}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                station: e.target.value,
                outboundLegId: "all",
              })
            }
          >
            {report.supportedStations.map((stn) => (
              <option key={stn} value={stn}>
                {stn}
              </option>
            ))}
          </select>
          <span className={styles.selectTrailingChevron}>
            <ChevronDownIcon size={14} />
          </span>
        </div>

        <div className={`${styles.selectPill} ${styles.selectFlightPill}`}>
          <span className={styles.selectLeadingIcon}>
            <PlaneIcon size={15} />
          </span>
          <select
            id="performance-flight-select"
            name="performance-flight"
            aria-label="Outbound flight cohort"
            className={styles.selectControl}
            value={filters.outboundLegId}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                outboundLegId: e.target.value,
              })
            }
          >
            <option value="all">All outbound flights</option>
            {outboundOptions.map((opt) => (
              <option key={opt.legKey} value={opt.outboundLegId}>
                {opt.flightNumber} · {opt.route} ({opt.operatingDate})
              </option>
            ))}
          </select>
          <span className={styles.selectTrailingChevron}>
            <ChevronDownIcon size={14} />
          </span>
        </div>

        {filters.outboundLegId !== "all" && (
          <button
            type="button"
            className={styles.clearCohortBtn}
            onClick={() =>
              onChangeFilters({
                ...filters,
                outboundLegId: "all",
              })
            }
            aria-label={`Clear flight filter (${selectedFlightOpt?.flightNumber ?? filters.outboundLegId})`}
          >
            <span>{selectedFlightOpt?.flightNumber ?? "Filtered"}</span>
            <CloseIcon size={11} color="currentColor" />
          </button>
        )}

        <button
          type="button"
          className={`refresh-btn ${styles.refreshPill}`}
          onClick={onRefresh}
          aria-busy={loading}
          disabled={loading}
          aria-label="Refresh performance metrics"
        >
          <RefreshIcon size={14} className={loading ? styles.refreshingIcon : ""} />
          {loading ? "Updating…" : "Refresh"}
        </button>
      </div>

      {report.statusNote && (
        <div className={styles.cohortMetaStrip}>
          <span className={styles.metaNote}>{report.statusNote}</span>
        </div>
      )}
    </header>
  );
}
