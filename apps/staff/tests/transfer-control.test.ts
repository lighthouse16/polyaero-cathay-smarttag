import { describe, it, expect } from "vitest";
import { validateTransferSnapshot, aggregateOutboundFlights, aggregateInboundConnections, bagsForConnection, findBagConnection, timeToActMinutes, bagRiskScore, transferMetrics } from "../src/lib/transferControl";
import { transferFixture, fixtureNow } from "./fixtures/transferFixture";

describe("authoritative transfer contracts", () => {
  it("counts 28 + 18 outbound bags across incoming feeder connections", () => {
    const s = validateTransferSnapshot(transferFixture());
    expect(aggregateOutboundFlights(s, fixtureNow).map(r => r.transferBagCount)).toEqual([28, 18]);
    expect(aggregateInboundConnections(s, "out-nrt", fixtureNow).map(r => r.transferBagCount)).toEqual([15, 13]);
    expect(aggregateInboundConnections(s, "out-lhr", fixtureNow).map(r => r.transferBagCount)).toEqual([18]);
    expect(bagsForConnection(s, "in-14", "out-nrt")).toHaveLength(15);
    expect(findBagConnection(s, "0160892014")).toMatchObject({ outboundLegId: "out-nrt", inboundLegId: "in-14" });
  });
  it("keeps independent flight92 and bag82; never averages mixed legacy scores", () => {
    const s = validateTransferSnapshot(transferFixture());
    expect(aggregateOutboundFlights(s, fixtureNow)[0].riskScore).toBe(92);
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBe(82);
    expect(bagRiskScore(s, s.bags[1].tag_number, fixtureNow)).toBeNull();
    expect(aggregateInboundConnections(s, "out-nrt", fixtureNow)[0].riskScore).toBeNull();
    s.bags.forEach(b => { b.risk_score = 0; });
    expect(aggregateOutboundFlights(s, fixtureNow)[0].riskScore).toBe(92);
  });
  it("copies allowlisted bags, blanks PII and ignores client verification flags", () => {
    const raw = transferFixture();
    Object.assign(raw.bags[0], { malicious: "unknown", verified: true });
    Object.assign(raw.bags[0].events[0], { verified: true, handled_by_staff_id: "PRIVATE" });
    const s = validateTransferSnapshot(raw);
    expect(s.bags[0]).not.toBe(raw.bags[0]);
    expect(s.bags[0].passenger_name).toBe("");
    expect(s.bags[0].booking_reference).toBe("");
    expect(s.bags[0].seat_number).toBe("");
    expect(s.bags[0]).not.toHaveProperty("malicious");
    expect(s.bags[0].events[0]).not.toHaveProperty("verified");
    expect(s.bags[0].events[0]).not.toHaveProperty("handled_by_staff_id");
  });
  it("keeps overnight HKG intervention deadline, not connection buffer or delayed arrival", () => {
    const s = transferFixture();
    s.legs[0].estimatedDepartureAt = "2026-11-15T00:00:00+08:00";
    s.legs[0].estimatedArrivalAt = "2026-11-15T00:50:00+08:00";
    s.connections[0].deadline!.at = "2026-11-15T00:05:00+08:00";
    s.bags[0].connection_minutes = 999;
    const result = validateTransferSnapshot(s);
    expect(timeToActMinutes(result.connections[0].deadline, fixtureNow)).toBe(25);
    expect(timeToActMinutes(null, fixtureNow)).toBeNull();
    expect(timeToActMinutes({ ...result.connections[0].deadline!, at: "2026-11-14T15:30:00Z" }, fixtureNow)).toBe(-10);
  });
  it("only pending attention bags contribute earliest action; completed/missed/null excluded", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.connections[0].status = "transferred";
    s.connections[1].status = "missed";
    s.connections[2].deadline = null;
    s.connections[3].deadline!.at = "2026-11-14T15:45:00Z";
    expect(aggregateOutboundFlights(s, fixtureNow)[0].earliestActionAt).toBe("2026-11-14T15:45:00Z");
  });
  it("stale snapshot suppresses counts, deadlines and risk", () => {
    const s = validateTransferSnapshot(transferFixture());
    const expired = new Date("2026-11-14T16:00:00Z");
    expect(transferMetrics(s, expired)).toEqual({ total: null, actionRequired: null, atRisk: null, onTrack: null, unknown: null, success: null });
    expect(bagRiskScore(s, "0160892014", expired)).toBeNull();
    expect(aggregateOutboundFlights(s, expired)[0]).toMatchObject({ riskScore: null, earliestActionAt: null, unknownCount: 28 });
  });
  it("stale relation becomes unknown; stale evidence suppresses score", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.connections[0].provenance.validUntil = "2026-11-14T15:39:00Z";
    s.flightRisks[0].evidence[0].validUntil = "2026-11-14T15:39:00Z";
    expect(aggregateOutboundFlights(s, fixtureNow)[0]).toMatchObject({ unknownCount: 1, actionRequiredCount: 0, riskScore: null });
  });
  it("uses supplied disjoint attention, not missing scans, late scans, bare bag scores", () => {
    const s = validateTransferSnapshot(transferFixture());
    expect(transferMetrics(s, fixtureNow)).toMatchObject({ total: 46, actionRequired: 1, atRisk: 19, onTrack: 26, unknown: 0 });
    expect(s.bags[1].events).toEqual([]);
    expect(s.bags[0].events[0].scanner_type).toBe("MANUAL_OVERRIDE");
  });
  it("success requires explicit complete population and current provenance", () => {
    const s = validateTransferSnapshot(transferFixture());
    expect(transferMetrics(s, fixtureNow).success).toBe(90);
    s.transferSuccess!.eligible = 0;
    expect(transferMetrics(s, fixtureNow).success).toBeNull();
    s.transferSuccess = null;
    expect(transferMetrics(s, fixtureNow).success).toBeNull();
  });
  it("distinguishes available empty zero from unavailable null", () => {
    const s = transferFixture();
    s.bags = []; s.legs = []; s.connections = []; s.flightRisks = []; s.bagRisks = []; s.transferSuccess = null;
    expect(transferMetrics(validateTransferSnapshot(s), fixtureNow).total).toBe(0);
    s.availability = "unavailable"; s.validUntil = null; s.missingInputs = ["manifest"];
    expect(transferMetrics(validateTransferSnapshot(s), fixtureNow).total).toBeNull();
  });
  it.each([
    ["reversed scheduled leg", (s: ReturnType<typeof transferFixture>) => { s.legs[0].scheduledArrivalAt = "2026-11-14T15:00:00Z"; }],
    ["reversed estimated leg", (s: ReturnType<typeof transferFixture>) => { s.legs[0].estimatedDepartureAt = "2026-11-14T15:30:00Z"; s.legs[0].estimatedArrivalAt = "2026-11-14T15:00:00Z"; }],
    ["bag newer than snapshot", (s: ReturnType<typeof transferFixture>) => { s.bags[0].updated_at = "2026-11-14T15:36:00Z"; }],
    ["event newer than snapshot", (s: ReturnType<typeof transferFixture>) => { s.bags[0].events[0].timestamp = "2026-11-14T15:36:00Z"; }],
    ["leg observed after snapshot", (s: ReturnType<typeof transferFixture>) => { s.legs[0].provenance = { ...s.legs[0].provenance, observedAt: "2026-11-14T15:36:00Z" }; }],
    ["relation observed after snapshot", (s: ReturnType<typeof transferFixture>) => { s.connections[0].provenance = { ...s.connections[0].provenance, observedAt: "2026-11-14T15:36:00Z" }; }],
    ["assessment after snapshot", (s: ReturnType<typeof transferFixture>) => { s.bagRisks[0].assessedAt = "2026-11-14T15:36:00Z"; }],
    ["false missed on-track state", (s: ReturnType<typeof transferFixture>) => { s.connections[20].status = "missed"; }],
    ["empty bag ID", (s: ReturnType<typeof transferFixture>) => { s.bags[0].id = ""; }],
    ["empty bag tag code", (s: ReturnType<typeof transferFixture>) => { s.bags[0].tag_code = ""; }],
    ["malformed tag", (s: ReturnType<typeof transferFixture>) => { s.bags[0].tag_number = "123"; }],
    ["duplicate custody ID", (s: ReturnType<typeof transferFixture>) => s.bags[0].events.push(s.bags[0].events[0])],
    ["terminal actionable state", (s: ReturnType<typeof transferFixture>) => { s.connections[0].status = "transferred"; }],
    ["duplicate leg", (s: ReturnType<typeof transferFixture>) => s.legs.push(s.legs[0])],
    ["duplicate relation", (s: ReturnType<typeof transferFixture>) => s.connections.push(s.connections[0])],
    ["ambiguous reroute", (s: ReturnType<typeof transferFixture>) => s.connections.push({ ...s.connections[0], id: "alternate", outboundLegId: "out-lhr" })],
    ["duplicate bag", (s: ReturnType<typeof transferFixture>) => s.bags.push(s.bags[0])],
    ["dangling leg", (s: ReturnType<typeof transferFixture>) => { s.connections[0].inboundLegId = "missing"; }],
    ["dangling bag", (s: ReturnType<typeof transferFixture>) => { s.connections[0].bagTag = "9999999999"; }],
    ["not HKG inbound", (s: ReturnType<typeof transferFixture>) => { s.legs[0].destination = "SIN"; }],
    ["not HKG outbound", (s: ReturnType<typeof transferFixture>) => { s.legs[1].origin = "SIN"; }],
    ["invalid date", (s: ReturnType<typeof transferFixture>) => { s.legs[0].operatingDate = "2026-02-30"; }],
    ["offset missing", (s: ReturnType<typeof transferFixture>) => { s.connections[0].deadline!.at = "2026-11-14T15:55:00"; }],
    ["nonfinite risk", (s: ReturnType<typeof transferFixture>) => { s.flightRisks[0].score = NaN; }],
    ["out-of-range risk", (s: ReturnType<typeof transferFixture>) => { s.bagRisks[0].score = 101; }],
    ["duplicate assessment", (s: ReturnType<typeof transferFixture>) => s.bagRisks.push(s.bagRisks[0])],
    ["assessed missing evidence", (s: ReturnType<typeof transferFixture>) => { s.flightRisks[0].evidence = []; }],
    ["unavailable score", (s: ReturnType<typeof transferFixture>) => { s.flightRisks[0].status = "unavailable"; }],
    ["invalid status", (s: ReturnType<typeof transferFixture>) => { Object.assign(s.connections[0], { attention: "made-up" }); }],
    ["bad success denominator", (s: ReturnType<typeof transferFixture>) => { s.transferSuccess!.successful = 101; }],
    ["unavailable populated", (s: ReturnType<typeof transferFixture>) => { s.availability = "unavailable"; }],
  ])("rejects %s at trust boundary", (_, mutate) => {
    const s = transferFixture(); mutate(s); expect(() => validateTransferSnapshot(s)).toThrow();
  });
  it("stale counterpart leg suppresses action, deadline and independent scores", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.legs[0].provenance.validUntil = "2026-11-14T15:39:00Z";
    expect(aggregateOutboundFlights(s, fixtureNow)[0]).toMatchObject({ actionRequiredCount: 0, unknownCount: 15 });
    expect(aggregateInboundConnections(s, "out-nrt", fixtureNow)[0].earliestActionAt).toBeNull();
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBeNull();
  });
  it("newer flight and bag inputs invalidate older assessment", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.legs[1].provenance.observedAt = "2026-11-14T15:36:00Z";
    s.bags[0].updated_at = "2026-11-14T15:36:00Z";
    expect(aggregateOutboundFlights(s, fixtureNow)[0].riskScore).toBeNull();
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBeNull();
  });
  it("assessment cannot include later observed evidence", () => {
    const s = transferFixture();
    s.flightRisks[0].assessedAt = "2026-11-14T15:34:00Z";
    expect(() => validateTransferSnapshot(s)).toThrow();
  });
  it("future observations never become current evidence", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.connections[0].provenance.observedAt = "2026-11-14T15:41:00Z";
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBeNull();
    expect(transferMetrics(s, fixtureNow).actionRequired).toBe(0);
  });
  it("unknown schedules and deadlines remain null, never manufactured", () => {
    const s = transferFixture();
    s.legs[1].scheduledDepartureAt = null; s.legs[1].scheduledArrivalAt = null;
    s.legs[1].estimatedDepartureAt = null;
    s.connections.forEach(c => { c.deadline = null; });
    expect(aggregateOutboundFlights(validateTransferSnapshot(s), fixtureNow)[0]).toMatchObject({ earliestActionAt: null, leg: { scheduledDepartureAt: null } });
  });
  it("missing risk inputs, expired deadlines and success evidence remain unavailable", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.flightRisks[0].missingInputs = ["outbound_departure"];
    s.bagRisks[0].missingInputs = ["custody_scan"];
    s.connections[0].deadline!.provenance.validUntil = "2026-11-14T15:39:00Z";
    s.transferSuccess!.provenance.validUntil = "2026-11-14T15:39:00Z";
    expect(aggregateOutboundFlights(s, fixtureNow)[0].riskScore).toBeNull();
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBeNull();
    expect(timeToActMinutes(s.connections[0].deadline, fixtureNow)).toBeNull();
    expect(transferMetrics(s, fixtureNow).success).toBeNull();
  });
  it("canonical event ordering compares instants, not lexicographic offsets", () => {
    const s = transferFixture();
    s.bags[0].events.push({ ...s.bags[0].events[0], id: "older", timestamp: "2026-11-14T23:33:00+08:00" });
    expect(validateTransferSnapshot(s).bags[0].events.map(e => e.id)).toEqual(["older", "late-scan"]);
  });
  it("a late custody scan supersedes old bag assessment without invented rescoring", () => {
    const s = validateTransferSnapshot(transferFixture());
    s.bags[0].events[0].timestamp = "2026-11-14T15:36:00Z";
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBeNull();
  });
  it.each(["relation", "inbound", "outbound"])("newer %s provenance supersedes bag assessment", (target) => {
    const s = validateTransferSnapshot(transferFixture());
    const p = target === "relation" ? s.connections[0].provenance : s.legs[target === "inbound" ? 0 : 1].provenance;
    p.observedAt = "2026-11-14T15:36:00Z";
    expect(bagRiskScore(s, "0160892014", fixtureNow)).toBeNull();
  });
  it("stable flight identity separates operating dates, not repeated numbers", () => {
    const s = transferFixture();
    s.legs.push({ ...s.legs[2], id: "out-lhr-next", operatingDate: "2026-11-15" });
    s.connections[45].outboundLegId = "out-lhr-next";
    expect(aggregateOutboundFlights(validateTransferSnapshot(s), fixtureNow).map(r => r.transferBagCount)).toEqual([28, 17, 1]);
  });
});
