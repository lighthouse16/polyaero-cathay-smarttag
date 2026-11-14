"use client";

import React, { useState } from "react";
import type { RiskCauseBreakdownSummary } from "../../lib/types";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface RiskCauseBreakdownProps {
  summary: RiskCauseBreakdownSummary;
}

const SLICE_TONES = [
  "#002527",
  "#163230",
  "#2C4036",
  "#367878",
  "#6D8C8B",
  "#646C6A",
];

export function RiskCauseBreakdown({ summary }: RiskCauseBreakdownProps) {
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const isDonut =
    summary.mode === "primary_exclusive" && summary.items.length > 0;
  const isMentions =
    summary.mode === "multi_factor_mentions" && summary.items.length > 0;

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const totalPct = summary.items.reduce((acc, s) => acc + (s.sharePct ?? 0), 0);

  let cumulativeOffset = 0;
  const arcs = isDonut
    ? summary.items.map((slice, idx) => {
        const fraction =
          totalPct > 0 && slice.sharePct !== null
            ? slice.sharePct / totalPct
            : 0;
        const arcLen = fraction * circumference;
        const dashOffset = -cumulativeOffset;
        cumulativeOffset += arcLen;
        return {
          ...slice,
          color: SLICE_TONES[idx % SLICE_TONES.length],
          dashArray: `${Math.max(0, arcLen - 1.5)} ${circumference}`,
          dashOffset,
        };
      })
    : [];

  const activeSlice = summary.items.find((s) => s.category === hoveredCat) ?? null;

  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.causeCard}`}
      aria-labelledby="risk-cause-heading"
    >
      <div className={styles.cardHeaderRow}>
        <div className={styles.cardTitleWrap}>
          <h2 id="risk-cause-heading" className={styles.cardTitle}>
            Risk-Cause Breakdown
          </h2>
          <MetricInfoButton
            label="Risk-Cause Breakdown"
            text={
              summary.mode === "multi_factor_mentions"
                ? "Counts reflect all contributing risk factors tagged per bag. Because a bag may trigger multiple factors, shares do not sum to 100%."
                : "Primary operational cause attributed per deduplicated high-risk episode (mutually exclusive shares summing to 100%)."
            }
          />
        </div>
      </div>

      {isDonut ? (
        <div className={styles.causeBody}>
          <div className={styles.donutWrap}>
            <svg viewBox="0 0 156 156" className={styles.donutSvg} aria-hidden="true">
              <circle
                cx="78"
                cy="78"
                r={radius}
                fill="none"
                stroke="#EAECEC"
                strokeWidth="16"
              />
              <g transform="rotate(-90 78 78)">
                {arcs.map((arc) => {
                  const focused = hoveredCat === arc.category;
                  return (
                    <circle
                      key={arc.category}
                      cx="78"
                      cy="78"
                      r={radius}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={focused ? 18 : 16}
                      strokeDasharray={arc.dashArray}
                      strokeDashoffset={arc.dashOffset}
                      className={styles.donutArc}
                      onMouseEnter={() => setHoveredCat(arc.category)}
                      onMouseLeave={() => setHoveredCat(null)}
                    />
                  );
                })}
              </g>
            </svg>
            <div className={styles.donutCenter}>
              <span className={styles.donutCenterNum}>
                {activeSlice ? (
                  <AnimatedNumber value={activeSlice.count} />
                ) : (
                  <AnimatedNumber value={summary.totalCases} />
                )}
              </span>
              <span className={styles.donutCenterSub}>
                {activeSlice ? activeSlice.category : "High-risk bags"}
              </span>
            </div>
          </div>

          <ul className={styles.causeLegend}>
            {arcs.map((item) => {
              const isSelected = hoveredCat === item.category;
              const pct = item.sharePct !== null ? Math.max(0, Math.min(100, item.sharePct)) : 0;
              return (
                <li key={item.category}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className={`${styles.causeLegendRow} ${
                    isSelected ? styles.causeLegendActive : ""
                  }`}
                  onMouseEnter={() => setHoveredCat(item.category)}
                  onMouseLeave={() => setHoveredCat(null)}
                  onFocus={() => setHoveredCat(item.category)}
                  onBlur={() => setHoveredCat(null)}
                  onClick={() =>
                    setHoveredCat((prev) =>
                      prev === item.category ? null : item.category,
                    )
                  }
                >
                  <span className={styles.causeLegendMain}>
                    <span className={styles.causeLabelGroup}>
                      <span
                        className={styles.causeDot}
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.causeName}>{item.category}</span>
                    </span>
                    <span className={styles.causeStatsWrap}>
                      <span className={styles.causeCountSub}>{item.count}</span>
                      <span className={styles.causePct}>
                        {item.sharePct !== null ? `${Math.round(item.sharePct)}%` : "—"}
                      </span>
                    </span>
                  </span>
                  <span className={styles.causeBarTrack} aria-hidden="true">
                    <span
                      className={styles.causeBarFill}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </span>
                </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : isMentions ? (
        <div className={styles.mentionsList}>
          {summary.items.slice(0, 5).map((item, idx) => (
            <div key={item.category} className={styles.mentionRow}>
              <div className={styles.mentionTop}>
                <span>{item.category}</span>
                <span className={styles.mentionStat}>
                  {item.count} bags (
                  {item.sharePct !== null ? `${item.sharePct.toFixed(1)}%` : "—"})
                </span>
              </div>
              <div className={styles.mentionTrack}>
                <div
                  className={styles.mentionFill}
                  style={{
                    width: `${Math.min(100, item.sharePct ?? 0)}%`,
                    backgroundColor: SLICE_TONES[idx % SLICE_TONES.length],
                  }}
                />
              </div>
            </div>
          ))}
          {summary.availabilityNote && (
            <p className={styles.cardMicroNote}>{summary.availabilityNote}</p>
          )}
        </div>
      ) : (
        <div className={styles.causeUnavailable}>
          <div className={styles.emptyDonutRing} aria-hidden="true">
            <span className={styles.donutCenterNumMuted}>—</span>
          </div>
          <p className={styles.emptyPlotDesc}>
            {summary.availabilityNote ??
              "Primary risk-cause breakdown unavailable for this cohort."}
          </p>
        </div>
      )}
    </section>
  );
}
