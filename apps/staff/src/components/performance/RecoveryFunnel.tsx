"use client";

import React, { useMemo, useState } from "react";
import type { RecoveryFunnelStage, RecoveryStageKey } from "../../lib/types";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface RecoveryFunnelProps {
  stages: RecoveryFunnelStage[];
  note: string | null;
}

const STAGE_TONES = [
  "#002527",
  "#163230",
  "#2C4036",
  "#367878",
  "#6D8C8B",
];

function ChevronBarSegment({
  index,
  fill,
  muted,
  active,
}: {
  index: number;
  fill: string;
  muted: boolean;
  active: boolean;
}) {
  const isFirst = index === 0;
  // Subtle arrow notch interlocking cleanly without raster edges
  const points = isFirst
    ? "0,0 88,0 100,19 88,38 0,38"
    : "0,0 88,0 100,19 88,38 0,38 12,19";

  return (
    <svg
      viewBox="0 0 100 38"
      preserveAspectRatio="none"
      className={`${styles.chevronSvg} ${active ? styles.chevronSvgActive : ""}`}
      aria-hidden="true"
    >
      <polygon
        points={points}
        fill={muted ? "#E6E7E8" : fill}
        opacity={muted ? 0.72 : 1}
      />
    </svg>
  );
}

export function RecoveryFunnel({ stages, note }: RecoveryFunnelProps) {
  const [focusedKey, setFocusedKey] = useState<RecoveryStageKey | null>(null);

  const activeIdx = useMemo(() => {
    if (focusedKey) {
      const idx = stages.findIndex((s) => s.key === focusedKey);
      if (idx >= 0) return idx;
    }
    const firstValid = stages.findIndex((s) => s.count !== null);
    return firstValid >= 0 ? firstValid : 0;
  }, [stages, focusedKey]);

  const activeStage = stages[activeIdx];
  const prevStage = activeIdx > 0 ? stages[activeIdx - 1] : null;
  const hasAnyCount = stages.some((s) => s.count !== null);

  const overallSaveRate = useMemo(() => {
    const first = stages[0]?.count ?? null;
    const last = stages[stages.length - 1]?.count ?? null;
    if (first !== null && last !== null && first > 0) {
      return Math.round((last / first) * 1000) / 10;
    }
    return null;
  }, [stages]);

  const activeDropoff =
    activeStage &&
    prevStage &&
    activeStage.count !== null &&
    prevStage.count !== null
      ? Math.max(0, prevStage.count - activeStage.count)
      : null;

  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.funnelCard}`}
      aria-labelledby="funnel-heading"
    >
      <div className={styles.cardHeaderRow}>
        <div>
          <div className={styles.cardTitleWrap}>
            <h2 id="funnel-heading" className={styles.cardTitle}>
              Recovery Funnel
            </h2>
            <MetricInfoButton
              label="Recovery Funnel"
              text={
                note ??
                "Strict monotonic progression per unique transfer episode (Detected >= Actioned >= Located >= Loaded >= Successfully transferred). Step conversion percentages compare each stage directly against its prior stage."
              }
            />
          </div>
          <p className={styles.cardSubtitle}>
            From risk detection to successful transfer
          </p>
        </div>

        {overallSaveRate !== null && (
          <span className={styles.funnelSummaryBadge}>
            End-to-end save: <strong>{overallSaveRate.toFixed(1)}%</strong>
          </span>
        )}
      </div>

      {/* Desktop / Tablet horizontal progressive chevron flow */}
      <div className={styles.funnelDesktop} role="group" aria-label="Recovery funnel stages">
        <div className={styles.funnelStagesGrid}>
          {stages.map((stage, idx) => {
            const hasCount = stage.count !== null && Number.isFinite(stage.count);
            const active = focusedKey ? focusedKey === stage.key : idx === activeIdx;
            return (
              <button
                key={stage.key}
                type="button"
                className={`${styles.funnelStageBtn} ${
                  active ? styles.funnelStageBtnActive : ""
                }`}
                style={{ animationDelay: `${idx * 55}ms` }}
                onMouseEnter={() => setFocusedKey(stage.key)}
                onFocus={() => setFocusedKey(stage.key)}
                onMouseLeave={(event) => { if (document.activeElement !== event.currentTarget) setFocusedKey(null); }}
                onBlur={() => setFocusedKey(null)}
                onClick={() =>
                  setFocusedKey((prev) =>
                    prev === stage.key ? null : stage.key,
                  )
                }
                aria-label={`${stage.label}: ${
                  hasCount ? stage.count?.toLocaleString("en-GB") : "Unavailable"
                }${
                  stage.stepConversionPct !== null
                    ? `, ${stage.stepConversionPct}% step conversion`
                    : ""
                }`}
              >
                <span className={styles.funnelStepNum} aria-hidden="true">
                  0{idx + 1}
                </span>
                <span className={styles.funnelLabel}>{stage.label}</span>
                <span
                  className={`${styles.funnelCount} ${
                    !hasCount ? styles.funnelCountMuted : ""
                  }`}
                >
                  {hasCount ? (
                    <AnimatedNumber value={stage.count} />
                  ) : (
                    "—"
                  )}
                </span>
                <span className={styles.funnelChevronTrack}>
                  <ChevronBarSegment
                    index={idx}
                    fill={STAGE_TONES[idx % STAGE_TONES.length]}
                    muted={!hasCount}
                    active={active}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* Step conversion % placed cleanly beneath seams between stages */}
        <div className={styles.funnelConversionsRow} aria-label="Stage conversion rates">
          {stages.slice(1).map((stage) => (
            <span key={`conv-${stage.key}`} className={styles.funnelConversionCell}>
              <span className={styles.funnelConvArrow} aria-hidden="true">
                ↳
              </span>{" "}
              {stage.stepConversionPct !== null
                ? `${stage.stepConversionPct.toFixed(1)}%`
                : "—"}
            </span>
          ))}
        </div>
      </div>

      {/* Mobile compact progressive bars (zero label clipping) */}
      <div className={styles.funnelMobile}>
        {stages.map((stage, idx) => {
          const detected = stages[0]?.count ?? null;
          const pctWidth =
            stage.count !== null && detected && detected > 0
              ? Math.max(0, Math.min(100, (stage.count / detected) * 100))
              : 0;
          return (
            <div key={`mob-${stage.key}`} className={styles.funnelMobileRow}>
              <div className={styles.funnelMobileMeta}>
                <span className={styles.funnelMobileName}>{stage.label}</span>
                <span className={styles.funnelMobileNums}>
                  <strong>
                    {stage.count !== null
                      ? stage.count.toLocaleString("en-GB")
                      : "—"}
                  </strong>
                  {stage.stepConversionPct !== null && (
                    <span className={styles.funnelMobileStep}>
                      {" "}
                      · {stage.stepConversionPct.toFixed(1)}% step
                    </span>
                  )}
                </span>
              </div>
              <div className={styles.funnelMobileTrack}>
                <div
                  className={styles.funnelMobileFill}
                  style={{
                    width: `${pctWidth}%`,
                    backgroundColor: STAGE_TONES[idx % STAGE_TONES.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Stage Telemetry Readout Strip */}
      {hasAnyCount && activeStage && (
        <div className={styles.funnelTelemetryGrid} aria-label="Selected stage breakdown">
          <div className={styles.funnelStatBox}>
            <span className={styles.funnelStatLabel}>Stage volume</span>
            <strong className={styles.funnelStatValue}>
              {activeStage.count !== null ? (
                <AnimatedNumber value={activeStage.count} suffix=" bags" />
              ) : (
                "—"
              )}
            </strong>
          </div>
          <div className={styles.funnelStatBox}>
            <span className={styles.funnelStatLabel}>Step conversion</span>
            <strong className={styles.funnelStatValue}>
              {activeIdx === 0
                ? "100.0% entry"
                : activeStage.stepConversionPct !== null
                  ? `${activeStage.stepConversionPct.toFixed(1)}%`
                  : "—"}
            </strong>
          </div>
          <div className={styles.funnelStatBox}>
            <span className={styles.funnelStatLabel}>Cohort retention</span>
            <strong className={styles.funnelStatValue}>
              {activeStage.cumulativePct !== null
                ? `${activeStage.cumulativePct.toFixed(1)}%`
                : "—"}
            </strong>
          </div>
          <div className={styles.funnelStatBox}>
            <span className={styles.funnelStatLabel}>Stage drop-off</span>
            <strong className={styles.funnelStatValue}>
              {activeIdx === 0
                ? "0 bags"
                : activeDropoff !== null
                  ? `${activeDropoff} ${activeDropoff === 1 ? "bag" : "bags"}`
                  : "—"}
            </strong>
          </div>
        </div>
      )}

      {/* Concise non-shifting disclosure strip */}
      <div className={styles.funnelFootnote} aria-live="polite">
        {hasAnyCount && activeStage ? (
          <span>
            <strong>{activeStage.label}:</strong> {activeStage.definition}
            {activeStage.cumulativePct !== null
              ? ` (${activeStage.cumulativePct.toFixed(1)}% of detected cohort)`
              : ""}
          </span>
        ) : (
          <span>
            {note ?? "Stage progression data unavailable for the selected cohort."}
          </span>
        )}
      </div>
    </section>
  );
}
