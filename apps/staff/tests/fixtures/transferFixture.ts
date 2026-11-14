import type { LiveBag, TransferControlSnapshot, OperationalProvenance } from "../../src/lib/types";

// Design fixture only. Never imported by production code.
export const fixtureNow = new Date("2026-11-14T15:40:00Z");
export function transferFixture(): TransferControlSnapshot {
  const provenance: OperationalProvenance = {
    system: "test-manifest", recordId: "fixture", observedAt: "2026-11-14T15:35:00Z", validUntil: "2026-11-14T16:00:00Z",
  };
  const leg = (
    id: string,
    flightNumber: string,
    origin: string,
    destination: string,
    scheduledDepartureAt = "2026-11-14T15:30:00Z",
    scheduledArrivalAt = "2026-11-14T16:30:00Z",
    estimatedDepartureAt: string | null = null,
    estimatedArrivalAt: string | null = null,
  ) => ({
    id, flightNumber, origin, destination, operatingDate: "2026-11-14",
    scheduledDepartureAt, scheduledArrivalAt,
    estimatedDepartureAt, estimatedArrivalAt, actualArrivalAt: null, provenance,
  });
  const bags: LiveBag[] = Array.from({ length: 46 }, (_, i) => ({
    id: `bag-${i}`, tag_number: i === 0 ? "0160892014" : String(160892100 + i).padStart(10, "0"),
    tag_code: `test-${i}`, flight_number: i < 28 ? "CX255" : "CX777", departure_airport: "HKG", arrival_airport: i < 28 ? "NRT" : "LHR",
    booking_reference: "PRIVATE-PNR", passenger_name: "PRIVATE/PASSENGER", tier_status: "", cabin_class: "", seat_number: "PRIVATE-SEAT",
    weight_kg: 20, status: "IN_TRANSFER", last_known_location: "HKG", carousel_assigned: "", is_rush_bag: false,
    risk_score: i === 0 ? 82 : i % 2 ? 15 : 95, risk_level: "", recommended_action: "", eink_banner: "", updated_at: provenance.observedAt,
    events: i === 0 ? [{ id: "late-scan", event_type: "IN_TRANSFER", timestamp: "2026-11-14T15:34:00Z", location_code: "HKG", station_name: "HKG", scanner_type: "MANUAL_OVERRIDE", notes: "Reported only" }] : [],
  }));
  return {
    availability: "available", generatedAt: provenance.observedAt, validUntil: provenance.validUntil, source: "test-manifest", missingInputs: [], bags,
    legs: [
      leg("in-14", "CX616", "BKK", "HKG"),
      leg("out-nrt", "CX255", "HKG", "NRT", "2026-11-14T16:10:00Z", "2026-11-14T21:10:00Z", "2026-11-14T16:20:00Z"),
      leg("out-lhr", "CX777", "HKG", "LHR", "2026-11-14T17:15:00Z", "2026-11-15T05:30:00Z"),
      leg("in-sin", "CX714", "SIN", "HKG", "2026-11-14T12:15:00Z", "2026-11-14T16:00:00Z", null, "2026-11-14T16:05:00Z"),
    ],
    connections: bags.map((bag, i) => ({
      id: `connection-${i}`,
      bagTag: bag.tag_number,
      inboundLegId: i >= 15 && i < 28 ? "in-sin" : "in-14",
      outboundLegId: i < 28 ? "out-nrt" : "out-lhr",
      status: "pending",
      attention: i === 0 ? "action_required" : i < 20 ? "at_risk" : "on_track",
      deadline: { at: "2026-11-14T15:55:00Z", kind: "latest_intervention", provenance },
      provenance,
    })),
    flightRisks: [
      { flightLegId: "out-nrt", status: "assessed", score: 92, modelVersion: "fixture-flight-v1", assessedAt: provenance.observedAt, validUntil: provenance.validUntil, evidence: [provenance], missingInputs: [] },
      { flightLegId: "out-lhr", status: "assessed", score: 24, modelVersion: "fixture-flight-v1", assessedAt: provenance.observedAt, validUntil: provenance.validUntil, evidence: [provenance], missingInputs: [] },
    ],
    bagRisks: [{ bagTag: bags[0].tag_number, status: "assessed", score: 82, modelVersion: "fixture-bag-v1", assessedAt: provenance.observedAt, validUntil: provenance.validUntil, evidence: [provenance], missingInputs: [] }],
    transferSuccess: { successful: 90, eligible: 100, windowStart: "2026-11-13T16:00:00Z", windowEnd: "2026-11-14T15:35:00Z", provenance },
  };
}
