import type {
  BagRiskAssessment,
  BagTransferConnection,
  EligibleTransferRecord,
  FlightLeg,
  FlightRiskAssessment,
  LiveBag,
  OperationalProvenance,
  PerformanceFilterState,
  RecoveryEpisodeRecord,
  RecoveryPerformanceReport,
  TransferControlSnapshot,
} from "./types";
import { validateTransferSnapshot } from "./transferControl";
import { aggregateRecoveryPerformance } from "./performance";

export interface BackendScanEvent {
  id: string;
  event_type: string;
  timestamp: string;
  location_code?: string | null;
  station_name?: string | null;
  scanner_type?: string | null;
  notes?: string | null;
}

export interface BackendBag {
  id: string;
  tag_number: string;
  tag_code?: string | null;
  tag_interface?: string | null;
  booking_reference?: string | null;
  passenger_name: string;
  tier_status?: string | null;
  cabin_class?: string | null;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  seat_number?: string | null;
  weight_kg?: number | null;
  connection_minutes?: number | null;
  status: string;
  is_tag_synced?: boolean | null;
  last_known_location?: string | null;
  carousel_assigned?: string | null;
  is_rush_bag?: boolean | null;
  risk_score?: number | null;
  risk_level?: string | null;
  risk_factors?: string[] | null;
  recommended_action?: string | null;
  copilot_approval_status?: string | null;
  passenger_recovery_choice?: string | null;
  eink_banner?: string | null;
  updated_at?: string | null;
  events?: BackendScanEvent[] | null;
}

// shortcut: feeder legs remain demo assumptions until the API supplies actual transfer connections.
const FEEDER_POOL = [
  { flightNumber: "CX467", origin: "TPE" },
  { flightNumber: "CX714", origin: "SIN" },
  { flightNumber: "CX750", origin: "BKK" },
  { flightNumber: "CX906", origin: "MNL" },
  { flightNumber: "CX365", origin: "PVG" },
];

export function buildLiveTransferSnapshot(
  backendBags: BackendBag[],
  now = new Date(),
  sourceLabel = "Live Cloud Run + AWS RDS",
): TransferControlSnapshot {
  const nowMs = now.getTime();
  const generatedAt = new Date(nowMs).toISOString();
  const validUntil = new Date(nowMs + 10 * 60_000).toISOString();

  const makeProv = (
    recordId: string,
    system = "smarttag-cloudrun-rds",
  ): OperationalProvenance => ({
    system,
    recordId,
    observedAt: generatedAt,
    validUntil,
  });

  const seenTags = new Set<string>();
  const seenIds = new Set<string>();
  const deduped = backendBags.filter((b, idx) => {
    const t = String(b.tag_number || "").trim();
    if (!t || seenTags.has(t)) return false;
    seenTags.add(t);
    if (!b.id || seenIds.has(b.id)) {
      b.id = `bag_${t}_${idx}`;
    }
    seenIds.add(b.id);
    return true;
  });

  const legsMap = new Map<string, FlightLeg>();
  const bags: LiveBag[] = [];
  const connections: BagTransferConnection[] = [];
  const bagRisks: BagRiskAssessment[] = [];
  const flightBagsMap = new Map<string, number[]>();

  deduped.forEach((b, idx) => {
    const parsedDep = Date.parse(b.departure_time || "");
    const depMs = Number.isFinite(parsedDep)
      ? parsedDep
      : nowMs + (2 + idx) * 3600_000;
    const depIso = new Date(depMs).toISOString();
    const opDate = depIso.slice(0, 10);

    const rawFlight = (b.flight_number || "CX888").toUpperCase();
    const rawOrigin = (b.departure_airport || "HKG").toUpperCase();
    const rawDest = (b.arrival_airport || "YVR").toUpperCase();

    // Ensure HKG hub invariant: inbound leg ends at HKG, outbound leg starts at HKG
    const isInboundToHkg = rawDest === "HKG" && rawOrigin !== "HKG";
    const outFlight = isInboundToHkg ? "CX548" : rawFlight;
    const outOrigin = "HKG";
    const outDest = isInboundToHkg
      ? "NRT"
      : rawDest === "HKG"
        ? "NRT"
        : rawDest;
    const outLegId = `out-${outFlight}-${opDate}`;

    if (!legsMap.has(outLegId)) {
      legsMap.set(outLegId, {
        id: outLegId,
        flightNumber: outFlight,
        operatingDate: opDate,
        origin: outOrigin,
        destination: outDest,
        scheduledDepartureAt: depIso,
        scheduledArrivalAt: null,
        estimatedDepartureAt: depIso,
        estimatedArrivalAt: null,
        actualArrivalAt: null,
        provenance: makeProv(`leg:${outLegId}`),
      });
    }

    const feeder = isInboundToHkg
      ? { flightNumber: rawFlight, origin: rawOrigin }
      : FEEDER_POOL[idx % FEEDER_POOL.length];
    const inLegId = `in-${feeder.flightNumber}-${opDate}`;
    const connMins =
      typeof b.connection_minutes === "number" && b.connection_minutes >= 0
        ? b.connection_minutes
        : b.is_rush_bag
          ? 35
          : 95;
    const inArrMs = depMs - connMins * 60_000;
    const inArrIso = new Date(inArrMs).toISOString();

    if (!legsMap.has(inLegId)) {
      legsMap.set(inLegId, {
        id: inLegId,
        flightNumber: feeder.flightNumber,
        operatingDate: opDate,
        origin: feeder.origin,
        destination: "HKG",
        scheduledDepartureAt: null,
        scheduledArrivalAt: inArrIso,
        estimatedDepartureAt: null,
        estimatedArrivalAt: inArrIso,
        actualArrivalAt: inArrMs <= nowMs ? inArrIso : null,
        provenance: makeProv(`leg:${inLegId}`),
      });
    }

    const updatedMs = Math.min(Date.parse(b.updated_at || "") || nowMs, nowMs);
    const updatedIso = new Date(updatedMs).toISOString();
    const rawEvents = Array.isArray(b.events) ? b.events : [];
    const seenEvtIds = new Set<string>();
    const events = rawEvents.map((e, eIdx) => {
      const evTs = Math.min(Date.parse(e.timestamp || "") || nowMs, nowMs);
      let evId = String(e.id || "").trim() || `${b.tag_number}-evt-${eIdx}`;
      if (seenEvtIds.has(evId)) evId = `${evId}-${eIdx}`;
      seenEvtIds.add(evId);
      return {
        id: evId,
        event_type: e.event_type || b.status || "TAGGED",
        timestamp: new Date(evTs).toISOString(),
        location_code: e.location_code || "HKG-T1",
        station_name: e.station_name || "HKIA Transfer Control",
        scanner_type: e.scanner_type || "NFC_TAP",
        provenance: makeProv(`evt:${evId}`),
      };
    });

    const liveBag: LiveBag = {
      id: b.id,
      tag_number: b.tag_number,
      tag_code: b.tag_code || `NFC-${b.tag_number}`,
      booking_reference: b.booking_reference || "",
      passenger_name: b.passenger_name || "",
      tier_status: b.tier_status || "",
      cabin_class: b.cabin_class || "",
      flight_number: outFlight,
      departure_airport: outOrigin,
      arrival_airport: outDest,
      departure_time: depIso,
      seat_number: b.seat_number || "",
      weight_kg: typeof b.weight_kg === "number" ? b.weight_kg : 22.0,
      status: b.status || "TAGGED",
      last_known_location: b.last_known_location || "HKG-T1-TRANSFER",
      carousel_assigned: b.carousel_assigned || "",
      is_rush_bag: Boolean(b.is_rush_bag),
      risk_score: typeof b.risk_score === "number" ? b.risk_score : 0,
      risk_level: b.risk_level || "UNASSESSED",
      recommended_action: b.recommended_action || "",
      eink_banner: b.eink_banner || "",
      updated_at: updatedIso,
      events,
    };
    bags.push(liveBag);

    const statusUpper = (b.status || "").toUpperCase();
    const isCompleted = [
      "LOADED",
      "IN_TRANSIT",
      "ARRIVED",
      "ON_CAROUSEL",
      "COLLECTED",
      "TRANSFER_SCANNED",
    ].includes(statusUpper);
    const isActionReq =
      Boolean(b.is_rush_bag) ||
      ["MISROUTED", "MISSING", "RECOVERY_IN_PROGRESS"].includes(statusUpper) ||
      liveBag.risk_score >= 70;
    const isAtRisk =
      !isActionReq &&
      (statusUpper === "AWAITING_SYNC" || liveBag.risk_score >= 35);

    const connStatus: BagTransferConnection["status"] = isCompleted
      ? "transferred"
      : "pending";
    const connAttention: BagTransferConnection["attention"] = isCompleted
      ? "on_track"
      : isActionReq
        ? "action_required"
        : isAtRisk
          ? "at_risk"
          : typeof b.risk_score === "number"
            ? "on_track"
            : "unknown";

    connections.push({
      id: `conn-${b.tag_number}`,
      bagTag: b.tag_number,
      inboundLegId: inLegId,
      outboundLegId: outLegId,
      status: connStatus,
      attention: connAttention,
      deadline: {
        at: new Date(depMs - 20 * 60_000).toISOString(),
        kind: "latest_intervention",
        provenance: makeProv(`deadline:${b.tag_number}`),
      },
      provenance: makeProv(`conn:${b.tag_number}`),
    });

    const hasRisk =
      typeof b.risk_score === "number" && Number.isFinite(b.risk_score);
    bagRisks.push({
      bagTag: b.tag_number,
      status: hasRisk ? "assessed" : "unavailable",
      score: hasRisk ? liveBag.risk_score : null,
      modelVersion: hasRisk ? "cathay-bag-risk-v3.0-hkg-feeder" : null,
      assessedAt: hasRisk ? generatedAt : null,
      validUntil: hasRisk ? validUntil : null,
      evidence: hasRisk
        ? [makeProv(`risk:${b.tag_number}`, "cathay-bag-risk-v3.0-hkg-feeder")]
        : [],
      missingInputs: hasRisk ? [] : ["No persisted baggage risk assessment"],
    });

    const scores = flightBagsMap.get(outLegId) ?? [];
    if (hasRisk) scores.push(liveBag.risk_score);
    flightBagsMap.set(outLegId, scores);
  });

  const flightRisks: FlightRiskAssessment[] = [...legsMap.values()].map(
    (leg) => {
      const scores = flightBagsMap.get(leg.id);
      if (!scores || scores.length === 0) {
        return {
          flightLegId: leg.id,
          status: "unavailable",
          score: null,
          modelVersion: null,
          assessedAt: null,
          validUntil: null,
          evidence: [],
          missingInputs: ["No persisted baggage risk assessment"],
        };
      }
      const maxScore = Math.max(...scores);
      return {
        flightLegId: leg.id,
        status: "assessed",
        score: maxScore,
        modelVersion: "cathay-bag-risk-v3.0-hkg-feeder",
        assessedAt: generatedAt,
        validUntil,
        evidence: [
          makeProv(`fltrisk:${leg.id}`, "cathay-bag-risk-v3.0-hkg-feeder"),
        ],
        missingInputs: [],
      };
    },
  );

  const rawSnapshot: TransferControlSnapshot = {
    availability: "available",
    generatedAt,
    validUntil,
    source: `${sourceLabel} (${bags.length} bags)`,
    missingInputs: [],
    bags,
    legs: [...legsMap.values()],
    connections,
    flightRisks,
    bagRisks,
    transferSuccess: null,
  };

  return validateTransferSnapshot(rawSnapshot);
}

const DEFAULT_API_BASE = "https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1";

export function getLiveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (envUrl && envUrl.length > 0 ? envUrl : DEFAULT_API_BASE).replace(
    /\/$/,
    "",
  );
}

export async function fetchLiveTransferSnapshot(
  signalOrBase?: AbortSignal | string,
): Promise<TransferControlSnapshot> {
  const signal = typeof signalOrBase === "string" ? undefined : signalOrBase;
  const cleanBase =
    typeof signalOrBase === "string" && signalOrBase.trim()
      ? signalOrBase.trim().replace(/\/$/, "")
      : getLiveApiBase();
  const baggageRes = await fetch(`${cleanBase}/baggage/dashboard`, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });

  if (!baggageRes.ok) {
    throw new Error(`Live baggage API returned HTTP ${baggageRes.status}`);
  }

  const bags = (await baggageRes.json()) as BackendBag[];

  return buildLiveTransferSnapshot(
    bags,
    new Date(),
    `Live Cloud Run (${cleanBase})`,
  );
}

export async function fetchLiveRecoveryPerformance(
  filters: PerformanceFilterState,
  signal?: AbortSignal,
): Promise<RecoveryPerformanceReport> {
  const cleanBase = getLiveApiBase();
  const baggageRes = await fetch(`${cleanBase}/baggage/dashboard`, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  if (!baggageRes.ok) {
    throw new Error(`Live baggage API returned HTTP ${baggageRes.status}`);
  }
  const backendBags = (await baggageRes.json()) as BackendBag[];
  const now = new Date();
  const nowMs = now.getTime();
  const validUntil = new Date(nowMs + 10 * 60_000).toISOString();
  const snapshot = buildLiveTransferSnapshot(
    backendBags,
    now,
    `Live Cloud Run (${cleanBase})`,
  );

  const prov: OperationalProvenance = {
    system: "smarttag-cloudrun-rds",
    recordId: "perf-live",
    observedAt: snapshot.generatedAt,
    validUntil,
  };

  const legById = new Map(snapshot.legs.map((l) => [l.id, l]));
  const bagByTag = new Map(snapshot.bags.map((b) => [b.tag_number, b]));
  const episodes: RecoveryEpisodeRecord[] = [];
  const eligibleTransfers: EligibleTransferRecord[] = [];

  for (const conn of snapshot.connections) {
    const outLeg = legById.get(conn.outboundLegId);
    const bag = bagByTag.get(conn.bagTag);
    if (!outLeg || !bag) continue;

    const sortedEvents = [...(bag.events || [])].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    const observedAt =
      sortedEvents[sortedEvents.length - 1]?.timestamp || bag.updated_at;
    const isTransferred = conn.status === "transferred";

    eligibleTransfers.push({
      bagTag: conn.bagTag,
      connectionId: conn.id,
      outboundLegId: outLeg.id,
      outboundFlightNumber: outLeg.flightNumber,
      outboundOperatingDate: outLeg.operatingDate,
      origin: outLeg.origin,
      destination: outLeg.destination,
      station: outLeg.origin,
      observedAt,
      transferred: isTransferred,
      provenance: prov,
    });

    const statusUpper = (bag.status || "").toUpperCase();
    const isExceptionOrRisk =
      conn.attention === "action_required" ||
      conn.attention === "at_risk" ||
      ["MISROUTED", "MISSING", "RECOVERY_IN_PROGRESS", "LOADED"].includes(
        statusUpper,
      );

    if (!isExceptionOrRisk) continue;

    const tDetectIso = sortedEvents[0]?.timestamp || bag.updated_at;
    const tDetectMs = Date.parse(tDetectIso);
    const tActionEv = sortedEvents.find((e) =>
      /TAGGED|SYNCHRONIZED|RECOVERY_IN_PROGRESS/i.test(e.event_type),
    );
    const tLocateEv = sortedEvents.find((e) =>
      /SYNCHRONIZED|LOADED|RECOVERY_IN_PROGRESS/i.test(e.event_type),
    );
    const tLoadEv = sortedEvents.find((e) =>
      /LOADED|IN_TRANSIT|ARRIVED|COLLECTED/i.test(e.event_type),
    );

    const tActionIso =
      tActionEv && Date.parse(tActionEv.timestamp) >= tDetectMs
        ? tActionEv.timestamp
        : null;
    const tLocateIso =
      tActionIso &&
      tLocateEv &&
      Date.parse(tLocateEv.timestamp) >= Date.parse(tActionIso)
        ? tLocateEv.timestamp
        : null;
    const tLoadIso =
      tLocateIso &&
      tLoadEv &&
      Date.parse(tLoadEv.timestamp) >= Date.parse(tLocateIso)
        ? tLoadEv.timestamp
        : null;
    const tTransIso = isTransferred && tLoadIso ? tLoadIso : null;

    const primaryCause =
      statusUpper === "MISROUTED"
        ? "Inbound delay"
        : statusUpper === "MISSING"
          ? "Transfer scan missing"
          : statusUpper === "RECOVERY_IN_PROGRESS"
            ? "Hub congestion"
            : "Short connection";

    episodes.push({
      episodeId: `rds-ep-${conn.id}`,
      bagTag: conn.bagTag,
      connectionId: conn.id,
      inboundLegId: conn.inboundLegId,
      outboundLegId: outLeg.id,
      outboundFlightNumber: outLeg.flightNumber,
      outboundOperatingDate: outLeg.operatingDate,
      origin: outLeg.origin,
      destination: outLeg.destination,
      station: outLeg.origin,
      detectedAt: tDetectIso,
      actionedAt: tActionIso,
      locatedAt: tLocateIso,
      loadedAt: tLoadIso,
      transferredAt: tTransIso,
      loadingCutoffAt: conn.deadline?.at ?? null,
      outcome: isTransferred
        ? "recovered"
        : statusUpper === "MISROUTED" || statusUpper === "MISSING"
          ? "missed"
          : "pending",
      primaryRiskCause: primaryCause,
      riskFactors: [primaryCause],
      provenance: prov,
    });
  }

  return aggregateRecoveryPerformance({
    episodes,
    eligibleTransfers,
    legs: snapshot.legs,
    activeSnapshotLegIds: new Set(snapshot.legs.map((l) => l.id)),
    filters,
    now,
    generatedAt: snapshot.generatedAt,
    validUntil: snapshot.validUntil,
    source: snapshot.source,
  });
}

export interface LiveRiskAssessment {
  risk_score: number;
  risk_level: string;
  priority_sequence: number;
  recommended_action: string;
  passenger_summary?: string | null;
  predicted_arrival_time?: string;
  carousel_estimate?: string;
  model_version?: string;
  factors: string[];
}

export async function recordLiveBagScan(
  apiBase: string,
  tagNumber: string,
  payload: {
    event_type: string;
    location_code: string;
    station_name: string;
    scanner_type?: string;
    staff_id?: string;
    notes?: string;
  },
): Promise<BackendBag> {
  const cleanBase = apiBase.replace(/\/$/, "");
  const res = await fetch(
    `${cleanBase}/baggage/${encodeURIComponent(tagNumber)}/scan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanner_type: "NFC_TAP",
        ...payload,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Baggage scan failed with HTTP ${res.status}`);
  }
  return (await res.json()) as BackendBag;
}

export async function applyLiveBagRisk(
  apiBase: string,
  tagNumber: string,
  features: {
    flight_number: string;
    origin: string;
    destination: string;
    transfer_minutes: number;
    weather_severity: number;
    load_factor_pct: number;
    airport_congestion: number;
  },
): Promise<LiveRiskAssessment> {
  const cleanBase = apiBase.replace(/\/$/, "");
  const res = await fetch(
    `${cleanBase}/baggage/${encodeURIComponent(tagNumber)}/risk/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
    },
  );
  if (!res.ok) {
    throw new Error(`Baggage risk update failed with HTTP ${res.status}`);
  }
  return (await res.json()) as LiveRiskAssessment;
}
