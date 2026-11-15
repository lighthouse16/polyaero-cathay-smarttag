"use client";

import React, { useState } from "react";
import type { ResponseTimeBucket } from "../../lib/types";
import { MetricInfoButton } from "./MetricInfoButton";
import styles from "./PerformanceView.module.css";

interface ResponseTimeDistributionProps {
  buckets: ResponseTimeBucket[];
  medianMin: number | null;
  sampleSize: number;
}

export function ResponseTimeDistribution({
  buckets,
  medianMin,
  sampleSize,
}: ResponseTimeDistributionProps) {
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const hasData = buckets.length > 0 && sampleSize > 0;
  const maxPct = hasData
    ? Math.max(25, ...buckets.map((b) => b.sharePct))
    : 100;
  const ceiling = Math.min(100, Math.ceil(maxPct / 10) * 10);
  const selected = buckets.find((b) => b.bucket === activeBucket) ?? null;

  return (
    <section
      className={`card-surface ${styles.chartCard} ${styles.responseDistCard}`}
      aria-labelledby="response-dist-heading"
    >
      <div className={styles.cardHeaderRow}>
        <div>
          <div className={styles.cardTitleWrap}>
            <h2 id="response-dist-heading" className={styles.cardTitle}>
              Response Time Distribution
            </h2>
            <MetricInfoButton
              label="Response Time Distribution"
              text="Share of actioned high-risk baggage cases grouped by elapsed alert-to-action response window in minutes."
            />
          </div>
          <p className={styles.cardSubtitle}>
            {hasData
              ? selected
                ? `${selected.bucket}: ${selected.count} bags (${selected.sharePct.toFixed(1)}%)`
                : `Alert → action latency · n = ${sampleSize}${
                    medianMin !== null ? ` · median ${medianMin.toFixed(1)}m` : ""
                  }`
              : "Awaiting verified action timestamps"}
          </p>
        </div>
      </div>

      {hasData ? (
        <div className={styles.responseChartWrap} role="group" aria-label="Response time latency buckets">
          {buckets.map((item) => {
            const heightPct = Math.max(4, Math.min(100, (item.sharePct / ceiling) * 100));
            const isFast = item.bucket === "<5m" || item.bucket === "5–10m";
            const isActive = activeBucket === item.bucket;
            return (
              <button
                key={item.bucket}
                type="button"
                aria-pressed={isActive}
                className={`${styles.responseColBtn} ${
                  isActive ? styles.responseColBtnActive : ""
                }`}
                onMouseEnter={() => setActiveBucket(item.bucket)}
                onMouseLeave={() => setActiveBucket(null)}
                onFocus={() => setActiveBucket(item.bucket)}
                onBlur={() => setActiveBucket(null)}
                onClick={() =>
                  setActiveBucket((prev) => (prev === item.bucket ? null : item.bucket))
                }
                aria-label={`${item.bucket}: ${item.count} bags, ${item.sharePct.toFixed(1)}%`}
              >
                <span className={styles.responseBarPct}>
                  {Math.round(item.sharePct)}%
                </span>
                <span className={styles.responseBarTrack} aria-hidden="true">
                  <span
                    className={styles.responseBarFill}
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isFast ? "#163230" : "#367878",
                    }}
                  />
                </span>
                <span className={styles.responseBucketLabel}>{item.bucket}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.causeUnavailable}>
          <p className={styles.emptyOverlayTitle}>Response buckets unavailable</p>
          <p className={styles.emptyOverlaySub}>
            Verified alert-to-action timestamps are required to plot turnaround latency distribution.
          </p>
        </div>
      )}
    </section>
  );
}
