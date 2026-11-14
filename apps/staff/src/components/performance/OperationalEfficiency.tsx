"use client";

import React from "react";
import type { OperationalEfficiencySummary } from "../../lib/types";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import {
  CheckCircleIcon,
  MapPinIcon,
  ZapIcon,
} from "../icons/DashboardIcons";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface OperationalEfficiencyProps {
  efficiency: OperationalEfficiencySummary;
}

export function OperationalEfficiency({
  efficiency,
}: OperationalEfficiencyProps) {
  const hasActionMedian = efficiency.medianAlertToActionMin !== null;
  const hasLocateMedian = efficiency.medianActionToLocateMin !== null;
  const hasCutoff =
    efficiency.resolvedBeforeCutoffCount !== null &&
    efficiency.resolvedBeforeCutoffPct !== null;

  const cutoffBarPct = hasCutoff
    ? Math.max(0, Math.min(100, Math.round(efficiency.resolvedBeforeCutoffPct!)))
    : 0;

  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.efficiencyCard}`}
      aria-labelledby="efficiency-heading"
    >
      <div className={styles.cardHeaderRow}>
        <div className={styles.cardTitleWrap}>
          <h2 id="efficiency-heading" className={styles.cardTitle}>
            Operational Efficiency
          </h2>
          <MetricInfoButton
            label="Operational Efficiency"
            text="Medians are calculated exclusively over chronologically valid scan pairs (alert -> action, action -> locate) with exact sample count n shown. Cutoff rate excludes unresolved pending cases."
          />
        </div>
      </div>

      <div className={styles.efficiencyList}>
        <div className={styles.efficiencyRow}>
          <div className={styles.efficiencyTopLine}>
            <div className={styles.efficiencyLabelGroup}>
              <span className={styles.efficiencyIconFrame} aria-hidden="true">
                <ZapIcon size={15} />
              </span>
              <div>
                <span className={styles.efficiencyLabel}>Median time to act</span>
                {efficiency.alertToActionSampleSize > 0 && (
                  <span className={styles.efficiencySample}>
                    alert → action · n = {efficiency.alertToActionSampleSize}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.efficiencyMetric}>
              {hasActionMedian ? (
                <span className={styles.efficiencyValue}>
                  <AnimatedNumber
                    value={efficiency.medianAlertToActionMin}
                    decimals={1}
                    suffix=" min"
                  />
                </span>
              ) : (
                <span className={`${styles.efficiencyValue} ${styles.kpiValueMuted}`}>
                  —
                </span>
              )}
            </div>
          </div>

        </div>

        <div className={styles.efficiencyRow}>
          <div className={styles.efficiencyTopLine}>
            <div className={styles.efficiencyLabelGroup}>
              <span className={styles.efficiencyIconFrame} aria-hidden="true">
                <MapPinIcon size={15} />
              </span>
              <div>
                <span className={styles.efficiencyLabel}>Median time to locate</span>
                {efficiency.actionToLocateSampleSize > 0 && (
                  <span className={styles.efficiencySample}>
                    action → locate · n = {efficiency.actionToLocateSampleSize}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.efficiencyMetric}>
              {hasLocateMedian ? (
                <span className={styles.efficiencyValue}>
                  <AnimatedNumber
                    value={efficiency.medianActionToLocateMin}
                    decimals={1}
                    suffix=" min"
                  />
                </span>
              ) : (
                <span className={`${styles.efficiencyValue} ${styles.kpiValueMuted}`}>
                  —
                </span>
              )}
            </div>
          </div>

        </div>

        <div className={styles.efficiencyRow}>
          <div className={styles.efficiencyTopLine}>
            <div className={styles.efficiencyLabelGroup}>
              <span className={styles.efficiencyIconFrame} aria-hidden="true">
                <CheckCircleIcon size={15} />
              </span>
              <div>
                <span className={styles.efficiencyLabel}>
                  Cases resolved before cutoff
                </span>
                {efficiency.resolvedBeforeCutoffDenominator !== null && (
                  <span className={styles.efficiencySample}>
                    {efficiency.resolvedBeforeCutoffCount} /{" "}
                    {efficiency.resolvedBeforeCutoffDenominator} resolved
                    {efficiency.pendingExcludedCount > 0
                      ? ` · ${efficiency.pendingExcludedCount} pending`
                      : ""}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.efficiencyMetric}>
              {hasCutoff ? (
                <span className={styles.efficiencyValue}>
                  <AnimatedNumber value={efficiency.resolvedBeforeCutoffCount} />
                  <span className={styles.efficiencyPctSub}>
                    {" "}
                    ({efficiency.resolvedBeforeCutoffPct?.toFixed(1)}%)
                  </span>
                </span>
              ) : (
                <span className={`${styles.efficiencyValue} ${styles.kpiValueMuted}`}>
                  —
                </span>
              )}
            </div>
          </div>
          {hasCutoff && (
            <div className={styles.efficiencyMeterTrack} aria-hidden="true">
              <div
                className={styles.efficiencyMeterFill}
                style={{ width: `${cutoffBarPct}%`, backgroundColor: "#367878" }}
              />
            </div>
          )}
        </div>
      </div>

      {efficiency.availabilityNote && (
        <p className={styles.cardMicroNote}>{efficiency.availabilityNote}</p>
      )}
    </section>
  );
}
