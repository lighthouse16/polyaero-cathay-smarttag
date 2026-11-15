"use client";

import React, { useRef, useState } from "react";
import type { RecoveryTrendBucket } from "../../lib/types";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface RecoveryTrendChartProps {
  buckets: RecoveryTrendBucket[];
  note: string | null;
}

function niceAxisCeiling(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 100;
  if (maxValue <= 4) return 4;
  if (maxValue <= 8) return 8;
  const rawStep = maxValue / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return Math.max(4, Math.ceil(maxValue / (niceNorm * mag)) * (niceNorm * mag));
}

function topRoundedBarPath(x: number, y: number, w: number, h: number, r: number): string {
  if (w <= 0 || h <= 0) return "";
  const cr = Math.max(0, Math.min(r, w / 2, h));
  if (cr <= 0.1) return `M${x},${y} h${w} v${h} h-${w} Z`;
  return [
    `M${x},${y + h}`,
    `V${y + cr}`,
    `Q${x},${y} ${x + cr},${y}`,
    `H${x + w - cr}`,
    `Q${x + w},${y} ${x + w},${y + cr}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

export function RecoveryTrendChart({ buckets, note }: RecoveryTrendChartProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const slotRefs = useRef<Array<SVGGElement | null>>([]);

  function inspectPeriod(event: React.KeyboardEvent<SVGGElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = Math.min(index + 1, buckets.length - 1);
    else if (event.key === "ArrowLeft") next = Math.max(index - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buckets.length - 1;
    else if (event.key === "Escape") { event.currentTarget.blur(); return; }
    else return;
    event.preventDefault();
    slotRefs.current[next]?.focus();
  }

  const hasBuckets = buckets.length > 0;
  const maxBar = buckets.reduce(
    (m, b) => Math.max(m, b.detectedCount ?? 0, b.recoveredCount ?? 0),
    0,
  );
  // Reserve top 25% of plot for line series so bars never collide with rate dots.
  const countCeiling = niceAxisCeiling(maxBar * 1.25);
  const countTicks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    Math.round(countCeiling * t),
  );

  const validRates = buckets
    .map((b) => b.successRatePct)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const minRateData = validRates.length > 0 ? Math.min(...validRates) : 80;
  const pctFloor = minRateData < 80 ? 0 : 80;
  const pctTicks =
    pctFloor === 80 ? [80, 85, 90, 95, 100] : [0, 25, 50, 75, 100];

  const width = 660;
  const height = 228;
  const pad = { top: 18, right: 44, bottom: 32, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const yCount = (val: number) =>
    pad.top + plotH - (Math.max(0, val) / countCeiling) * plotH;
  const yPct = (val: number) => {
    const clamped = Math.min(100, Math.max(pctFloor, val));
    return pad.top + plotH - ((clamped - pctFloor) / (100 - pctFloor)) * plotH;
  };

  // Build contiguous line segments (never interpolate across missing rate points)
  const linePaths: string[] = [];
  let currentPts: Array<{ x: number; y: number }> = [];
  const slotW = hasBuckets ? plotW / Math.max(buckets.length, 1) : plotW;
  const barGap = slotW >= 36 ? 2 : 1;
  const barW = Math.min(22, Math.max(7, slotW * 0.25));

  buckets.forEach((b, idx) => {
    const cx = pad.left + slotW * (idx + 0.5);
    if (b.successRatePct !== null && Number.isFinite(b.successRatePct)) {
      const cy = yPct(b.successRatePct);
      currentPts.push({ x: cx, y: cy });
    } else if (currentPts.length > 0) {
      linePaths.push(
        currentPts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" "),
      );
      currentPts = [];
    }
  });
  if (currentPts.length > 0) {
    linePaths.push(
      currentPts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" "),
    );
  }

  const activeBucket =
    hoveredIdx !== null && buckets[hoveredIdx] ? buckets[hoveredIdx] : null;

  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.trendCard}`}
      aria-labelledby="trend-heading"
    >
      <div className={styles.trendHeaderRow}>
        <div className={styles.cardTitleWrap}>
          <h2 id="trend-heading" className={styles.cardTitle}>
            Recovery Performance Over Time
          </h2>
          <MetricInfoButton
            label="Recovery Performance Over Time"
            text="Grouped bars show deduplicated detected high-risk bags and bags recovered before loading cutoff in Asia/Hong_Kong buckets. Line overlay tracks confirmed station transfer success % when eligible transfer denominators are available (gaps remain broken, never interpolated)."
          />
        </div>

        <div className={styles.trendHeaderActions}>
          <div className={styles.trendLegend} aria-label="Chart series legend">
            <span className={styles.legendItem}>
              <span
                className={styles.legendSwatchBar}
                style={{ backgroundColor: "#002527" }}
                aria-hidden="true"
              />
              Detected high-risk bags
            </span>
            <span className={styles.legendItem}>
              <span
                className={styles.legendSwatchBar}
                style={{ backgroundColor: "#6D8C8B" }}
                aria-hidden="true"
              />
              Recovered bags
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatchLine} aria-hidden="true" />
              Transfer success rate
            </span>
          </div>

          {hasBuckets && (
            <div className={styles.modeToggle} role="group" aria-label="Display mode">
              <button
                type="button"
                className={`${styles.modeBtn} ${
                  viewMode === "chart" ? styles.modeBtnActive : ""
                }`}
                onClick={() => setViewMode("chart")}
                aria-pressed={viewMode === "chart"}
              >
                Chart
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${
                  viewMode === "table" ? styles.modeBtnActive : ""
                }`}
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
              >
                Table
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === "table" && hasBuckets ? (
        <div className={styles.trendTableWrap}>
          <table className={styles.compactTable}>
            <thead>
              <tr>
                <th>Bucket (HKT)</th>
                <th className={styles.numCol}>Detected high-risk</th>
                <th className={styles.numCol}>Recovered</th>
                <th className={styles.numCol}>Transfer success %</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.bucketKey}>
                  <td>{b.rangeLabel}</td>
                  <td className={styles.numCol}>
                    {b.detectedCount !== null ? b.detectedCount.toLocaleString("en-GB") : "—"}
                  </td>
                  <td className={styles.numCol}>
                    {b.recoveredCount !== null ? b.recoveredCount.toLocaleString("en-GB") : "—"}
                  </td>
                  <td className={styles.numCol}>
                    {b.successRatePct !== null ? `${b.successRatePct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.trendPlotWrap}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className={styles.trendSvg}
            role={hasBuckets ? "group" : "img"}
            aria-label={
              hasBuckets
                ? "Inspect reporting periods"
                : "Unavailable recovery performance time series chart"
            }
          >
            {/* Horizontal gridlines + Y axes */}
            {countTicks.map((tick, idx) => {
              const y = pad.top + plotH - (idx / 4) * plotH;
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={width - pad.right}
                    y2={y}
                    stroke="#EAECEC"
                    strokeWidth="1"
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className={styles.axisTick}
                  >
                    {hasBuckets ? tick : ""}
                  </text>
                  <text
                    x={width - pad.right + 8}
                    y={y + 4}
                    textAnchor="start"
                    className={styles.axisTick}
                  >
                    {`${pctTicks[idx]}%`}
                  </text>
                </g>
              );
            })}

            {/* Data series */}
            {hasBuckets &&
              buckets.map((b, idx) => {
                const cx = pad.left + slotW * (idx + 0.5);
                const detH =
                  b.detectedCount !== null
                    ? pad.top + plotH - yCount(b.detectedCount)
                    : 0;
                const recH =
                  b.recoveredCount !== null
                    ? pad.top + plotH - yCount(b.recoveredCount)
                    : 0;
                const showTick =
                  buckets.length <= 10 ||
                  idx % Math.ceil(buckets.length / 8) === 0 ||
                  idx === buckets.length - 1;
                const active = hoveredIdx === idx;

                return (
                  <g
                    key={b.bucketKey}
                    className={styles.trendSlot}
                    ref={(element) => { slotRefs.current[idx] = element; }}
                    tabIndex={hoveredIdx === idx || (hoveredIdx === null && idx === 0) ? 0 : -1}
                    role="group"
                    onKeyDown={(event) => inspectPeriod(event, idx)}
                    onClick={() => setHoveredIdx(idx)}
                    aria-label={`${b.rangeLabel}: ${
                      b.detectedCount ?? "—"
                    } detected, ${b.recoveredCount ?? "—"} recovered, ${
                      b.successRatePct !== null
                        ? `${b.successRatePct.toFixed(1)}% success rate`
                        : "rate unavailable"
                    }`}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onFocus={() => setHoveredIdx(idx)}
                    onMouseLeave={(event) => {
                      if (!event.currentTarget.contains(document.activeElement)) setHoveredIdx(null);
                    }}
                    onBlur={() => setHoveredIdx(null)}
                  >
                    <rect
                      x={pad.left + slotW * idx}
                      y={pad.top}
                      width={slotW}
                      height={plotH}
                      fill={active ? "#F2F3F3" : "transparent"}
                      stroke={active ? "#BCBEC0" : "transparent"}
                      strokeDasharray="3 3"
                    />
                    {b.detectedCount !== null && detH > 0 && (
                      <path
                        d={topRoundedBarPath(cx - barW - barGap, yCount(b.detectedCount), barW, detH, 3)}
                        fill="#002527"
                        className={styles.barRectAnimated}
                        style={{ animationDelay: `${idx * 35}ms` }}
                      />
                    )}
                    {b.recoveredCount !== null && recH > 0 && (
                      <path
                        d={topRoundedBarPath(cx + barGap, yCount(b.recoveredCount), barW, recH, 3)}
                        fill="#6D8C8B"
                        className={styles.barRectAnimated}
                        style={{ animationDelay: `${idx * 35 + 45}ms` }}
                      />
                    )}
                    {showTick && (
                      <text
                        x={cx}
                        y={height - 8}
                        textAnchor="middle"
                        className={styles.axisTick}
                      >
                        {b.label}
                      </text>
                    )}
                  </g>
                );
              })}

            {hasBuckets &&
              linePaths.map((d, i) => (
                <g key={`line-${i}`} pointerEvents="none">
                  <path
                    d={d}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity="0.92"
                    className={styles.linePathAnimated}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="#367878"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.linePathAnimated}
                  />
                </g>
              ))}

            {hasBuckets &&
              buckets.map((b, idx) => {
                if (
                  b.successRatePct === null ||
                  !Number.isFinite(b.successRatePct)
                ) {
                  return null;
                }
                const cx = pad.left + slotW * (idx + 0.5);
                const cy = yPct(b.successRatePct);
                const active = hoveredIdx === idx;
                return (
                  <g key={`pt-${b.bucketKey}`} pointerEvents="none">
                    {active && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill="rgb(54 120 120 / 16%)"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={active ? 4.75 : 3.75}
                      fill="#367878"
                      stroke="#FFFFFF"
                      strokeWidth="1.8"
                    />
                  </g>
                );
              })}
          </svg>

          {hasBuckets && (
            <div className={styles.chartTooltip} role="status" aria-live="polite" aria-atomic="true">
              {activeBucket ? (
                <>
                  <strong className={styles.tooltipPeriod}>{activeBucket.rangeLabel}</strong>
                  <div className={styles.tooltipMetrics}>
                    <span className={styles.tooltipMetricChip}>
                      <span
                        className={styles.legendSwatchBar}
                        style={{ backgroundColor: "#002527" }}
                        aria-hidden="true"
                      />
                      Detected: <strong>{activeBucket.detectedCount ?? "—"}</strong>
                    </span>
                    <span className={styles.tooltipMetricChip}>
                      <span
                        className={styles.legendSwatchBar}
                        style={{ backgroundColor: "#6D8C8B" }}
                        aria-hidden="true"
                      />
                      Recovered: <strong>{activeBucket.recoveredCount ?? "—"}</strong>
                    </span>
                    <span className={styles.tooltipMetricChip}>
                      <span className={styles.legendSwatchLine} aria-hidden="true" />
                      Transfer success:{" "}
                      <strong>
                        {activeBucket.successRatePct !== null
                          ? `${activeBucket.successRatePct.toFixed(1)}%`
                          : "—"}
                      </strong>
                      {activeBucket.successfulTransferCount !== null &&
                        activeBucket.eligibleTransferCount !== null && (
                          <span className={styles.tooltipSubCount}>
                            ({activeBucket.successfulTransferCount}/{activeBucket.eligibleTransferCount})
                          </span>
                        )}
                    </span>
                  </div>
                </>
              ) : (
                <span>
                  {buckets.length} reporting {buckets.length === 1 ? "period" : "periods"} in HKT · Hover to inspect · Use arrow keys when chart is focused
                </span>
              )}
            </div>
          )}

          {!hasBuckets && (
            <div className={styles.emptyPlotOverlay}>
              <p className={styles.emptyPlotTitle}>
                Historical time-series unavailable
              </p>
              <p className={styles.emptyPlotDesc}>
                {note ??
                  "Multi-day bucket counts and trend rates are omitted until historical warehouse logs connect."}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
