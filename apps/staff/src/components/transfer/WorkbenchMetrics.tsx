"use client";

import React, { useEffect, useRef, useState } from "react";
import type { OutboundFlightSummary } from "../../lib/types";
import { AnimatedNumber } from "../ui/AnimatedNumber";

export type RiskTier = "critical" | "high" | "medium" | "low" | "none";
export type DeadlineUrgency = "overdue" | "urgent" | "active" | "none";

export interface LiveTimeDisplay {
  text: string;
  badge: string | null;
  urgency: DeadlineUrgency;
  meterPct: number;
  ariaLabel: string;
}

const URGENT_THRESHOLD_MS = 15 * 60_000;
const WINDOW_REFERENCE_MS = 60 * 60_000;

export function getRiskTier(score: number | null | undefined): RiskTier {
  if (score === null || score === undefined || !Number.isFinite(score)) return "none";
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function riskTierLabel(tier: RiskTier): string {
  switch (tier) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Moderate";
    case "low":
      return "Low";
    default:
      return "Unavailable";
  }
}

function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}h ${mm}m ${ss}s` : `${mm}m ${ss}s`;
}

export function formatLiveTimeToAct(diffMs: number | null): LiveTimeDisplay {
  if (diffMs === null || !Number.isFinite(diffMs)) {
    return {
      text: "—",
      badge: null,
      urgency: "none",
      meterPct: 0,
      ariaLabel: "Earliest time to act unavailable",
    };
  }

  if (diffMs < 0) {
    const overdueSeconds = Math.max(1, Math.ceil(Math.abs(diffMs) / 1000));
    const formatted = formatDurationSeconds(overdueSeconds);
    return {
      text: formatted,
      badge: "overdue",
      urgency: "overdue",
      meterPct: 100,
      ariaLabel: `${formatted} overdue`,
    };
  }

  const remainingSeconds = Math.floor(diffMs / 1000);
  const formatted = formatDurationSeconds(remainingSeconds);
  const urgency: DeadlineUrgency = diffMs <= URGENT_THRESHOLD_MS ? "urgent" : "active";
  const meterPct = Math.min(100, Math.max(4, Math.round((diffMs / WINDOW_REFERENCE_MS) * 100)));

  return {
    text: formatted,
    badge: urgency === "urgent" ? "urgent" : "remaining",
    urgency,
    meterPct,
    ariaLabel: `${formatted} remaining`,
  };
}

export function stationClockSeconds(at: string | null | undefined): string {
  if (!at || !Number.isFinite(Date.parse(at))) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at));
}

interface WorkbenchMetricsProps {
  header: OutboundFlightSummary | null;
  fresh: boolean;
  now: Date;
}

export function WorkbenchMetrics({ header, fresh, now }: WorkbenchMetricsProps) {
  const baseNowMs = now.getTime();
  const [tickOffset, setTickOffset] = useState<{ base: number; elapsed: number }>({
    base: baseNowMs,
    elapsed: 0,
  });
  const syncedAtWallMsRef = useRef<number>(0);

  const earliestActionAt = fresh ? header?.earliestActionAt ?? null : null;
  const deadlineMs = earliestActionAt && Number.isFinite(Date.parse(earliestActionAt))
    ? Date.parse(earliestActionAt)
    : null;

  useEffect(() => {
    syncedAtWallMsRef.current = Date.now();
    if (deadlineMs === null) return;

    const syncTick = () => {
      if (document.visibilityState === "hidden") return;
      setTickOffset({
        base: baseNowMs,
        elapsed: Math.max(0, Date.now() - syncedAtWallMsRef.current),
      });
    };

    const intervalId = window.setInterval(syncTick, 1000);
    document.addEventListener("visibilitychange", syncTick);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncTick);
    };
  }, [baseNowMs, deadlineMs]);

  const elapsedMs = tickOffset.base === baseNowMs ? tickOffset.elapsed : 0;
  const effectiveNowMs = baseNowMs + elapsedMs;
  const riskScore = fresh ? (header?.riskScore ?? null) : null;
  const riskTier = getRiskTier(riskScore);
  const riskPct = riskScore !== null && Number.isFinite(riskScore)
    ? Math.max(0, Math.min(100, riskScore))
    : 0;

  const totalBags = fresh ? (header?.transferBagCount ?? null) : null;
  const actionCount = fresh ? (header?.actionRequiredCount ?? 0) : 0;
  const atRiskCount = fresh ? (header?.atRiskCount ?? 0) : 0;
  const onTrackCount = fresh ? (header?.onTrackCount ?? 0) : 0;
  const affectedCount = fresh ? actionCount + atRiskCount : null;

  const affectedSharePct =
    fresh && totalBags && totalBags > 0 && affectedCount !== null
      ? Math.round((affectedCount / totalBags) * 100)
      : null;

  const actionBarPct = totalBags && totalBags > 0 ? (actionCount / totalBags) * 100 : 0;
  const atRiskBarPct = totalBags && totalBags > 0 ? (atRiskCount / totalBags) * 100 : 0;
  const onTrackBarPct = totalBags && totalBags > 0 ? (onTrackCount / totalBags) * 100 : 0;

  const diffMs = deadlineMs !== null ? deadlineMs - effectiveNowMs : null;
  const liveTime = formatLiveTimeToAct(diffMs);

  const bagSummaryParts: string[] = [];
  if (fresh) {
    if (actionCount > 0) bagSummaryParts.push(`${actionCount} action`);
    if (atRiskCount > 0) bagSummaryParts.push(`${atRiskCount} at risk`);
    if (bagSummaryParts.length === 0 && onTrackCount > 0) bagSummaryParts.push(`${onTrackCount} on track`);
    if (bagSummaryParts.length === 0 && totalBags === 0) bagSummaryParts.push("No transfer bags");
  }

  const tierCaption =
    riskScore === null
      ? "Assessment unavailable"
      : `${riskTierLabel(riskTier)} · ${
          riskTier === "critical"
            ? "80–100"
            : riskTier === "high"
              ? "55–79"
              : riskTier === "medium"
                ? "30–54"
                : "0–29"
        }`;

  return (
    <dl className="workbench-metrics wb-metrics">
      <div className="wb-metric-col">
        <dt className="wb-metric-label">Flight risk /100</dt>
        <dd className="wb-metric-value">
          <span className="wb-metric-num" data-risk-tier={riskTier}>
            <AnimatedNumber value={riskScore} />
          </span>
          {riskScore !== null && <span className="wb-metric-sub">/ 100</span>}
        </dd>
        <div className="wb-bar-track" aria-hidden="true">
          <span
            className="wb-bar-fill"
            data-risk-tier={riskTier}
            style={{ width: `${riskPct}%` }}
          />
        </div>
        <p className="wb-metric-caption">
          {riskTier !== "none" && (
            <span className="wb-status-dot" data-risk-tier={riskTier} aria-hidden="true" />
          )}
          <span>{tierCaption}</span>
        </p>
      </div>

      <div className="wb-metric-col">
        <dt className="wb-metric-label">Affected bags</dt>
        <dd className="wb-metric-value">
          <span className="wb-metric-num">
            <AnimatedNumber value={affectedCount} />
          </span>
          {totalBags !== null && (
            <span className="wb-metric-sub">
              of {totalBags}
              {affectedSharePct !== null ? ` · ${affectedSharePct}%` : ""}
            </span>
          )}
        </dd>
        <div className="wb-stacked-track" aria-hidden="true">
          {actionBarPct > 0 && (
            <span
              className="wb-stacked-seg wb-seg-action"
              style={{ width: `${actionBarPct}%` }}
            />
          )}
          {atRiskBarPct > 0 && (
            <span
              className="wb-stacked-seg wb-seg-risk"
              style={{ width: `${atRiskBarPct}%` }}
            />
          )}
          {onTrackBarPct > 0 && (
            <span
              className="wb-stacked-seg wb-seg-track"
              style={{ width: `${onTrackBarPct}%` }}
            />
          )}
        </div>
        <p className="wb-metric-caption">
          {!fresh ? "Bag cohort unavailable" : bagSummaryParts.join(" · ") || "0 affected"}
        </p>
      </div>

      <div className="wb-metric-col wb-metric-timer">
        <dt className="wb-metric-label">Earliest Time to Act</dt>
        <dd className="wb-metric-value wb-timer-row" aria-label={liveTime.ariaLabel}>
          <span className="wb-metric-num wb-timer-readout" data-urgency={liveTime.urgency}>
            {liveTime.text}
          </span>
          {liveTime.badge && (
            <span className="wb-timer-qual" data-urgency={liveTime.urgency}>
              {liveTime.badge}
            </span>
          )}
        </dd>
        <div className="wb-bar-track" aria-hidden="true">
          <span
            className="wb-bar-fill"
            data-urgency={liveTime.urgency}
            style={{ width: `${liveTime.meterPct}%` }}
          />
        </div>
        <p className="wb-metric-caption">
          {earliestActionAt ? `Cutoff ${stationClockSeconds(earliestActionAt)} HKT` : "No active deadline"}
        </p>
      </div>
    </dl>
  );
}
