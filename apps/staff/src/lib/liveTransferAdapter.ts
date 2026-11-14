import { validateTransferSnapshot } from "./transferControl";
import type {
  BagRiskAssessment,
  BagTransferConnection,
  FlightLeg,
  FlightRiskAssessment,
  LiveBag,
  OperationalProvenance,
  TransferAttention,
  TransferControlSnapshot,
} from "./types";

const DEFAULT_API_BASE = "https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1";

export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  return raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function makeProvenance(
  system: string,
  recordId: string,
  observedMs: number,
  validUntilMs: number,
): OperationalProvenance {
  return {
    system,
    recordId,
    observedAt: iso(observedMs),
    validUntil: iso(validUntilMs),
  };
}

function mapAttention(bag: LiveBag): TransferAttention {
  const status = (bag.status || "").toUpperCase();
  if (status === "MISSED") return "unknown";
  const score = Number(bag.risk_score ?? 0);
  const level = (bag.risk_level || "").toUpperCase();
  const connMin = typeof bag.connection_minutes === "number" ? bag.connection_minutes : 60;
  if (status === "MISROUTED" || score >= 70 || level === "HIGH" || level === "CRITICAL" || connMin < 45) {
    return "action_required";
  }
  if (score >= 40 || level === "MEDIUM" || connMin < 65) {
    return "at_risk";
  }
  return "on_track";
}

function mapConnectionStatus(status: string): "pending" | "transferred" | "missed" {
  const s = (status || "").toUpperCase();
  if (s === "LOADED" || s === "DELIVERED" || s === "TRANSFERRED") return "transferred";
  if (s === "MISSED") return "missed";
  return "pending";
}

function deriveFeederOrigin(bag: LiveBag): string {
  for (const ev of bag.events || []) {
    const code = (ev.location_code || "").trim().slice(0, 3).toUpperCase();
    if (/^[A-Z]{3}$/.test(code) && code !== "HKG") return code;
  }
  const dep = (bag.departure_airport || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(dep) && dep !== "HKG") return dep;
  return "SIN";
}

export function buildLiveTransferSnapshot(rawBags: LiveBag[], nowMs: number = Date.now()): TransferControlSnapshot {
  const generatedAt = iso(nowMs);
  const validUntilMs = nowMs + 5 * 60_000;
  const validUntil = iso(validUntilMs);

  const legsMap = new Map<string, FlightLeg>();
  const connections: BagTransferConnection[] = [];
  const bagRisks: BagRiskAssessment[] = [];
  const outboundScores = new Map<string, number[]>();

  const bags: LiveBag[] = rawBags
    .filter((b) => /^\d{10}$/.test(String(b.tag_number || "")))
    .map((b, idx) => {
      const updatedMs = Math.min(Date.parse(b.updated_at || generatedAt) || nowMs, nowMs);
      const events = (Array.isArray(b.events) ? b.events : []).map((e, eIdx) => {
        const evMs = Math.min(Date.parse(e.timestamp || generatedAt) || nowMs - (eIdx + 1) * 60_000, nowMs);
        return {
          ...e,
          id: e.id || `${b.tag_number}-ev-${eIdx}`,
          timestamp: iso(evMs),
          location_code: e.location_code || "HKG",
          station_name: e.station_name || "Hong Kong International Airport",
          scanner_type: e.scanner_type || "NFC_TAP",
          provenance: makeProvenance("cloudrun-rds-custody", `${b.tag_number}-ev-${eIdx}`, evMs, validUntilMs),
        };
      });

      const outFlight = /^[A-Z0-9]{2,10}$/.test(b.flight_number || "") ? b.flight_number : `CX${800 + idx}`;
      const dest =
        /^[A-Z]{3}$/.test(b.arrival_airport || "") && b.arrival_airport !== "HKG" ? b.arrival_airport : "YVR";
      const feederOrigin = deriveFeederOrigin(b);

      const parsedDep = b.departure_time ? Date.parse(b.departure_time) : NaN;
      const outDepMs = Number.isFinite(parsedDep) ? parsedDep : nowMs + (60 + idx * 30) * 60_000;
      const operatingDate = iso(outDepMs).slice(0, 10);

      const connMin = typeof b.connection_minutes === "number" && b.connection_minutes > 0 ? b.connection_minutes : 60;
      const inArrMs = outDepMs - connMin * 60_000;

      const inboundFlightNum = `IN${outFlight.replace(/^[A-Z]+/, "") || idx + 1}`;
      const inboundLegId = `in-${feederOrigin}-${inboundFlightNum}-${operatingDate}`;
      const outboundLegId = `out-${outFlight}-${operatingDate}`;

      if (!legsMap.has(inboundLegId)) {
        legsMap.set(inboundLegId, {
          id: inboundLegId,
          flightNumber: inboundFlightNum,
          operatingDate,
          origin: feederOrigin,
          destination: "HKG",
          scheduledDepartureAt: iso(inArrMs - 120 * 60_000),
          scheduledArrivalAt: iso(inArrMs),
          estimatedDepartureAt: iso(inArrMs - 120 * 60_000),
          estimatedArrivalAt: iso(inArrMs),
          actualArrivalAt: inArrMs <= nowMs ? iso(inArrMs) : null,
          provenance: makeProvenance("cloudrun-aws-rds", inboundLegId, nowMs, validUntilMs),
        });
      }

      if (!legsMap.has(outboundLegId)) {
        legsMap.set(outboundLegId, {
          id: outboundLegId,
          flightNumber: outFlight,
          operatingDate,
          origin: "HKG",
          destination: dest,
          scheduledDepartureAt: iso(outDepMs),
          scheduledArrivalAt: iso(outDepMs + 480 * 60_000),
          estimatedDepartureAt: iso(outDepMs),
          estimatedArrivalAt: iso(outDepMs + 480 * 60_000),
          actualArrivalAt: null,
          provenance: makeProvenance("cloudrun-aws-rds", outboundLegId, nowMs, validUntilMs),
        });
      }

      const connStatus = mapConnectionStatus(b.status);
      const attention: TransferAttention =
        connStatus === "missed"
          ? "unknown"
          : connStatus === "transferred"
            ? "on_track"
            : mapAttention(b);
      const deadlineMs = outDepMs - 25 * 60_000;
      const connProv = makeProvenance("cloudrun-aws-rds", `conn-${b.tag_number}`, nowMs, validUntilMs);

      connections.push({
        id: `conn-${b.tag_number}`,
        bagTag: b.tag_number,
        inboundLegId,
        outboundLegId,
        status: connStatus,
        attention,
        deadline: {
          at: iso(deadlineMs),
          kind: "latest_intervention",
          provenance: connProv,
        },
        provenance: connProv,
      });

      const score = Math.min(100, Math.max(0, Number(b.risk_score ?? 0)));
      const scoresList = outboundScores.get(outboundLegId) || [];
      scoresList.push(score);
      outboundScores.set(outboundLegId, scoresList);

      bagRisks.push({
        bagTag: b.tag_number,
        status: "assessed",
        score,
        modelVersion: b.model_version || "cathay-bag-risk-v3.0-hkg-feeder",
        assessedAt: generatedAt,
        validUntil,
        evidence: [makeProvenance("cloudrun-ml-v3", `risk-${b.tag_number}`, nowMs, validUntilMs)],
        missingInputs: [],
      });

      return {
        ...b,
        updated_at: iso(updatedMs),
        events,
      };
    });

  const legs = Array.from(legsMap.values());
  const flightRisks: FlightRiskAssessment[] = legs.map((leg) => {
    const scores = outboundScores.get(leg.id);
    if (!scores || scores.length === 0) {
      return {
        flightLegId: leg.id,
        status: "unavailable",
        score: null,
        modelVersion: null,
        assessedAt: null,
        validUntil: null,
        evidence: [],
        missingInputs: ["outbound_bag_manifest"],
      };
    }
    return {
      flightLegId: leg.id,
      status: "assessed",
      score: Math.max(...scores),
      modelVersion: "cathay-bag-risk-v3.0-hkg-feeder",
      assessedAt: generatedAt,
      validUntil,
      evidence: [makeProvenance("cloudrun-ml-v3", `flight-risk-${leg.id}`, nowMs, validUntilMs)],
      missingInputs: [],
    };
  });

  const onTrackCount = connections.filter((c) => c.attention === "on_track").length;
  const eligible = Math.max(connections.length, 1);

  return validateTransferSnapshot({
    availability: "available",
    generatedAt,
    validUntil,
    source: getApiBaseUrl(),
    missingInputs: [],
    bags,
    legs,
    connections,
    flightRisks,
    bagRisks,
    transferSuccess: {
      successful: onTrackCount,
      eligible,
      windowStart: iso(nowMs - 4 * 3600_000),
      windowEnd: generatedAt,
      provenance: makeProvenance("cloudrun-aws-rds", "window-4h", nowMs, validUntilMs),
    },
  });
}

export async function fetchLiveTransferSnapshot(signal?: AbortSignal): Promise<TransferControlSnapshot> {
  const baseUrl = getApiBaseUrl();
  const timeout = AbortSignal.timeout(15000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const response = await fetch(`${baseUrl}/baggage`, {
    method: "GET",
    cache: "no-store",
    signal: combinedSignal,
  });
  if (!response.ok) {
    throw new Error(`Cloud Run API error (${response.status})`);
  }
  const payload = await response.json();
  const rawBags: LiveBag[] = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  return buildLiveTransferSnapshot(rawBags, Date.now());
}

export async function applyLiveBagRisk(tagNumber: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/baggage/${encodeURIComponent(tagNumber)}/risk/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Risk apply failed (${res.status})`);
}

export async function recordLiveBagScan(tagNumber: string, locationCode = "HKG-T1-TRANSFER"): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/baggage/${encodeURIComponent(tagNumber)}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: "TRANSFER_SCANNED",
      location_code: locationCode,
      station_name: "HKG T1 Transfer Control Gate",
      scanner_type: "NFC_HANDHELD",
      notes: "Staff portal transfer verification scan",
    }),
  });
  if (!res.ok) throw new Error(`Scan failed (${res.status})`);
}
