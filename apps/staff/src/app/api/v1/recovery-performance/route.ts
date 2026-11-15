import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  aggregateRecoveryPerformance,
  buildUnavailablePerformanceReport,
  validateRecoveryPerformanceReport,
} from "../../../../lib/performance";
import { fetchLiveRecoveryPerformance } from "../../../../lib/liveTransferAdapter";
import type {
  CostAssumptions,
  CounterfactualAssumptions,
  EligibleTransferRecord,
  FlightLeg,
  LaborAssumptions,
  PerformanceFilterState,
  PerformanceWindow,
  RecoveryEpisodeRecord,
  RecoveryStageKey,
} from "../../../../lib/types";

interface QaPerformanceSource {
  generatedAt: string;
  validUntil?: string | null;
  source?: string;
  referenceNow?: string;
  capturedStages?: RecoveryStageKey[];
  supportedWindows?: PerformanceWindow[];
  supportedStations?: string[];
  coveredBucketKeys?: string[];
  legs?: FlightLeg[];
  episodes: RecoveryEpisodeRecord[];
  eligibleTransfers?: EligibleTransferRecord[];
  activeSnapshotLegIds?: string[];
  counterfactualAssumptions?: CounterfactualAssumptions | null;
  laborAssumptions?: LaborAssumptions | null;
  costAssumptions?: CostAssumptions | null;
}

function isValidQaSource(raw: unknown): raw is QaPerformanceSource {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.generatedAt === "string" &&
    Number.isFinite(Date.parse(r.generatedAt)) &&
    Array.isArray(r.episodes)
  );
}

const VALID_WINDOWS = new Set<PerformanceWindow>(["24h", "7d", "30d"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawWindow = url?.searchParams.get("window") ?? "7d";
  const rawStation = (url?.searchParams.get("station") ?? "HKG").toUpperCase();
  const outboundLegId = url?.searchParams.get("outboundLegId")?.trim() || "all";

  if (!VALID_WINDOWS.has(rawWindow as PerformanceWindow)) {
    return NextResponse.json(
      { detail: "Unsupported reporting window" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!/^[A-Z]{3}$/.test(rawStation)) {
    return NextResponse.json(
      { detail: "Invalid station code" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const filters: PerformanceFilterState = {
    window: rawWindow as PerformanceWindow,
    station: rawStation,
    outboundLegId,
  };
  const now = new Date();
  if (process.env.STAFF_LIVE_BACKEND === "1") {
    try {
      const liveReport = await fetchLiveRecoveryPerformance(filters);
      return NextResponse.json(liveReport, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json(
        { detail: "Recovery-performance source unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  const useQaFixture =
    process.env.NODE_ENV !== "production" &&
    process.env.STAFF_QA_FIXTURE === "1";

  if (useQaFixture) {
    try {
      const fixturePath = path.join(
        process.cwd(),
        ".next",
        "qa-fixtures",
        "recovery-performance.json",
      );
      const raw = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
      if (isValidQaSource(raw)) {
        const refNow =
          raw.referenceNow && Number.isFinite(Date.parse(raw.referenceNow))
            ? new Date(raw.referenceNow)
            : now;
        const report = aggregateRecoveryPerformance({
          episodes: raw.episodes,
          eligibleTransfers: raw.eligibleTransfers ?? [],
          legs: raw.legs ?? [],
          activeSnapshotLegIds: new Set(raw.activeSnapshotLegIds ?? []),
          filters,
          now: refNow,
          generatedAt: raw.generatedAt,
          validUntil: raw.validUntil ?? null,
          source: raw.source ?? "qa-fixture",
          capturedStages: raw.capturedStages,
          supportedWindows: raw.supportedWindows,
          supportedStations: raw.supportedStations,
          coveredBucketKeys: raw.coveredBucketKeys,
          counterfactualAssumptions: raw.counterfactualAssumptions ?? null,
          laborAssumptions: raw.laborAssumptions ?? null,
          costAssumptions: raw.costAssumptions ?? null,
        });
        return NextResponse.json(report, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      if (validateRecoveryPerformanceReport(raw)) {
        return NextResponse.json(raw, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json(
        { detail: "Recovery-performance source unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "ENOENT") {
        // Optional QA performance dataset not provisioned; fall through cleanly to unavailable report.
      } else {
        return NextResponse.json(
          { detail: "Recovery-performance source unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  }

  return NextResponse.json(
    buildUnavailablePerformanceReport({ filters, now }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
