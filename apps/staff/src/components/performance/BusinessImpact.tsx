"use client";

import React from "react";
import type { BusinessImpactItem } from "../../lib/types";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import {
  ClockIcon,
  CostShieldIcon,
  UsersIcon,
} from "../icons/DashboardIcons";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface BusinessImpactProps {
  items: BusinessImpactItem[];
}

function ImpactIcon({ id }: { id: BusinessImpactItem["id"] }) {
  switch (id) {
    case "avoidedMisconnections":
      return <UsersIcon size={16} />;
    case "staffHoursSaved":
      return <ClockIcon size={16} />;
    case "costAvoided":
      return <CostShieldIcon size={16} />;
  }
}

function formatCostDisplay(
  value: number,
  currency: string,
): { prefix: string; numberVal: number; suffix: string } {
  if (value >= 1_000_000) {
    return {
      prefix: `${currency} `,
      numberVal: value / 1_000_000,
      suffix: "M",
    };
  }
  return {
    prefix: `${currency} `,
    numberVal: value,
    suffix: "",
  };
}

export function BusinessImpact({ items }: BusinessImpactProps) {
  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.businessCard}`}
      aria-labelledby="business-impact-heading"
    >
      <div className={styles.businessHeaderRow}>
        <div className={styles.cardTitleWrap}>
          <h2 id="business-impact-heading" className={styles.cardTitle}>
            Business Impact
          </h2>
          <MetricInfoButton
            label="Business Impact"
            text="Estimated impacts remain strictly separated from observed bag outcomes. Modeled values appear only when verified counterfactual baseline risk, labor time-motion, and recovery cost assumptions are configured."
          />
        </div>
        <span className={styles.modeledTag}>
          Separated from observed counts
        </span>
      </div>

      <div className={styles.businessGrid}>
        {items.map((item) => {
          const hasValue =
            item.value !== null && Number.isFinite(item.value);
          const costMeta =
            hasValue && item.unit === "currency"
              ? formatCostDisplay(item.value!, item.currency ?? "HKD")
              : null;

          return (
            <div key={item.id} className={styles.businessCell}>
              <div className={styles.businessIconFrame} aria-hidden="true">
                <ImpactIcon id={item.id} />
              </div>
              <div className={styles.businessContent}>
                <div className={styles.businessLabelRow}>
                  <span className={styles.businessLabel}>{item.label}</span>
                </div>
                <div className={styles.businessValueRow}>
                  {hasValue ? (
                    costMeta ? (
                      <span className={styles.businessValue}>
                        {costMeta.prefix}
                        <AnimatedNumber
                          value={costMeta.numberVal}
                          decimals={costMeta.suffix === "M" ? 2 : 0}
                          suffix={costMeta.suffix}
                        />
                      </span>
                    ) : (
                      <span className={styles.businessValue}>
                        <AnimatedNumber
                          value={item.value}
                          decimals={item.decimals ?? (item.unit === "hours" ? 1 : 0)}
                          suffix={item.unit === "hours" ? " h" : ""}
                        />
                      </span>
                    )
                  ) : (
                    <span
                      className={`${styles.businessValue} ${styles.kpiValueMuted}`}
                    >
                      —
                    </span>
                  )}

                  <div className={styles.businessBadgeRow}>
                    {hasValue && item.comparison && (
                      <span
                        className={`${styles.deltaTag} ${styles.deltaNeutral}`}
                        title={item.comparison.baselineLabel}
                      >
                        {item.comparison.direction === "up" ? "▲" : item.comparison.direction === "down" ? "▼" : "•"}{" "}
                        {item.comparison.delta > 0 ? "+" : ""}
                        {item.comparison.delta.toFixed(item.comparison.unit === "count" ? 0 : 1)}
                        {item.comparison.unit === "percent" ? "%" : item.comparison.unit === "pp" ? " pp" : item.comparison.unit === "minutes" ? " min" : ""}
                      </span>
                    )}

                    <span
                      className={`${styles.provenanceBadge} ${
                        hasValue ? styles.provenanceBadgeActive : ""
                      }`}
                    >
                      {hasValue
                        ? item.kind === "observed"
                          ? "Observed"
                          : "Estimated"
                        : "Model unavailable"}
                    </span>
                  </div>
                </div>
                <p className={styles.businessNote}>
                  {item.assumptionNote ??
                    item.availabilityNote ??
                    "Configured assumptions required."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
