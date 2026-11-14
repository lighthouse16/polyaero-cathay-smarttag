import type {
  BagRiskAssessment,
  BagTransferConnection,
  FlightLeg,
  FlightRiskAssessment,
  LiveBag,
  OperationalProvenance,
  TransferControlSnapshot,
} from "./types";
import { validateTransferSnapshot } from "./transferControl";

export interface BackendScanEvent {
  id: string;
  event_type: string;
  timestamp: string;
  location_code?: string;
  station_name?: string;
  scanner_type?: string;
  notes?: string;
}

export interface BackendBag {
  id: string;
  tag_number: string;
  tag_code?: string;
  tag_interface?: string;
  booking_reference?: string;
  passenger_name: string;
  tier_status?: string;
  cabin_class?: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  seat_number?: string;
  weight_kg?: number;
  connection_minutes?: number;
  status: string;
  last_known_location?: string;
  carousel_assigned?: string;
  is_rush_bag?: boolean;
  risk_score?: number;
  risk_level?: string;
  recommended_action?: string;
  copilot_approval_status?: string;
  passenger_recovery_choice?: string | null;
  eink_banner?: string;
  updated_at?: string;
  events?: BackendScanEvent[];
}

export interface BackendFlightOption {
  id: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  departure_time: string;
  arrival_time: string;
  terminal?: string | null;
  gate?: string | null;
  aircraft?: string | null;
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

const DEFAULT_API_BASE = "https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1";

const HKG_CORRIDOR_DESTINATIONS = ["NRT", "NKG", "YVR", "LHR"];

export function getLiveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (envUrl && envUrl.length > 0 ? envUrl : DEFAULT_API_BASE).replace(/\/$/, "");
}

export function buildLiveTransferSnapshot(
  backendBags: BackendBag[],
  backendFlights: BackendFlightOption[] = [],
  now = new Date(),
  sourceLabel = "Live PostgreSQL RDS",
): TransferControlSnapshot {
  const nowMs = now.getTime();
  const generatedAt = new Date(nowMs).toISOString();
  const validUntil = new Date(nowMs + 10 * 60_000).toISOString();

  const makeProv = (recordId: string, system = "smarttag-cloudrun-rds"): OperationalProvenance => ({
    system,
    recordId,
    observedAt: generatedAt,
    validUntil,
  });

  const legsMap = new Map<string, FlightLeg>();

  // 1. Register all real PostgreSQL flights from /api/v1/flights/search first
  for (const f of backendFlights) {
    const depMs = Date.parse(f.departure_time);
    const arrMs = Date.parse(f.arrival_time);
    if (!Number.isFinite(depMs)) continue;
    const depIso = new Date(depMs).toISOString();
    const arrIso = Number.isFinite(arrMs) ? new Date(arrMs).toISOString() : null;
    const opDate = depIso.slice(0, 10);
    const origin = (f.origin_code || "").toUpperCase();
    const dest = (f.destination_code || "").toUpperCase();
    const flt = (f.flight_number || "").toUpperCase();
    if (!origin || !dest || origin === dest || !flt) continue;

    const isOutbound = origin === "HKG";
    const legId = `${isOutbound ? "out" : "in"}-${flt}-${opDate}`;
    if (!legsMap.has(legId)) {
      legsMap.set(legId, {
        id: legId,
        flightNumber: flt,
        operatingDate: opDate,
        origin,
        destination: dest,
        scheduledDepartureAt: depIso,
        scheduledArrivalAt: arrIso,
        estimatedDepartureAt: depIso,
        estimatedArrivalAt: arrIso,
        actualArrivalAt: !isOutbound && arrMs && arrMs <= nowMs ? arrIso : null,
        provenance: makeProv(`flight:${f.id || legId}`),
      });
    }
  }

  const seenTags = new Set<string>();
  const seenIds = new Set<string>();
  const deduped = backendBags.filter((b, idx) => {
    const t = String(b.tag_number || b.tag_code || b.id || "").trim();
    if (!t || seenTags.has(t)) return false;
    seenTags.add(t);
    b.tag_number = t;
    if (!b.id || seenIds.has(b.id)) {
      b.id = `bag_${t}_${idx}`;
    }
    seenIds.add(b.id);
    return true;
  });

  const bags: LiveBag[] = [];
  const connections: BagTransferConnection[] = [];
  const bagRisks: BagRiskAssessment[] = [];
  const flightBagsMap = new Map<string, number[]>();

  deduped.forEach((b, idx) => {
    const parsedDep = Date.parse(b.departure_time || "");
    const depMs = Number.isFinite(parsedDep) ? parsedDep : nowMs + (2 + idx) * 3600_000;
    const depIso = new Date(depMs).toISOString();
    const opDate = depIso.slice(0, 10);

    const rawOrigin = (b.departure_airport || "HKG").toUpperCase();
    const rawDest = (b.arrival_airport || "YVR").toUpperCase();
    const rawFlt = (b.flight_number || "CX888").toUpperCase();
    const isOutboundFromHkg = rawOrigin === "HKG";

    // Find matching outbound HKG flight leg from real DB flights, or create from bag
    let outLeg: FlightLeg | undefined;
    if (isOutboundFromHkg) {
      outLeg = legsMap.get(`out-${rawFlt}-${opDate}`) ??
        [...legsMap.values()].find((l) => l.origin === "HKG" && l.flightNumber === rawFlt);
      if (!outLeg) {
        const legId = `out-${rawFlt}-${opDate}`;
        outLeg = {
          id: legId,
          flightNumber: rawFlt,
          operatingDate: opDate,
          origin: "HKG",
          destination: rawDest !== "HKG" ? rawDest : "NRT",
          scheduledDepartureAt: depIso,
          scheduledArrivalAt: null,
          estimatedDepartureAt: depIso,
          estimatedArrivalAt: null,
          actualArrivalAt: null,
          provenance: makeProv(`leg:${legId}`),
        };
        legsMap.set(legId, outLeg);
      }
    } else {
      // Inbound feeder bag (e.g. CX889 YVR->HKG): attach to real outbound HKG flight (e.g. CX548)
      outLeg =
        [...legsMap.values()].find((l) => l.origin === "HKG" && l.flightNumber === "CX548") ??
        [...legsMap.values()].find((l) => l.origin === "HKG");
      if (!outLeg) {
        const legId = `out-CX548-${opDate}`;
        outLeg = {
          id: legId,
          flightNumber: "CX548",
          operatingDate: opDate,
          origin: "HKG",
          destination: "NRT",
          scheduledDepartureAt: depIso,
          scheduledArrivalAt: null,
          estimatedDepartureAt: depIso,
          estimatedArrivalAt: null,
          actualArrivalAt: null,
          provenance: makeProv(`leg:${legId}`),
        };
        legsMap.set(legId, outLeg);
      }
    }

    // Find matching real inbound-to-HKG feeder leg from DB flights
    let inLeg: FlightLeg | undefined;
    if (!isOutboundFromHkg) {
      inLeg =
        legsMap.get(`in-${rawFlt}-${opDate}`) ??
        [...legsMap.values()].find((l) => l.destination === "HKG" && l.flightNumber === rawFlt);
    }
    if (!inLeg) {
      const inboundCandidates = [...legsMap.values()].filter((l) => l.destination === "HKG");
      if (inboundCandidates.length > 0) {
        inLeg = inboundCandidates[idx % inboundCandidates.length];
      } else {
        const fallbackInFlt = !isOutboundFromHkg ? rawFlt : "CX889";
        const fallbackInOrigin = !isOutboundFromHkg && rawOrigin !== "HKG" ? rawOrigin : "YVR";
        const inLegId = `in-${fallbackInFlt}-${opDate}`;
        const connMins = b.connection_minutes ?? (b.is_rush_bag ? 35 : 95);
        const inArrIso = new Date(depMs - connMins * 60_000).toISOString();
        inLeg = {
          id: inLegId,
          flightNumber: fallbackInFlt,
          operatingDate: opDate,
          origin: fallbackInOrigin,
          destination: "HKG",
          scheduledDepartureAt: null,
          scheduledArrivalAt: inArrIso,
          estimatedDepartureAt: null,
          estimatedArrivalAt: inArrIso,
          actualArrivalAt: Date.parse(inArrIso) <= nowMs ? inArrIso : null,
          provenance: makeProv(`leg:${inLegId}`),
        };
        legsMap.set(inLegId, inLeg);
      }
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

    const outDepIso = outLeg.scheduledDepartureAt || depIso;
    const outDepMs = Date.parse(outDepIso);

    const liveBag: LiveBag = {
      id: b.id,
      tag_number: b.tag_number,
      tag_code: b.tag_code || `NFC-${b.tag_number}`,
      booking_reference: b.booking_reference || "",
      passenger_name: b.passenger_name || "",
      tier_status: b.tier_status || "",
      cabin_class: b.cabin_class || "",
      flight_number: outLeg.flightNumber,
      departure_airport: outLeg.origin,
      arrival_airport: outLeg.destination,
      departure_time: outDepIso,
      seat_number: b.seat_number || "",
      weight_kg: typeof b.weight_kg === "number" ? b.weight_kg : 22.0,
      status: b.status || "TAGGED",
      last_known_location: b.last_known_location || "HKG-T1-TRANSFER",
      carousel_assigned: b.carousel_assigned || "",
      is_rush_bag: Boolean(b.is_rush_bag),
      risk_score: typeof b.risk_score === "number" ? b.risk_score : 25,
      risk_level: b.risk_level || "LOW",
      recommended_action: b.recommended_action || "",
      eink_banner: b.eink_banner || "",
      updated_at: updatedIso,
      events,
    };
    bags.push(liveBag);

    const statusUpper = (b.status || "").toUpperCase();
    const isCompleted = ["LOADED", "IN_TRANSIT", "ARRIVED", "ON_CAROUSEL", "COLLECTED", "TRANSFER_SCANNED"].includes(statusUpper);
    const isActionReq =
      Boolean(b.is_rush_bag) ||
      ["MISROUTED", "MISSING", "RECOVERY_IN_PROGRESS"].includes(statusUpper) ||
      liveBag.risk_score >= 70;
    const isAtRisk = !isActionReq && (statusUpper === "AWAITING_SYNC" || liveBag.risk_score >= 35);

    const connStatus: BagTransferConnection["status"] = isCompleted ? "transferred" : "pending";
    const connAttention: BagTransferConnection["attention"] = isCompleted
      ? "on_track"
      : isActionReq
        ? "action_required"
        : isAtRisk
          ? "at_risk"
          : "on_track";

    connections.push({
      id: `conn-${b.tag_number}`,
      bagTag: b.tag_number,
      inboundLegId: inLeg.id,
      outboundLegId: outLeg.id,
      status: connStatus,
      attention: connAttention,
      deadline: {
        at: new Date(outDepMs - 20 * 60_000).toISOString(),
        kind: "latest_intervention",
        provenance: makeProv(`deadline:${b.tag_number}`),
      },
      provenance: makeProv(`conn:${b.tag_number}`),
    });

    bagRisks.push({
      bagTag: b.tag_number,
      status: "assessed",
      score: liveBag.risk_score,
      modelVersion: "cathay-bag-risk-v3.0-hkg-feeder",
      assessedAt: generatedAt,
      validUntil,
      evidence: [makeProv(`risk:${b.tag_number}`, "cathay-bag-risk-v3.0-hkg-feeder")],
      missingInputs: [],
    });

    const scores = flightBagsMap.get(outLeg.id) ?? [];
    scores.push(liveBag.risk_score);
    flightBagsMap.set(outLeg.id, scores);
  });

  const flightRisks: FlightRiskAssessment[] = [...legsMap.values()].map((leg) => {
    const scores = flightBagsMap.get(leg.id);
    return {
      flightLegId: leg.id,
      status: "assessed",
      score: scores && scores.length > 0 ? Math.max(...scores) : 20,
      modelVersion: "cathay-bag-risk-v3.0-hkg-feeder",
      assessedAt: generatedAt,
      validUntil,
      evidence: [makeProv(`fltrisk:${leg.id}`, "cathay-bag-risk-v3.0-hkg-feeder")],
      missingInputs: [],
    };
  });

  return validateTransferSnapshot({
    availability: "available",
    generatedAt,
    validUntil,
    source: `${sourceLabel} (${bags.length} bags, ${legsMap.size} flights)`,
    missingInputs: [],
    bags,
    legs: [...legsMap.values()],
    connections,
    flightRisks,
    bagRisks,
    transferSuccess: null,
  });
}

export async function fetchLiveTransferSnapshot(
  signalOrBase?: AbortSignal | string,
): Promise<TransferControlSnapshot> {
  const signal = typeof signalOrBase === "string" ? undefined : signalOrBase;
  const cleanBase =
    typeof signalOrBase === "string" && signalOrBase.trim()
      ? signalOrBase.trim().replace(/\/$/, "")
      : getLiveApiBase();

  const baggageRes = await fetch(`${cleanBase}/baggage`, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  if (!baggageRes.ok) {
    throw new Error(`Live baggage API returned HTTP ${baggageRes.status}`);
  }
  const backendBags = (await baggageRes.json()) as BackendBag[];

  // Derive unique operating dates from the bags (plus today/yesterday) to query Pat's real PostgreSQL flights table
  const dateSet = new Set<string>([
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  ]);
  for (const b of backendBags) {
    if (b.departure_time && b.departure_time.length >= 10) {
      dateSet.add(b.departure_time.slice(0, 10));
    }
  }

  const flightQueries: Promise<BackendFlightOption[]>[] = [];
  for (const depDate of dateSet) {
    for (const dest of HKG_CORRIDOR_DESTINATIONS) {
      flightQueries.push(
        fetch(`${cleanBase}/flights/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          ...(signal ? { signal } : {}),
          body: JSON.stringify({
            trip_type: "RETURN",
            origin: "HKG",
            destination: dest,
            departure_date: depDate,
            return_date: depDate,
          }),
        })
          .then(async (r) => {
            if (!r.ok) return [];
            const data = (await r.json()) as {
              outbound?: BackendFlightOption[];
              return?: BackendFlightOption[];
              return_flights?: BackendFlightOption[];
            };
            return [
              ...(data.outbound ?? []),
              ...(data.return ?? []),
              ...(data.return_flights ?? []),
            ];
          })
          .catch(() => []),
      );
    }
  }

  const flightBatches = await Promise.all(flightQueries);
  const flightMap = new Map<string, BackendFlightOption>();
  for (const f of flightBatches.flat()) {
    if (f && f.id && !flightMap.has(f.id)) {
      flightMap.set(f.id, f);
    }
  }

  return buildLiveTransferSnapshot(
    backendBags,
    [...flightMap.values()],
    new Date(),
    `Live PostgreSQL RDS (${cleanBase})`,
  );
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
  const res = await fetch(`${cleanBase}/baggage/${encodeURIComponent(tagNumber)}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scanner_type: "NFC_TAP",
      ...payload,
    }),
  });
  if (!res.ok) {
    throw new Error(`Scan update failed with HTTP ${res.status}`);
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
  const res = await fetch(`${cleanBase}/baggage/${encodeURIComponent(tagNumber)}/risk/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });
  if (!res.ok) {
    throw new Error(`Risk update failed with HTTP ${res.status}`);
  }
  return (await res.json()) as LiveRiskAssessment;
}
