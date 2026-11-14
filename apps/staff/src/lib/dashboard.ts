import type { LiveBag } from "./types";
import { isAtRiskBag, isExceptionBag } from "./utils";

export function validateBags(value: unknown): LiveBag[] {
  if (!Array.isArray(value)) throw new Error("Invalid baggage response");
  const tags = new Set<string>();
  for (const bag of value) {
    if (!bag || typeof bag !== "object")
      throw new Error("Invalid baggage record");
    for (const field of [
      "id",
      "tag_number",
      "tag_code",
      "booking_reference",
      "passenger_name",
      "flight_number",
      "departure_airport",
      "arrival_airport",
      "status",
      "risk_level",
      "recommended_action",
      "eink_banner",
      "updated_at",
      "last_known_location",
      "tier_status",
      "cabin_class",
      "seat_number",
      "carousel_assigned",
    ]) {
      if (typeof bag[field] !== "string")
        throw new Error(`Invalid baggage ${field}`);
    }
    for (const field of [
      "tag_interface",
      "departure_time",
      "passenger_risk_summary",
      "predicted_arrival_time",
      "model_version",
      "copilot_approval_status",
      "passenger_recovery_choice",
      "recovery_flight_number",
      "recovery_eta",
      "delivery_address",
    ]) {
      if (bag[field] != null && typeof bag[field] !== "string")
        throw new Error(`Invalid baggage ${field}`);
    }
    if (
      !Number.isFinite(bag.weight_kg) ||
      bag.weight_kg < 0 ||
      typeof bag.is_rush_bag !== "boolean" ||
      (bag.is_tag_synced != null && typeof bag.is_tag_synced !== "boolean")
    )
      throw new Error("Invalid baggage telemetry");
    if (tags.has(bag.tag_number)) throw new Error("Duplicate baggage tag");
    tags.add(bag.tag_number);
    if (
      !Number.isFinite(bag.risk_score) ||
      bag.risk_score < 0 ||
      bag.risk_score > 100
    )
      throw new Error("Invalid risk score");
    if (
      bag.connection_minutes != null &&
      (!Number.isFinite(bag.connection_minutes) || bag.connection_minutes < 0)
    )
      throw new Error("Invalid connection buffer");
    if (
      bag.risk_factors != null &&
      (!Array.isArray(bag.risk_factors) ||
        bag.risk_factors.some((s: unknown) => typeof s !== "string"))
    )
      throw new Error("Invalid risk factors");
    if (
      !Array.isArray(bag.events) ||
      bag.events.some((event: unknown) => {
        if (!event || typeof event !== "object") return true;
        const e = event as Record<string, unknown>;
        return (
          [
            "id",
            "event_type",
            "timestamp",
            "location_code",
            "station_name",
            "scanner_type",
          ].some((key) => typeof e[key] !== "string") ||
          ["notes", "handled_by_staff_id"].some(
            (key) => e[key] != null && typeof e[key] !== "string",
          ) ||
          !Number.isFinite(Date.parse(String(e.timestamp)))
        );
      })
    )
      throw new Error("Invalid baggage events");
    if (!Number.isFinite(Date.parse(bag.updated_at)))
      throw new Error("Invalid update time");
  }
  return value as LiveBag[];
}

export function snapshotMetrics(bags: LiveBag[]) {
  // ponytail: snapshot endpoint has no eligible completed-transfer denominator; add success when analytics supplies it.
  return {
    total: bags.length,
    atRisk: bags.filter(isAtRiskBag).length,
    exceptions: bags.filter(isExceptionBag).length,
    success: null,
  };
}

export function timelineDomain(bags: LiveBag[]): [number, number] | null {
  const timestamps = bags
    .flatMap((b) => [b.departure_time, ...b.events.map((e) => e.timestamp)])
    .filter((s): s is string => !!s)
    .map((s) => Date.parse(s))
    .filter(Number.isFinite);
  if (!timestamps.length) return null;
  const min = Math.min(...timestamps),
    max = Math.max(...timestamps);
  const padding = Math.max((max - min) * 0.06, 15 * 60_000);
  return [min - padding, max + padding];
}
