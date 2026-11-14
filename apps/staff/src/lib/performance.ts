import {
  aggregateOutboundFlights,
  isOperationalProvenanceFresh,
  isTransferSnapshotFresh,
} from "./transferControl";
import type {
  BusinessImpactItem,
  CostAssumptions,
  CounterfactualAssumptions,
  EligibleTransferRecord,
  FlightLeg,
  LaborAssumptions,
  MetricComparison,
  OperationalEfficiencySummary,
  OutboundFlightImpactRow,
  OutboundFlightOption,
  PerformanceFilterState,
  PerformanceKpiMetric,
  PerformanceWindow,
  RecoveryEpisodeRecord,
  RecoveryFunnelStage,
  RecoveryPerformanceReport,
  RecoveryStageKey,
  RecoveryTrendBucket,
  RiskCauseBreakdownSummary,
  RiskCauseSlice,
  TransferControlSnapshot,
} from "./types";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const PERFORMANCE_WINDOW_LABELS: Record<PerformanceWindow, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const ALL_STAGES: RecoveryStageKey[] = [
  "detected",
  "actioned",
  "located",
  "loaded",
  "transferred",
];

function parseTimeMs(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function formatHktDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function formatHktShortDate(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

function formatHktHourParts(ms: number): { key: string; label: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    key: `${map.year}-${map.month}-${map.day}T${map.hour}:00+08:00`,
    label: `${map.hour}:00`,
  };
}

export function getWindowBoundsMs(
  window: PerformanceWindow,
  now: Date,
): { startMs: number; endMs: number } {
  const endMs = now.getTime();
  const span = window === "24h" ? 24 * HOUR_MS : window === "7d" ? 7 * DAY_MS : 30 * DAY_MS;
  return { startMs: endMs - span, endMs };
}

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return roundTo(raw, 1);
}

export function dedupeEpisodes(
  episodes: RecoveryEpisodeRecord[],
): RecoveryEpisodeRecord[] {
  const byKey = new Map<string, RecoveryEpisodeRecord>();
  for (const ep of episodes) {
    const key =
      ep.episodeId.trim() ||
      `${ep.bagTag}|${ep.connectionId}|${ep.outboundLegId}|${ep.outboundOperatingDate}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ep);
      continue;
    }
    const existingTs = parseTimeMs(existing.provenance?.observedAt) ?? 0;
    const candidateTs = parseTimeMs(ep.provenance?.observedAt) ?? 0;
    if (candidateTs >= existingTs) {
      byKey.set(key, ep);
    }
  }
  return Array.from(byKey.values());
}

export function dedupeEligibleTransfers(
  records: EligibleTransferRecord[],
): EligibleTransferRecord[] {
  const byKey = new Map<string, EligibleTransferRecord>();
  for (const rec of records) {
    const key = `${rec.bagTag}|${rec.connectionId}|${rec.outboundLegId}|${rec.outboundOperatingDate}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, rec);
      continue;
    }
    const existingTs = parseTimeMs(existing.provenance?.observedAt) ?? 0;
    const candidateTs = parseTimeMs(rec.provenance?.observedAt) ?? 0;
    if (candidateTs >= existingTs) {
      byKey.set(key, rec);
    }
  }
  return Array.from(byKey.values());
}

interface StageEvaluation {
  detected: boolean;
  actioned: boolean;
  located: boolean;
  loaded: boolean;
  transferred: boolean;
  recoveredBeforeCutoff: boolean;
  resolvedForCutoff: boolean;
  alertToActionMin: number | null;
  actionToLocateMin: number | null;
}

export function evaluateEpisodeStages(ep: RecoveryEpisodeRecord): StageEvaluation {
  const tDetect = parseTimeMs(ep.detectedAt);
  const tAction = parseTimeMs(ep.actionedAt);
  const tLocate = parseTimeMs(ep.locatedAt);
  const tLoad = parseTimeMs(ep.loadedAt);
  const tTrans = parseTimeMs(ep.transferredAt);
  const tCutoff = parseTimeMs(ep.loadingCutoffAt);

  const detected = tDetect !== null;
  const actioned = detected && tAction !== null && tAction >= tDetect;
  const located = actioned && tLocate !== null && tLocate >= tAction;
  const loaded = located && tLoad !== null && tLoad >= tLocate;
  const transferred =
    loaded &&
    tTrans !== null &&
    tTrans >= tLoad &&
    ep.outcome === "recovered";

  const alertToActionMin =
    actioned && tDetect !== null && tAction !== null
      ? (tAction - tDetect) / 60_000
      : null;
  const actionToLocateMin =
    located && tAction !== null && tLocate !== null
      ? (tLocate - tAction) / 60_000
      : null;

  const resolvedForCutoff = ep.outcome === "recovered" || ep.outcome === "missed";
  const withinCutoff =
    tCutoff === null || (tLoad !== null && tLoad <= tCutoff);
  const recoveredBeforeCutoff =
    ep.outcome === "recovered" && detected && withinCutoff;

  return {
    detected,
    actioned,
    located,
    loaded,
    transferred,
    recoveredBeforeCutoff,
    resolvedForCutoff,
    alertToActionMin,
    actionToLocateMin,
  };
}

function stableLegKey(leg: {
  outboundLegId?: string;
  id?: string;
  flightNumber?: string;
  outboundFlightNumber?: string;
  operatingDate?: string;
  outboundOperatingDate?: string;
}): string {
  const flight = leg.outboundFlightNumber ?? leg.flightNumber ?? "";
  const date = leg.outboundOperatingDate ?? leg.operatingDate ?? "";
  const id = leg.outboundLegId ?? leg.id ?? "";
  return `${flight}|${date}|${id}`;
}

export function computeRiskCauseBreakdown(
  episodes: RecoveryEpisodeRecord[],
): RiskCauseBreakdownSummary {
  const total = episodes.length;
  if (total === 0) {
    return {
      mode: "unavailable",
      totalCases: null,
      items: [],
      availabilityNote: "No verified high-risk episodes in the selected cohort.",
    };
  }

  const withPrimary = episodes.filter(
    (ep) => typeof ep.primaryRiskCause === "string" && ep.primaryRiskCause.trim().length > 0,
  );
  if (withPrimary.length === total) {
    const counts = new Map<string, number>();
    for (const ep of withPrimary) {
      const cat = ep.primaryRiskCause!.trim();
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const items: RiskCauseSlice[] = Array.from(counts.entries())
      .map(([category, count]) => ({
        category,
        count,
        sharePct: roundTo((count / total) * 100, 1),
      }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
    return {
      mode: "primary_exclusive",
      totalCases: total,
      items,
      availabilityNote: null,
    };
  }

  const mentionCounts = new Map<string, number>();
  let casesWithFactors = 0;
  for (const ep of episodes) {
    const uniqueFactors = new Set(
      (ep.riskFactors ?? []).map((f) => f.trim()).filter(Boolean),
    );
    if (uniqueFactors.size > 0) casesWithFactors += 1;
    for (const factor of uniqueFactors) {
      mentionCounts.set(factor, (mentionCounts.get(factor) ?? 0) + 1);
    }
  }
  if (casesWithFactors > 0) {
    const items: RiskCauseSlice[] = Array.from(mentionCounts.entries())
      .map(([category, count]) => ({
        category,
        count,
        sharePct: roundTo((count / total) * 100, 1),
      }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
    return {
      mode: "multi_factor_mentions",
      totalCases: total,
      items,
      availabilityNote:
        "Multi-factor mentions across high-risk bags; percentages represent share of cases and may exceed 100%.",
    };
  }

  return {
    mode: "unavailable",
    totalCases: total,
    items: [],
    availabilityNote: "Cause attribution signals unavailable for this cohort.",
  };
}

export interface AggregateRecoveryInput {
  episodes: RecoveryEpisodeRecord[];
  eligibleTransfers: EligibleTransferRecord[];
  legs?: FlightLeg[];
  activeSnapshotLegIds?: Set<string>;
  filters: PerformanceFilterState;
  now: Date;
  generatedAt: string;
  validUntil: string | null;
  source: string;
  capturedStages?: RecoveryStageKey[];
  supportedWindows?: PerformanceWindow[];
  supportedStations?: string[];
  coveredBucketKeys?: string[];
  counterfactualAssumptions?: CounterfactualAssumptions | null;
  laborAssumptions?: LaborAssumptions | null;
  costAssumptions?: CostAssumptions | null;
  baselines?: Partial<
    Record<
      PerformanceKpiMetric["id"] | "avoidedMisconnections" | "staffHoursSaved" | "costAvoided",
      MetricComparison | null
    >
  >;
}

function emptyFunnel(note: string): RecoveryFunnelStage[] {
  return [
    {
      key: "detected",
      label: "Detected at risk",
      count: null,
      stepConversionPct: null,
      cumulativePct: null,
      definition: "Unique transfer bag episodes flagged at risk within window.",
      availabilityNote: note,
    },
    {
      key: "actioned",
      label: "Actioned",
      count: null,
      stepConversionPct: null,
      cumulativePct: null,
      definition: "Detected cases with verified recovery task acknowledgement.",
      availabilityNote: note,
    },
    {
      key: "located",
      label: "Located",
      count: null,
      stepConversionPct: null,
      cumulativePct: null,
      definition: "Actioned cases physically located by station scan or team confirmation.",
      availabilityNote: note,
    },
    {
      key: "loaded",
      label: "Loaded",
      count: null,
      stepConversionPct: null,
      cumulativePct: null,
      definition: "Located cases scanned loaded to outbound flight container.",
      availabilityNote: note,
    },
    {
      key: "transferred",
      label: "Successfully transferred",
      count: null,
      stepConversionPct: null,
      cumulativePct: null,
      definition: "Confirmed outbound departure transfer completion.",
      availabilityNote: note,
    },
  ];
}

function unavailableBusinessImpact(note: string): BusinessImpactItem[] {
  return [
    {
      id: "avoidedMisconnections",
      label: "Potential missed connections avoided",
      kind: "estimated",
      value: null,
      unit: "count",
      assumptionNote: null,
      availabilityNote: note,
      comparison: null,
    },
    {
      id: "staffHoursSaved",
      label: "Staff hours saved",
      kind: "estimated",
      value: null,
      unit: "hours",
      assumptionNote: null,
      availabilityNote: note,
      comparison: null,
    },
    {
      id: "costAvoided",
      label: "Estimated service recovery cost avoided",
      kind: "estimated",
      value: null,
      currency: "HKD",
      unit: "currency",
      assumptionNote: null,
      availabilityNote: note,
      comparison: null,
    },
  ];
}

export function aggregateRecoveryPerformance(
  input: AggregateRecoveryInput,
): RecoveryPerformanceReport {
  const {
    filters,
    now,
    generatedAt,
    validUntil,
    source,
    capturedStages = ALL_STAGES,
    supportedWindows = ["24h", "7d", "30d"],
    supportedStations = ["HKG"],
    activeSnapshotLegIds = new Set<string>(),
    counterfactualAssumptions = null,
    laborAssumptions = null,
    costAssumptions = null,
    baselines = {},
  } = input;

  const { startMs, endMs } = getWindowBoundsMs(filters.window, now);
  const stageSet = new Set<RecoveryStageKey>(capturedStages);

  const dedupedEpisodes = dedupeEpisodes(input.episodes).filter((ep) => {
    if (ep.station !== filters.station) return false;
    const ms = parseTimeMs(ep.detectedAt);
    return ms !== null && ms >= startMs && ms <= endMs;
  });

  const dedupedTransfers = dedupeEligibleTransfers(input.eligibleTransfers).filter(
    (rec) => {
      if (rec.station !== filters.station) return false;
      const ms = parseTimeMs(rec.observedAt);
      return ms !== null && ms >= startMs && ms <= endMs;
    },
  );

  // Build outbound filter options from all station/window legs & records before leg filter
  const optionMap = new Map<string, OutboundFlightOption>();
  for (const leg of input.legs ?? []) {
    if (leg.origin !== filters.station) continue;
    const key = stableLegKey(leg);
    if (!optionMap.has(key)) {
      optionMap.set(key, {
        legKey: key,
        outboundLegId: leg.id,
        flightNumber: leg.flightNumber,
        operatingDate: leg.operatingDate,
        route: `${leg.origin} → ${leg.destination}`,
      });
    }
  }
  for (const ep of dedupedEpisodes) {
    const key = stableLegKey(ep);
    if (!optionMap.has(key)) {
      optionMap.set(key, {
        legKey: key,
        outboundLegId: ep.outboundLegId,
        flightNumber: ep.outboundFlightNumber,
        operatingDate: ep.outboundOperatingDate,
        route: `${ep.origin} → ${ep.destination}`,
      });
    }
  }
  for (const rec of dedupedTransfers) {
    const key = stableLegKey(rec);
    if (!optionMap.has(key)) {
      optionMap.set(key, {
        legKey: key,
        outboundLegId: rec.outboundLegId,
        flightNumber: rec.outboundFlightNumber,
        operatingDate: rec.outboundOperatingDate,
        route: `${rec.origin} → ${rec.destination}`,
      });
    }
  }
  const outboundFilterOptions = Array.from(optionMap.values()).sort((a, b) =>
    a.flightNumber.localeCompare(b.flightNumber) ||
    b.operatingDate.localeCompare(a.operatingDate),
  );

  const legMatchesFilter = (item: {
    outboundLegId: string;
    outboundFlightNumber: string;
    outboundOperatingDate: string;
  }) => {
    if (filters.outboundLegId === "all") return true;
    return (
      item.outboundLegId === filters.outboundLegId ||
      stableLegKey(item) === filters.outboundLegId
    );
  };

  const cohortEpisodes = dedupedEpisodes.filter(legMatchesFilter);
  const cohortTransfers = dedupedTransfers.filter(legMatchesFilter);

  // Evaluate stages strictly monotonically per episode
  const evaluations = cohortEpisodes.map((ep) => ({
    ep,
    ev: evaluateEpisodeStages(ep),
  }));

  const detectedCount = stageSet.has("detected")
    ? evaluations.filter((x) => x.ev.detected).length
    : null;
  const actionedCount =
    detectedCount !== null && stageSet.has("actioned")
      ? evaluations.filter((x) => x.ev.actioned).length
      : null;
  const locatedCount =
    actionedCount !== null && stageSet.has("located")
      ? evaluations.filter((x) => x.ev.located).length
      : null;
  const loadedCount =
    locatedCount !== null && stageSet.has("loaded")
      ? evaluations.filter((x) => x.ev.loaded).length
      : null;
  const transferredCount =
    loadedCount !== null && stageSet.has("transferred")
      ? evaluations.filter((x) => x.ev.transferred).length
      : null;

  const recoveredBeforeCutoffCount = evaluations.filter(
    (x) => x.ev.recoveredBeforeCutoff,
  ).length;
  const resolvedCutoffDenominator = evaluations.filter(
    (x) => x.ev.resolvedForCutoff,
  ).length;
  const pendingExcludedCount = evaluations.filter(
    (x) => x.ep.outcome === "pending" || x.ep.outcome === "unknown",
  ).length;

  const eligibleTransferCount = cohortTransfers.filter(
    (r) => r.transferred !== null,
  ).length;
  const successfulTransferCount = cohortTransfers.filter(
    (r) => r.transferred === true,
  ).length;
  const transferSuccessPct =
    eligibleTransferCount > 0
      ? roundTo((successfulTransferCount / eligibleTransferCount) * 100, 1)
      : null;

  const kpis: PerformanceKpiMetric[] = [
    {
      id: "highRisk",
      label: "High-risk bags identified",
      value: detectedCount,
      unit: "count",
      numerator: detectedCount,
      denominator: null,
      definition: "Deduplicated transfer baggage cases flagged at risk in cohort.",
      exclusionNote: null,
      availabilityNote:
        detectedCount === null ? "Risk detection feed unavailable." : null,
      comparison: baselines.highRisk ?? null,
    },
    {
      id: "actioned",
      label: "Recovery actions taken",
      value: actionedCount,
      unit: "count",
      numerator: actionedCount,
      denominator: detectedCount,
      definition:
        "High-risk episodes with verified staff intervention acknowledgement.",
      exclusionNote:
        detectedCount && actionedCount !== null
          ? `${roundTo((actionedCount / detectedCount) * 100, 1)}% of detected cohort`
          : null,
      availabilityNote:
        actionedCount === null ? "Action milestone log unavailable." : null,
      comparison: baselines.actioned ?? null,
    },
    {
      id: "recoveredBeforeCutoff",
      label: "Recovered before cutoff",
      value: cohortEpisodes.length > 0 ? recoveredBeforeCutoffCount : null,
      unit: "count",
      numerator: cohortEpisodes.length > 0 ? recoveredBeforeCutoffCount : null,
      denominator: resolvedCutoffDenominator > 0 ? resolvedCutoffDenominator : null,
      definition:
        "High-risk bags loaded prior to flight loading cutoff and confirmed recovered.",
      exclusionNote:
        resolvedCutoffDenominator > 0
          ? `${recoveredBeforeCutoffCount} / ${resolvedCutoffDenominator} resolved${
              pendingExcludedCount > 0
                ? ` (${pendingExcludedCount} pending excluded)`
                : ""
            }`
          : null,
      availabilityNote:
        cohortEpisodes.length === 0 ? "No episode records in selected cohort." : null,
      comparison: baselines.recoveredBeforeCutoff ?? null,
    },
    {
      id: "transferSuccess",
      label: "Transfer success %",
      value: transferSuccessPct,
      unit: "percent",
      decimals: 1,
      numerator: eligibleTransferCount > 0 ? successfulTransferCount : null,
      denominator: eligibleTransferCount > 0 ? eligibleTransferCount : null,
      definition:
        "Confirmed transferred bags divided by station eligible transfer bags.",
      exclusionNote:
        eligibleTransferCount > 0
          ? `${successfulTransferCount.toLocaleString("en-GB")} / ${eligibleTransferCount.toLocaleString("en-GB")} eligible`
          : null,
      availabilityNote:
        transferSuccessPct === null ? "Eligible transfer denominator unavailable." : null,
      comparison: baselines.transferSuccess ?? null,
    },
  ];

  // 5-stage monotonic funnel
  const stageMeta: Array<{
    key: RecoveryStageKey;
    label: string;
    count: number | null;
    definition: string;
  }> = [
    {
      key: "detected",
      label: "Detected at risk",
      count: detectedCount,
      definition: "Unique transfer bag episodes flagged high risk in cohort.",
    },
    {
      key: "actioned",
      label: "Actioned",
      count: actionedCount,
      definition: "Detected cases with verified recovery team dispatch or claim.",
    },
    {
      key: "located",
      label: "Located",
      count: locatedCount,
      definition: "Actioned bags physically scanned or visually verified at station.",
    },
    {
      key: "loaded",
      label: "Loaded",
      count: loadedCount,
      definition: "Located bags loaded onto outbound flight container.",
    },
    {
      key: "transferred",
      label: "Successfully transferred",
      count: transferredCount,
      definition: "Loaded cases confirmed departed with outbound connection.",
    },
  ];

  const funnel: RecoveryFunnelStage[] = stageMeta.map((s, idx) => {
    const prev = idx > 0 ? stageMeta[idx - 1].count : null;
    const stepConversionPct =
      idx > 0 && s.count !== null && prev !== null && prev > 0
        ? roundTo((s.count / prev) * 100, 1)
        : null;
    const cumulativePct =
      s.count !== null && detectedCount !== null && detectedCount > 0
        ? roundTo((s.count / detectedCount) * 100, 1)
        : null;
    return {
      key: s.key,
      label: s.label,
      count: s.count,
      stepConversionPct,
      cumulativePct,
      definition: s.definition,
      availabilityNote: s.count === null ? `${s.label} milestone unavailable.` : null,
    };
  });

  // Time buckets in Asia/Hong_Kong
  const bucketMap = new Map<
    string,
    {
      bucketKey: string;
      label: string;
      rangeLabel: string;
      sortMs: number;
      detected: number;
      recovered: number;
      eligible: number;
      successful: number;
    }
  >();

  const ensureBucket = (ms: number) => {
    if (filters.window === "24h") {
      const { key, label } = formatHktHourParts(ms);
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          bucketKey: key,
          label,
          rangeLabel: `${formatHktShortDate(ms)} · ${label} HKT`,
          sortMs: ms,
          detected: 0,
          recovered: 0,
          eligible: 0,
          successful: 0,
        });
      }
      return bucketMap.get(key)!;
    }
    const key = formatHktDateKey(ms);
    const label = formatHktShortDate(ms);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        bucketKey: key,
        label,
        rangeLabel: `${label} (${key} HKT)`,
        sortMs: ms,
        detected: 0,
        recovered: 0,
        eligible: 0,
        successful: 0,
      });
    }
    return bucketMap.get(key)!;
  };

  for (const key of input.coveredBucketKeys ?? []) {
    const ms = parseTimeMs(
      key.includes("T") ? key : `${key}T12:00:00+08:00`,
    );
    if (ms !== null && ms >= startMs && ms <= endMs) {
      ensureBucket(ms);
    }
  }

  for (const item of evaluations) {
    const ms = parseTimeMs(item.ep.detectedAt);
    if (ms === null) continue;
    const b = ensureBucket(ms);
    if (item.ev.detected) b.detected += 1;
    if (item.ev.recoveredBeforeCutoff) b.recovered += 1;
  }

  for (const rec of cohortTransfers) {
    const ms = parseTimeMs(rec.observedAt);
    if (ms === null) continue;
    const b = ensureBucket(ms);
    if (rec.transferred !== null) {
      b.eligible += 1;
      if (rec.transferred) b.successful += 1;
    }
  }

  const trend: RecoveryTrendBucket[] = Array.from(bucketMap.values())
    .sort((a, b) => a.sortMs - b.sortMs)
    .map((b) => ({
      bucketKey: b.bucketKey,
      label: b.label,
      rangeLabel: b.rangeLabel,
      detectedCount: stageSet.has("detected") ? b.detected : null,
      recoveredCount: cohortEpisodes.length > 0 ? b.recovered : null,
      eligibleTransferCount: b.eligible > 0 ? b.eligible : null,
      successfulTransferCount: b.eligible > 0 ? b.successful : null,
      successRatePct:
        b.eligible > 0 ? roundTo((b.successful / b.eligible) * 100, 1) : null,
    }));

  // Outbound Flight Impact grouped by stable leg key (flightNumber + operatingDate + id)
  const impactMap = new Map<
    string,
    {
      legKey: string;
      outboundLegId: string;
      flightNumber: string;
      operatingDate: string;
      route: string;
      transferBags: number;
      hasTransferCounts: boolean;
      highRiskBags: number;
      recoveredBeforeCutoff: number;
      missedBags: number;
      pendingBags: number;
    }
  >();

  const ensureImpact = (item: {
    outboundLegId: string;
    outboundFlightNumber: string;
    outboundOperatingDate: string;
    origin: string;
    destination: string;
  }) => {
    const key = stableLegKey(item);
    if (!impactMap.has(key)) {
      impactMap.set(key, {
        legKey: key,
        outboundLegId: item.outboundLegId,
        flightNumber: item.outboundFlightNumber,
        operatingDate: item.outboundOperatingDate,
        route: `${item.origin} → ${item.destination}`,
        transferBags: 0,
        hasTransferCounts: false,
        highRiskBags: 0,
        recoveredBeforeCutoff: 0,
        missedBags: 0,
        pendingBags: 0,
      });
    }
    return impactMap.get(key)!;
  };

  for (const item of evaluations) {
    const row = ensureImpact(item.ep);
    row.highRiskBags += 1;
    if (item.ev.recoveredBeforeCutoff) row.recoveredBeforeCutoff += 1;
    else if (item.ep.outcome === "missed") row.missedBags += 1;
    else row.pendingBags += 1;
  }

  for (const rec of cohortTransfers) {
    const row = ensureImpact(rec);
    row.transferBags += 1;
    row.hasTransferCounts = true;
  }

  const outboundImpact: OutboundFlightImpactRow[] = Array.from(impactMap.values())
    .map((r) => {
      const resolved = r.recoveredBeforeCutoff + r.missedBags;
      return {
        legKey: r.legKey,
        outboundLegId: r.outboundLegId,
        flightNumber: r.flightNumber,
        operatingDate: r.operatingDate,
        route: r.route,
        transferBags: r.hasTransferCounts ? r.transferBags : null,
        highRiskBags: r.highRiskBags,
        recoveredBeforeCutoff: r.recoveredBeforeCutoff,
        missedBags: r.missedBags,
        pendingBags: r.pendingBags,
        saveRatePct:
          resolved > 0
            ? roundTo((r.recoveredBeforeCutoff / resolved) * 100, 1)
            : null,
        inActiveSnapshot: activeSnapshotLegIds.has(r.outboundLegId),
      };
    })
    .sort(
      (a, b) =>
        (b.highRiskBags ?? -1) - (a.highRiskBags ?? -1) ||
        (b.saveRatePct ?? -1) - (a.saveRatePct ?? -1) ||
        a.flightNumber.localeCompare(b.flightNumber),
    );

  // Operational efficiency medians
  const alertToActionSamples = evaluations
    .map((x) => x.ev.alertToActionMin)
    .filter((v): v is number => v !== null);
  const actionToLocateSamples = evaluations
    .map((x) => x.ev.actionToLocateMin)
    .filter((v): v is number => v !== null);

  const efficiency: OperationalEfficiencySummary = {
    medianAlertToActionMin: computeMedian(alertToActionSamples),
    alertToActionSampleSize: alertToActionSamples.length,
    medianActionToLocateMin: computeMedian(actionToLocateSamples),
    actionToLocateSampleSize: actionToLocateSamples.length,
    resolvedBeforeCutoffCount:
      resolvedCutoffDenominator > 0 ? recoveredBeforeCutoffCount : null,
    resolvedBeforeCutoffPct:
      resolvedCutoffDenominator > 0
        ? roundTo((recoveredBeforeCutoffCount / resolvedCutoffDenominator) * 100, 1)
        : null,
    resolvedBeforeCutoffDenominator:
      resolvedCutoffDenominator > 0 ? resolvedCutoffDenominator : null,
    pendingExcludedCount,
    availabilityNote:
      alertToActionSamples.length === 0 && actionToLocateSamples.length === 0
        ? "Milestone duration timestamps unavailable in cohort."
        : null,
  };

  // Risk causes
  const riskCauses = computeRiskCauseBreakdown(cohortEpisodes);

  // Business impact (never invented; strictly requires explicit assumptions)
  const avoidedVal =
    counterfactualAssumptions && resolvedCutoffDenominator > 0
      ? Math.max(
          0,
          roundTo(
            recoveredBeforeCutoffCount *
              Math.min(
                1,
                Math.max(0, counterfactualAssumptions.missedConnectionBaselineRate),
              ),
            0,
          ),
        )
      : null;

  const staffHoursVal =
    laborAssumptions && actionedCount !== null && actionedCount > 0
      ? roundTo((actionedCount * laborAssumptions.minutesSavedPerHandledCase) / 60, 1)
      : null;

  const costAvoidedVal =
    costAssumptions && avoidedVal !== null
      ? roundTo(avoidedVal * costAssumptions.costPerAvoidedMisconnection, 0)
      : null;

  const businessImpact: BusinessImpactItem[] = [
    {
      id: "avoidedMisconnections",
      label: "Potential missed connections avoided",
      kind: "estimated",
      value: avoidedVal,
      unit: "count",
      assumptionNote: counterfactualAssumptions
        ? `${counterfactualAssumptions.methodologyNote} (${Math.round(counterfactualAssumptions.missedConnectionBaselineRate * 100)}% baseline miss risk · ${counterfactualAssumptions.counterfactualModelVersion})`
        : null,
      availabilityNote:
        avoidedVal === null
          ? "Requires configured counterfactual baseline model."
          : null,
      comparison: avoidedVal !== null ? (baselines.avoidedMisconnections ?? null) : null,
    },
    {
      id: "staffHoursSaved",
      label: "Staff hours saved",
      kind: "estimated",
      value: staffHoursVal,
      unit: "hours",
      decimals: 1,
      assumptionNote: laborAssumptions
        ? `${laborAssumptions.methodologyNote} (${laborAssumptions.minutesSavedPerHandledCase} min/handled case)`
        : null,
      availabilityNote:
        staffHoursVal === null
          ? "Requires verified time-motion labor assumptions."
          : null,
      comparison: staffHoursVal !== null ? (baselines.staffHoursSaved ?? null) : null,
    },
    {
      id: "costAvoided",
      label: "Estimated service recovery cost avoided",
      kind: "estimated",
      value: costAvoidedVal,
      currency: costAssumptions?.currency ?? "HKD",
      unit: "currency",
      assumptionNote: costAssumptions
        ? `${costAssumptions.methodologyNote} (${costAssumptions.currency} ${costAssumptions.costPerAvoidedMisconnection.toLocaleString("en-GB")}/avoided case)`
        : null,
      availabilityNote:
        costAvoidedVal === null
          ? "Requires configured counterfactual and unit cost assumptions."
          : null,
      comparison: costAvoidedVal !== null ? (baselines.costAvoided ?? null) : null,
    },
  ];

  const missingInputs: string[] = [];
  if (cohortEpisodes.length === 0) missingInputs.push("recovery_episodes");
  if (!counterfactualAssumptions) missingInputs.push("counterfactual_model");
  if (!laborAssumptions) missingInputs.push("labor_assumptions");
  if (!costAssumptions) missingInputs.push("cost_assumptions");

  return {
    availability:
      cohortEpisodes.length > 0 || eligibleTransferCount > 0
        ? missingInputs.length === 0
          ? "available"
          : "partial"
        : "unavailable",
    source,
    generatedAt,
    validUntil,
    window: filters.window,
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
    station: filters.station,
    supportedWindows,
    supportedStations,
    outboundFilterOptions,
    missingInputs,
    statusNote: null,
    kpis,
    funnel,
    funnelNote:
      stageSet.size < ALL_STAGES.length
        ? "Some intermediate recovery milestone scans are unavailable in upstream feed."
        : null,
    trend,
    trendNote:
      trend.length === 0
        ? "Time-bucketed recovery history is unavailable for the selected cohort."
        : null,
    outboundImpact,
    outboundImpactDefinition:
      "Save rate = Recovered before cutoff / Resolved high-risk bags (Recovered + Missed; pending cases excluded).",
    riskCauses,
    efficiency,
    businessImpact,
  };
}

export function buildUnavailablePerformanceReport({
  filters,
  now,
  snapshot,
  missingInputs = [
    "historical_risk_episodes",
    "staff_action_acknowledgements",
    "loading_cutoff_confirmations",
    "counterfactual_missed_connection_model",
    "labor_and_cost_assumptions",
  ],
  statusNote,
}: {
  filters: PerformanceFilterState;
  now: Date;
  snapshot?: TransferControlSnapshot | null;
  missingInputs?: string[];
  statusNote?: string | null;
}): RecoveryPerformanceReport {
  const freshSnapshot = snapshot && isTransferSnapshotFresh(snapshot, now) ? snapshot : null;
  const freshOutbound = freshSnapshot
    ? aggregateOutboundFlights(freshSnapshot, now).filter(
        (f) => f.leg.origin === filters.station,
      )
    : [];

  const outboundFilterOptions: OutboundFlightOption[] = freshOutbound.map((f) => ({
    legKey: stableLegKey(f.leg),
    outboundLegId: f.leg.id,
    flightNumber: f.leg.flightNumber,
    operatingDate: f.leg.operatingDate,
    route: `${f.leg.origin} → ${f.leg.destination}`,
  }));

  const matchesLeg = (leg: FlightLeg) =>
    filters.outboundLegId === "all" ||
    leg.id === filters.outboundLegId ||
    stableLegKey(leg) === filters.outboundLegId;

  const visibleOutbound = freshOutbound.filter((f) => matchesLeg(f.leg));
  const outboundImpact: OutboundFlightImpactRow[] = visibleOutbound.map((f) => ({
    legKey: stableLegKey(f.leg),
    outboundLegId: f.leg.id,
    flightNumber: f.leg.flightNumber,
    operatingDate: f.leg.operatingDate,
    route: `${f.leg.origin} → ${f.leg.destination}`,
    transferBags: f.transferBagCount,
    highRiskBags: f.actionRequiredCount + f.atRiskCount,
    recoveredBeforeCutoff: null,
    missedBags: null,
    pendingBags: f.transferBagCount,
    saveRatePct: null,
    inActiveSnapshot: true,
  }));

  // Transfer success % is strictly scoped to upstream transferSuccess 24h feed at station level
  const ts = freshSnapshot?.transferSuccess ?? null;
  const canUseSnapshotTransferSuccess =
    Boolean(
      ts &&
        filters.window === "24h" &&
        filters.outboundLegId === "all" &&
        filters.station === "HKG" &&
        ts.eligible > 0 &&
        isOperationalProvenanceFresh(ts.provenance, now),
    );

  const transferSuccessPct =
    canUseSnapshotTransferSuccess && ts
      ? roundTo((ts.successful / ts.eligible) * 100, 1)
      : null;

  const { startMs, endMs } = getWindowBoundsMs(filters.window, now);

  const kpis: PerformanceKpiMetric[] = [
    {
      id: "highRisk",
      label: "High-risk bags identified",
      value: null,
      unit: "count",
      numerator: null,
      denominator: null,
      definition: `Unique transfer bags flagged high risk across ${PERFORMANCE_WINDOW_LABELS[filters.window]}.`,
      exclusionNote: null,
      availabilityNote: `Historical risk episodes unavailable (${filters.window}).`,
      comparison: null,
    },
    {
      id: "actioned",
      label: "Recovery actions taken",
      value: null,
      unit: "count",
      numerator: null,
      denominator: null,
      definition: "High-risk cases with recorded team action acknowledgement.",
      exclusionNote: null,
      availabilityNote: "Action audit feed unavailable.",
      comparison: null,
    },
    {
      id: "recoveredBeforeCutoff",
      label: "Recovered before cutoff",
      value: null,
      unit: "count",
      numerator: null,
      denominator: null,
      definition: "High-risk bags confirmed loaded prior to outbound loading cutoff.",
      exclusionNote: null,
      availabilityNote: "Loading cutoff reconciliation unavailable.",
      comparison: null,
    },
    {
      id: "transferSuccess",
      label: "Transfer success %",
      value: transferSuccessPct,
      unit: "percent",
      decimals: 1,
      numerator: canUseSnapshotTransferSuccess && ts ? ts.successful : null,
      denominator: canUseSnapshotTransferSuccess && ts ? ts.eligible : null,
      definition:
        "Confirmed transferred bags divided by station eligible transfer bags.",
      exclusionNote:
        canUseSnapshotTransferSuccess && ts
          ? `${ts.successful.toLocaleString("en-GB")} / ${ts.eligible.toLocaleString("en-GB")} eligible (24h feed)`
          : null,
      availabilityNote:
        transferSuccessPct === null
          ? filters.window === "24h"
            ? "Upstream transfer-success series unavailable for filter."
            : `${PERFORMANCE_WINDOW_LABELS[filters.window]} transfer-success history unavailable.`
          : null,
      comparison: null,
    },
  ];

  return {
    availability: "unavailable",
    source: freshSnapshot ? freshSnapshot.source : "unavailable",
    generatedAt: freshSnapshot ? freshSnapshot.generatedAt : now.toISOString(),
    validUntil: freshSnapshot ? freshSnapshot.validUntil : null,
    window: filters.window,
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
    station: filters.station,
    supportedWindows: ["24h", "7d", "30d"],
    supportedStations: ["HKG"],
    outboundFilterOptions,
    missingInputs,
    statusNote:
      statusNote ??
      (freshSnapshot
        ? `Historical recovery reporting unavailable; live Transfer Control snapshot lists ${outboundImpact.length} outbound departures only.`
        : "Historical recovery reporting and upstream station telemetry are unavailable."),
    kpis,
    funnel: emptyFunnel("Historical recovery milestone funnel unavailable."),
    funnelNote:
      "Multi-stage intervention logs (Detected -> Actioned -> Located -> Loaded -> Transferred) require upstream reporting warehouse integration.",
    trend: [],
    trendNote: `Multi-day recovery trend unavailable for ${PERFORMANCE_WINDOW_LABELS[filters.window]}; current snapshot never extrapolated across dates.`,
    outboundImpact,
    outboundImpactDefinition:
      "Active outbound departures only when available; historical save rates require loading cutoff outcomes.",
    riskCauses: {
      mode: "unavailable",
      totalCases: null,
      items: [],
      availabilityNote: "Historical root-cause attribution unavailable.",
    },
    efficiency: {
      medianAlertToActionMin: null,
      alertToActionSampleSize: 0,
      medianActionToLocateMin: null,
      actionToLocateSampleSize: 0,
      resolvedBeforeCutoffCount: null,
      resolvedBeforeCutoffPct: null,
      resolvedBeforeCutoffDenominator: null,
      pendingExcludedCount: 0,
      availabilityNote: "Milestone turnaround timestamps unavailable.",
    },
    businessImpact: unavailableBusinessImpact(
      "Counterfactual, labor, and recovery cost assumptions not configured.",
    ),
  };
}

export function isPerformanceReportFresh(
  report: RecoveryPerformanceReport,
  now = new Date(),
): boolean {
  if (report.availability === "unavailable") return false;
  if (!report.validUntil) return true;
  const validMs = Date.parse(report.validUntil);
  return Number.isFinite(validMs) && validMs > now.getTime();
}

export function validateRecoveryPerformanceReport(
  raw: unknown,
): raw is RecoveryPerformanceReport {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  if (
    r.availability !== "available" &&
    r.availability !== "partial" &&
    r.availability !== "unavailable"
  ) {
    return false;
  }
  if (
    typeof r.source !== "string" ||
    typeof r.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(r.generatedAt)) ||
    typeof r.station !== "string" ||
    (r.window !== "24h" && r.window !== "7d" && r.window !== "30d")
  ) {
    return false;
  }
  if (
    !Array.isArray(r.kpis) ||
    !Array.isArray(r.funnel) ||
    !Array.isArray(r.trend) ||
    !Array.isArray(r.outboundImpact) ||
    !Array.isArray(r.businessImpact) ||
    !Array.isArray(r.missingInputs)
  ) {
    return false;
  }
  if (!r.riskCauses || typeof r.riskCauses !== "object") return false;
  if (!r.efficiency || typeof r.efficiency !== "object") return false;
  return true;
}
