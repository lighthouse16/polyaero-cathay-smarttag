"use client";

import React from "react";
import type { MetricComparison, PerformanceKpiMetric } from "../../lib/types";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import {
  ActionDispatchIcon,
  CheckCircleIcon,
  LuggageIcon,
  TrendChartIcon,
} from "../icons/DashboardIcons";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface PerformanceKpiGridProps {
  kpis: PerformanceKpiMetric[];
  loading: boolean;
}

function KpiIcon({ id }: { id: PerformanceKpiMetric["id"] }) {
  switch (id) {
    case "highRisk":
      return <TrendChartIcon size={23} />;
    case "actioned":
      return <ActionDispatchIcon size={23} />;
    case "recoveredBeforeCutoff":
      return <CheckCircleIcon size={23} />;
    case "transferSuccess":
      return <LuggageIcon size={23} />;
  }
}

function formatComparison(comp: MetricComparison): {
  text: string;
  tone: "positive" | "negative" | "neutral";
} {
  const arrow = comp.direction === "up" ? "▲" : comp.direction === "down" ? "▼" : "•";
  const sign = comp.delta > 0 ? "+" : "";
  const unitSuffix =
    comp.unit === "percent"
      ? "%"
      : comp.unit === "pp"
        ? " pp"
        : comp.unit === "minutes"
          ? " min"
          : "";
  const text = `${arrow} ${sign}${comp.delta.toFixed(comp.unit === "count" ? 0 : 1)}${unitSuffix}`;
  const good =
    (comp.direction === "up" && comp.polarity === "positive_good") ||
    (comp.direction === "down" && comp.polarity === "negative_good");
  const bad =
    (comp.direction === "up" && comp.polarity === "negative_good") ||
    (comp.direction === "down" && comp.polarity === "positive_good");
  return {
    text,
    tone: good ? "positive" : bad ? "negative" : "neutral",
  };
}

export function PerformanceKpiGrid({ kpis, loading }: PerformanceKpiGridProps) {
  return (
    <section className={styles.kpiRow} aria-label="Key recovery metrics" aria-busy={loading}>
      {kpis.map((kpi) => {
        const hasValue = kpi.value !== null && Number.isFinite(kpi.value);
        const comp = kpi.comparison ? formatComparison(kpi.comparison) : null;
        const tooltipText = [kpi.definition, kpi.exclusionNote, kpi.availabilityNote]
          .filter(Boolean)
          .join(" ");

        const meterPct =
          hasValue && kpi.unit === "percent"
            ? Math.max(0, Math.min(100, kpi.value!))
            : hasValue &&
                kpi.numerator !== null &&
                kpi.denominator !== null &&
                kpi.denominator > 0
              ? Math.max(0, Math.min(100, (kpi.numerator / kpi.denominator) * 100))
              : null;

        return (
          <article
            key={kpi.id}
            className={`card-surface ${styles.kpiCard}`}
            data-kpi-id={kpi.id}
          >
            <div className={styles.kpiIconFrame} aria-hidden="true">
              <KpiIcon id={kpi.id} />
            </div>

            <div className={styles.kpiBody}>
              <div className={styles.kpiLabelRow}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <MetricInfoButton label={kpi.label} text={tooltipText} />
              </div>

              <div className={styles.kpiValueRow}>
                {loading && !hasValue ? (
                  <span className={styles.kpiSkeleton} aria-label="Loading" />
                ) : hasValue ? (
                  <span className={styles.kpiValue}>
                    <span className="sr-only">
                      {kpi.value?.toLocaleString("en-GB", {
                        minimumFractionDigits: kpi.decimals ?? (kpi.unit === "percent" ? 1 : 0),
                        maximumFractionDigits: kpi.decimals ?? (kpi.unit === "percent" ? 1 : 0),
                      })}{kpi.unit === "percent" ? "%" : ""}
                    </span>
                    <span aria-hidden="true">
                      <AnimatedNumber
                        value={kpi.value}
                        decimals={kpi.decimals ?? (kpi.unit === "percent" ? 1 : 0)}
                        suffix={kpi.unit === "percent" ? "%" : ""}
                        durationMs={320}
                      />
                    </span>
                  </span>
                ) : (
                  <span className={`${styles.kpiValue} ${styles.kpiValueMuted}`}>
                    —
                  </span>
                )}

                {comp && kpi.comparison && (
                  <span
                    className={`${styles.deltaTag} ${
                      comp.tone === "positive"
                        ? styles.deltaPositive
                        : comp.tone === "negative"
                          ? styles.deltaNegative
                          : styles.deltaNeutral
                    }`}
                    title={kpi.comparison.baselineLabel}
                    aria-label={`${comp.text}, ${kpi.comparison.baselineLabel}`}
                  >
                    {comp.text}
                  </span>
                )}
              </div>

              {(kpi.exclusionNote || kpi.availabilityNote) && (
                <p className={styles.kpiCaption}>
                  {kpi.exclusionNote ?? kpi.availabilityNote}
                </p>
              )}

              {meterPct !== null && <div className={styles.kpiMeterTrack} aria-hidden="true">
                <div
                  className={styles.kpiMeterFill}
                  style={{ width: `${meterPct}%` }}
                />
              </div>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
