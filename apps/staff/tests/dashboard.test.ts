import { describe, it, expect } from "vitest";
import {
  snapshotMetrics,
  validateBags,
  timelineDomain,
} from "../src/lib/dashboard";
import { formatTimeHHMM, parseRiskFactors } from "../src/lib/utils";
const bag = {
  id: "b",
  tag_number: "0160892014",
  tag_code: "04:AB",
  booking_reference: "CX4M1P",
  passenger_name: "WONG/VICTOR",
  tier_status: "GOLD",
  cabin_class: "BUSINESS",
  flight_number: "CX255",
  departure_airport: "HKG",
  arrival_airport: "NRT",
  departure_time: "2026-11-14T08:15:00Z",
  seat_number: "14K",
  weight_kg: 28.5,
  connection_minutes: 0,
  status: "MISROUTED",
  last_known_location: "HKG",
  carousel_assigned: "2",
  is_rush_bag: true,
  risk_score: 82,
  risk_level: "HIGH_PRIORITY",
  recommended_action: "Review",
  eink_banner: "PRIORITY",
  updated_at: "2026-11-14T07:30:00Z",
  events: [
    {
      id: "evt",
      event_type: "MISROUTED",
      timestamp: "2026-11-14T07:30:00Z",
      location_code: "HKG",
      station_name: "HKG",
      scanner_type: "RFID_GATE",
    },
  ],
};
describe("truthful dashboard data", () => {
  it("validates real payload", () =>
    expect(validateBags([bag])).toEqual([bag]));
  it("rejects malformed response", () =>
    expect(() => validateBags({})).toThrow());
  it("rejects malformed events", () =>
    expect(() => validateBags([{ ...bag, events: [{}] }])).toThrow());
  it("rejects malformed event notes", () =>
    expect(() =>
      validateBags([{ ...bag, events: [{ ...bag.events[0], notes: {} }] }]),
    ).toThrow());
  it("rejects malformed recovery choice", () =>
    expect(() =>
      validateBags([{ ...bag, passenger_recovery_choice: {} }]),
    ).toThrow());
  it("rejects invalid scores", () =>
    expect(() => validateBags([{ ...bag, risk_score: 101 }])).toThrow());
  it("rejects duplicate tag records", () =>
    expect(() => validateBags([bag, bag])).toThrow());
  it("counts actual snapshots, never claims success", () =>
    expect(snapshotMetrics([bag])).toEqual({
      total: 1,
      atRisk: 1,
      exceptions: 1,
      success: null,
    }));
  it("empty success denominator remains unavailable", () =>
    expect(snapshotMetrics([]).success).toBeNull());
  it("qualitative factors never become percentage weights", () =>
    expect(
      parseRiskFactors({ ...bag, risk_factors: ["Load (90%)"] })[0].weightPct,
    ).toBeNull());
  it("zero connection buffer retained", () =>
    expect(parseRiskFactors(bag)[0].label).toContain("0 min"));
  it("HK timestamp uses correct date rollover", () =>
    expect(formatTimeHHMM("2026-11-14T23:30:00Z")).toBe("07:30"));
  it("invalid time never invents timestamp", () =>
    expect(formatTimeHHMM("nonsense")).toBe("—"));
  it("timeline domain contains only actual timestamps", () => {
    const d = timelineDomain([bag]);
    expect(d).not.toBeNull();
    expect(d![0]).toBeLessThan(Date.parse(bag.events[0].timestamp));
    expect(d![1]).toBeGreaterThan(Date.parse(bag.departure_time));
  });
});
