import type {
  AttentionLevel,
  BagRecord,
  BaggageMilestone,
  FlightLeg,
  ScanEvent,
  TransferConnection,
  TransferSnapshot,
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

interface TagDisplayPayload {
  tag: string;
  tag_code: string;
  bag_number: string | null;
  pnr: string | null;
  flight: string | null;
  origin: string | null;
  destination: string | null;
  departure?: string | null;
  gate?: string | null;
  passenger: string | null;
  cabin: string | null;
  weight_kg: number | null;
  barcode: string | null;
  status: string;
  banner: string;
  is_rush: boolean;
  sync_state: string;
  updated_at: string;
}

const VALID_MILESTONES = new Set<BaggageMilestone>([
  "AWAITING_SYNC",
  "CHECKED_IN",
  "TAGGED",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED",
  "ON_CAROUSEL",
  "COLLECTED",
  "MISROUTED",
  "MISSING",
  "RECOVERY_IN_PROGRESS",
]);

const FEEDER_POOL = [
  { flightNumber: "CX467", origin: "TPE", gate: "64" },
  { flightNumber: "CX714", origin: "SIN", gate: "23" },
  { flightNumber: "CX750", origin: "BKK", gate: "42" },
  { flightNumber: "CX906", origin: "MNL", gate: "22" },
  { flightNumber: "CX365", origin: "PVG", gate: "26" },
];

function mapMilestone(status: string): BaggageMilestone {
  const upper = (status || "").toUpperCase();
  if (VALID_MILESTONES.has(upper as BaggageMilestone)) {
    return upper as BaggageMilestone;
  }
  if (upper === "TRANSFER_SCANNED" || upper === "SYNCHRONIZED" || upper === "TAG_TAPPED") {
    return "LOADED";
  }
  return "TAGGED";
}

function mapAttention(bag: BackendBag): AttentionLevel {
  const status = (bag.status || "").toUpperCase();
  if (
    bag.is_rush_bag ||
    status === "MISROUTED" ||
    status === "MISSING" ||
    status === "RECOVERY_IN_PROGRESS" ||
    (bag.risk_score !== undefined && bag.risk_score >= 70)
  ) {
    return "Action required";
  }
  if (
    status === "AWAITING_SYNC" ||
    (bag.risk_score !== undefined && bag.risk_score >= 35)
  ) {
    return "At risk";
  }
  return "On track";
}

function mapDisplayToBackendBag(d: TagDisplayPayload, idx: number): BackendBag | null {
  const tagNumber = (d.bag_number || d.barcode || d.tag_code || "").trim();
  const flightNumber = (d.flight || "").trim();
  const origin = (d.origin || "").trim().toUpperCase();
  const destination = (d.destination || "").trim().toUpperCase();
  if (!tagNumber || !flightNumber || !origin || !destination) return null;

  const isOutboundFromHkg = origin === "HKG";
  const outboundFlight = isOutboundFromHkg ? flightNumber : "CX255";
  const outboundDest = isOutboundFromHkg ? destination : "NRT";
  const statusUpper = (d.status || "TAGGED").toUpperCase();
  const isRush = Boolean(d.is_rush) || ["MISROUTED", "MISSING", "RECOVERY_IN_PROGRESS"].includes(statusUpper);

  return {
    id: d.tag || `seed_bag_${idx}`,
    tag_number: tagNumber,
    tag_code: d.tag_code,
    tag_interface: "SMARTTAG_EINK_EXCLUSIVE",
    booking_reference: d.pnr || `SD${idx}`,
    passenger_name: d.passenger || `PASSENGER/${idx + 1}`,
    tier_status: idx % 4 === 3 ? "DIAMOND" : idx % 4 === 2 ? "GOLD" : "SILVER",
    cabin_class: d.cabin || "ECONOMY",
    flight_number: outboundFlight,
    departure_airport: "HKG",
    arrival_airport: outboundDest,
    departure_time: d.departure || new Date(Date.now() + (2 + idx) * 3600_000).toISOString(),
    seat_number: `${12 + idx}A`,
    weight_kg: d.weight_kg ?? 20 + idx,
    connection_minutes: isRush ? 38 : 95,
    status: statusUpper,
    last_known_location: isOutboundFromHkg ? `HKG-T1-GATE-${d.gate || "24"}` : `${origin}-INBOUND-${flightNumber}`,
    carousel_assigned: `Carousel ${(idx % 6) + 2}`,
    is_rush_bag: isRush,
    risk_score: statusUpper === "MISSING" ? 91 : statusUpper === "MISROUTED" ? 84 : statusUpper === "RECOVERY_IN_PROGRESS" ? 74 : 22 + idx * 3,
    risk_level: isRush ? "HIGH_PRIORITY" : "LOW",
    recommended_action: isRush
      ? "APPROVE RAMP INTERCEPT & OFFER PASSENGER RECOVERY OPTIONS"
      : "STANDARD DIGITAL ITINERARY FLOW",
    copilot_approval_status: isRush ? "PENDING_STAFF_APPROVAL" : "AUTO_CLEARED",
    passenger_recovery_choice: null,
    eink_banner: d.banner || statusUpper.replace(/_/g, " "),
    updated_at: d.updated_at || new Date().toISOString(),
    events: [
      {
        id: `evt_${d.tag_code}_1`,
        event_type: statusUpper,
        timestamp: d.updated_at || new Date().toISOString(),
        location_code: isOutboundFromHkg ? `HKG-T1-GATE-${d.gate || "24"}` : `${origin}-FEEDER`,
        station_name: isOutboundFromHkg
          ? `HKIA T1 Gate ${d.gate || "24"} (${d.tag_code})`
          : `Inbound Feeder ${flightNumber} (${origin} -> HKG)`,
        scanner_type: "NFC_TAP",
        notes: `${d.tag_code} · PNR ${d.pnr || "SEED"} · ${d.banner || statusUpper}`,
      },
    ],
  };
}

function utcDateTag(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildLiveTransferSnapshot(
  backendBags: BackendBag[],
  now = new Date(),
  sourceDetail = "Connected to live backend baggage & SmartTag telemetry.",
): TransferSnapshot {
  const nowMs = now.getTime();
  const seenTags = new Set<string>();
  const validBags = backendBags.filter((b) => {
    const t = String(b.tag_number || "").trim();
    if (!t || seenTags.has(t)) return false;
    seenTags.add(t);
    return true;
  });

  const outboundLegs = new Map<string, FlightLeg>();
  const inboundLegs = new Map<string, FlightLeg>();
  const bags: BagRecord[] = [];
  const connections: TransferConnection[] = [];

  validBags.forEach((b, idx) => {
    const depDate = new Date(b.departure_time || nowMs + 3 * 3600_000);
    const depMs = Number.isFinite(depDate.getTime()) ? depDate.getTime() : nowMs + 3 * 3600_000;
    const opDate = new Date(depMs).toISOString().slice(0, 10);
    const outFlightKey = `${b.flight_number}-${opDate}`;

    if (!outboundLegs.has(outFlightKey)) {
      outboundLegs.set(outFlightKey, {
        id: `out-${outFlightKey}`,
        flightNumber: b.flight_number,
        operatingDate: opDate,
        origin: b.departure_airport || "HKG",
        destination: b.arrival_airport || "NRT",
        scheduledDepartureAt: new Date(depMs).toISOString(),
        estimatedDepartureAt: new Date(depMs).toISOString(),
        gate: idx % 3 === 0 ? "36" : idx % 3 === 1 ? "64" : "24",
        stand: `S${20 + (idx % 12)}`,
        status: b.is_rush_bag ? "Delayed" : "Boarding",
      });
    }
    const outLeg = outboundLegs.get(outFlightKey)!;

    const feeder = FEEDER_POOL[idx % FEEDER_POOL.length];
    const inFlightKey = `${feeder.flightNumber}-${opDate}`;
    const connMins = b.connection_minutes ?? (b.is_rush_bag ? 35 : 95);
    const inArrivalMs = depMs - connMins * 60_000;

    if (!inboundLegs.has(inFlightKey)) {
      inboundLegs.set(inFlightKey, {
        id: `in-${inFlightKey}`,
        flightNumber: feeder.flightNumber,
        operatingDate: opDate,
        origin: feeder.origin,
        destination: "HKG",
        scheduledArrivalAt: new Date(inArrivalMs).toISOString(),
        estimatedArrivalAt: new Date(inArrivalMs + (b.is_rush_bag ? 18 * 60_000 : 0)).toISOString(),
        gate: feeder.gate,
        stand: `N${10 + (idx % 8)}`,
        status: b.is_rush_bag ? "Delayed" : "Landed",
      });
    }
    const inLeg = inboundLegs.get(inFlightKey)!;

    const rawEvents = Array.isArray(b.events) ? b.events : [];
    const scanHistory: ScanEvent[] = rawEvents.map((e, eIdx) => {
      const parsedTs = Date.parse(e.timestamp);
      const safeTs = Number.isFinite(parsedTs) ? Math.min(parsedTs, nowMs) : nowMs - (rawEvents.length - eIdx) * 300_000;
      return {
        id: e.id || `${b.tag_number}-evt-${eIdx}`,
        at: new Date(safeTs).toISOString(),
        milestone: mapMilestone(e.event_type),
        location: e.station_name || e.location_code || "HKG Transfer Control",
        source: (e.scanner_type as ScanEvent["source"]) || "NFC_TAP",
        detail: e.notes || e.event_type,
      };
    });

    if (scanHistory.length === 0) {
      scanHistory.push({
        id: `${b.tag_number}-init`,
        at: new Date(Math.min(Date.parse(b.updated_at || "") || nowMs, nowMs)).toISOString(),
        milestone: mapMilestone(b.status),
        location: b.last_known_location || "HKG Terminal 1",
        source: "NFC_TAP",
        detail: b.recommended_action || "Live SmartTag telemetry",
      });
    }

    const lastScan = scanHistory[scanHistory.length - 1];
    const attention = mapAttention(b);
    const riskScore = b.risk_score ?? (attention === "Action required" ? 84 : attention === "At risk" ? 45 : 20);

    bags.push({
      tagNumber: b.tag_number,
      pnr: b.booking_reference || "CX0000",
      passengerName: b.passenger_name || "PASSENGER",
      tier: b.tier_status || "GREEN",
      cabin: b.cabin_class || "ECONOMY",
      seat: b.seat_number || "14A",
      weightKg: b.weight_kg ?? 22.0,
      specialHandling: b.is_rush_bag ? ["RUSH", "SHORT_CONN"] : [],
      milestone: mapMilestone(b.status),
      attention,
      riskScore,
      riskLevel: b.risk_level || (riskScore >= 70 ? "HIGH_PRIORITY" : riskScore >= 35 ? "MEDIUM" : "LOW"),
      recommendedAction: b.recommended_action || "Standard transfer flow",
      lastScanAt: lastScan.at,
      lastLocation: b.last_known_location || lastScan.location,
      outboundLegId: outLeg.id,
      inboundLegId: inLeg.id,
      scanHistory,
    });

    const cutoffMs = depMs - 20 * 60_000;
    connections.push({
      id: `conn-${b.tag_number}`,
      bagTag: b.tag_number,
      inboundLegId: inLeg.id,
      outboundLegId: outLeg.id,
      connectionMinutes: connMins,
      minimumConnectionMinutes: 45,
      cutoffAt: new Date(cutoffMs).toISOString(),
      actionByAt: new Date(cutoffMs - 10 * 60_000).toISOString(),
      transferDistanceMinutes: 14,
      attention,
      riskScore,
      recommendedAction:
        b.recommended_action ||
        (attention === "Action required"
          ? "Dispatch airside transfer runner for tail-to-tail intercept"
          : "Monitor standard BHS transfer belt"),
    });
  });

  const rawSnapshot: TransferSnapshot = {
    hub: "HKG",
    generatedAt: new Date(nowMs).toISOString(),
    source: {
      mode: "live",
      label: "Live backend API",
      detail: `${sourceDetail} (${bags.length} active transfer bags)`,
    },
    legs: [...outboundLegs.values(), ...inboundLegs.values()],
    bags,
    connections,
  };

  return validateTransferSnapshot(rawSnapshot, now);
}

export async function fetchLiveTransferSnapshot(apiBase: string): Promise<TransferSnapshot> {
  const cleanBase = apiBase.replace(/\/$/, "");
  const todayTag = utcDateTag(new Date());
  const yesterdayTag = utcDateTag(new Date(Date.now() - 86_400_000));
  const seedIndices = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09"];

  const [baggageRes, ...seedResults] = await Promise.all([
    fetch(`${cleanBase}/baggage`, { cache: "no-store" }),
    ...seedIndices.map(async (idx) => {
      for (const dayStr of [todayTag, yesterdayTag]) {
        try {
          const r = await fetch(`${cleanBase}/tags/SEED-${dayStr}-${idx}/display`, {
            cache: "no-store",
          });
          if (r.ok) {
            return (await r.json()) as TagDisplayPayload;
          }
        } catch {
          // ignore individual seed miss
        }
      }
      return null;
    }),
  ]);

  if (!baggageRes.ok) {
    throw new Error(`Live baggage API returned HTTP ${baggageRes.status}`);
  }

  const liveDemoBags = (await baggageRes.json()) as BackendBag[];
  const seededBags: BackendBag[] = seedResults
    .map((item, idx) => (item ? mapDisplayToBackendBag(item, idx) : null))
    .filter((b): b is BackendBag => b !== null);

  return buildLiveTransferSnapshot(
    [...liveDemoBags, ...seededBags],
    new Date(),
    `Connected to ${cleanBase}`,
  );
}
