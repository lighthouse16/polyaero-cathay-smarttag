import { NextResponse } from "next/server";
import {
  applyLiveBagRisk,
  getLiveApiBase,
  recordLiveBagScan,
} from "../../../../../../lib/liveTransferAdapter";

export const dynamic = "force-dynamic";

const CLOUDRUN_EVENT_ALIASES: Record<string, string> = {
  TRANSFER_SCANNED: "TAG_TAPPED",
  TRANSFER_SCAN: "TAG_TAPPED",
  PRIORITY_TRANSFER: "MISROUTED",
  CLAIMED: "COLLECTED",
};

const VALID_CLOUDRUN_EVENTS = new Set([
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
  "SYNCHRONIZED",
  "TAG_TAPPED",
]);

function normalizeActionEventType(raw: unknown): string {
  const upper = String(raw || "TAG_TAPPED").trim().toUpperCase();
  const mapped = CLOUDRUN_EVENT_ALIASES[upper] ?? upper;
  return VALID_CLOUDRUN_EVENTS.has(mapped) ? mapped : "TAG_TAPPED";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tag: string }> },
): Promise<NextResponse> {
  if (process.env.STAFF_LIVE_BACKEND !== "1") {
    return NextResponse.json(
      { detail: "Live backend mode is disabled (set STAFF_LIVE_BACKEND=1)" },
      { status: 503 },
    );
  }

  const { tag } = await context.params;
  const tagNumber = decodeURIComponent(tag || "").trim();
  if (!tagNumber) {
    return NextResponse.json({ detail: "Missing bag tag number" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const apiBase = getLiveApiBase();

    if (action === "scan") {
      const eventType = normalizeActionEventType(body.event_type);
      const locationCode = String(body.location_code || "HKG-T1-TRANSFER").trim();
      const stationName = String(body.station_name || "HKIA T1 Transfer Hub").trim();
      const notes = body.notes ? String(body.notes) : undefined;
      const updated = await recordLiveBagScan(apiBase, tagNumber, {
        event_type: eventType,
        location_code: locationCode,
        station_name: stationName,
        scanner_type: "NFC_TAP",
        staff_id: "HKG-OPS-01",
        ...(notes ? { notes } : {}),
      });
      return NextResponse.json({ ok: true, action: "scan", bag: updated });
    }

    if (action === "risk") {
      const assessment = await applyLiveBagRisk(apiBase, tagNumber, {
        flight_number: String(body.flight_number || "CX548"),
        origin: String(body.origin || "HKG"),
        destination: String(body.destination || "NRT"),
        transfer_minutes: Number(body.transfer_minutes ?? 35),
        weather_severity: Number(body.weather_severity ?? 2),
        load_factor_pct: Number(body.load_factor_pct ?? 85),
        airport_congestion: Number(body.airport_congestion ?? 2),
      });
      return NextResponse.json({ ok: true, action: "risk", assessment });
    }

    return NextResponse.json({ detail: "Unsupported action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend action failed";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
