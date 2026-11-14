import type {
  BagRiskAssessment, BagTransferConnection, FlightLeg, FlightRiskAssessment,
  HandlingDeadline, InboundConnectionSummary, LiveBag, OperationalProvenance,
  OutboundFlightSummary, TransferControlSnapshot, TransferMetrics,
} from "./types";
import { validateBags } from "./dashboard";

function invalid(): never { throw new Error("Invalid transfer-control response"); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 500) return invalid();
  return value;
}
function instant(value: unknown): string {
  const s = text(value);
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(s);
  if (!parts || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59 || Number(parts[6] ?? 0) > 14 || Number(parts[7] ?? 0) > 59 || (Number(parts[6]) === 14 && Number(parts[7]) !== 0) || !Number.isFinite(Date.parse(s))) return invalid();
  if (new Date(`${s.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== s.slice(0, 10)) return invalid();
  return s;
}
function nullableInstant(value: unknown): string | null { return value === null ? null : instant(value); }
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 100_000) return invalid();
  return value.map(parse);
}
function strings(value: unknown): string[] { return list(value, text); }
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) return invalid();
  return value as T;
}
function provenance(value: unknown): OperationalProvenance {
  const p = record(value);
  const result = { system: text(p.system), recordId: text(p.recordId), observedAt: instant(p.observedAt), validUntil: instant(p.validUntil) };
  if (Date.parse(result.observedAt) >= Date.parse(result.validUntil)) return invalid();
  return result;
}
function unique<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of items) { const id = key(item); if (m.has(id)) return invalid(); m.set(id, item); }
  return m;
}
function flightLeg(value: unknown): FlightLeg {
  const f = record(value), date = text(f.operatingDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return invalid();
  const origin = text(f.origin), destination = text(f.destination), flightNumber = text(f.flightNumber);
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination || !/^[A-Z0-9]{2,10}$/.test(flightNumber)) return invalid();
  return { id: text(f.id), flightNumber, operatingDate: date, origin, destination,
    scheduledDepartureAt: nullableInstant(f.scheduledDepartureAt), scheduledArrivalAt: nullableInstant(f.scheduledArrivalAt),
    estimatedDepartureAt: nullableInstant(f.estimatedDepartureAt), estimatedArrivalAt: nullableInstant(f.estimatedArrivalAt), actualArrivalAt: nullableInstant(f.actualArrivalAt), provenance: provenance(f.provenance) };
}
function deadline(value: unknown): HandlingDeadline | null {
  if (value === null) return null;
  const d = record(value);
  return { at: instant(d.at), kind: choice(d.kind, ["latest_intervention"]), provenance: provenance(d.provenance) };
}
function connection(value: unknown): BagTransferConnection {
  const c = record(value);
  return { id: text(c.id), bagTag: text(c.bagTag), inboundLegId: text(c.inboundLegId), outboundLegId: text(c.outboundLegId),
    status: choice(c.status, ["pending", "transferred", "missed"]), attention: choice(c.attention, ["action_required", "at_risk", "on_track", "unknown"]), deadline: deadline(c.deadline), provenance: provenance(c.provenance) };
}
function risk(value: unknown): Omit<FlightRiskAssessment, "flightLegId"> {
  const r = record(value), status = choice(r.status, ["assessed", "unavailable"]);
  const score = r.score === null ? null : typeof r.score === "number" && Number.isFinite(r.score) && r.score >= 0 && r.score <= 100 ? r.score : invalid();
  const modelVersion = r.modelVersion === null ? null : text(r.modelVersion);
  const assessedAt = nullableInstant(r.assessedAt), validUntil = nullableInstant(r.validUntil), evidence = list(r.evidence, provenance), missingInputs = strings(r.missingInputs);
  if (status === "unavailable" && score !== null) return invalid();
  if (status === "assessed" && (score === null || !modelVersion || !assessedAt || !validUntil || !evidence.length || Date.parse(assessedAt) >= Date.parse(validUntil) || evidence.some(p => Date.parse(p.observedAt) > Date.parse(assessedAt)))) return invalid();
  return { status, score, modelVersion, assessedAt, validUntil, evidence, missingInputs };
}
function sanitizedBag(b: LiveBag): LiveBag {
  if (!b.tag_number || !b.tag_number.trim()) return invalid();
  unique(b.events, e => text(e.id));
  // ponytail: no staff PII authorization exists; add case-only PII after an authorized upstream contract.
  return {
    id: text(b.id), tag_number: b.tag_number, tag_code: text(b.tag_code), flight_number: b.flight_number,
    departure_airport: b.departure_airport, arrival_airport: b.arrival_airport,
    booking_reference: "", passenger_name: "", tier_status: "", cabin_class: "", seat_number: "",
    weight_kg: b.weight_kg, status: b.status, last_known_location: b.last_known_location,
    carousel_assigned: "", is_rush_bag: b.is_rush_bag, risk_score: b.risk_score, risk_level: b.risk_level,
    recommended_action: "", eink_banner: "", updated_at: instant(b.updated_at),
    ...(b.departure_time ? { departure_time: instant(b.departure_time) } : {}),
    events: b.events.map(e => ({ id: e.id, event_type: e.event_type, timestamp: instant(e.timestamp), location_code: e.location_code, station_name: e.station_name, scanner_type: e.scanner_type,
      ...(e.provenance ? { provenance: provenance(e.provenance) } : {}) })).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),  };
}

/** Validate and copy external snapshot; never cast raw data into operational truth. */
export function validateTransferSnapshot(value: unknown): TransferControlSnapshot {
  const raw = record(value);
  const availability = choice(raw.availability, ["available", "unavailable"]), generatedAt = instant(raw.generatedAt), validUntil = nullableInstant(raw.validUntil);
  if (!Array.isArray(raw.bags) || raw.bags.length > 100_000) return invalid();
  const bags = validateBags(raw.bags).map(sanitizedBag), legs = list(raw.legs, flightLeg), connections = list(raw.connections, connection);
  const flightRisks = list(raw.flightRisks, v => ({ flightLegId: text(record(v).flightLegId), ...risk(v) }));
  const bagRisks = list(raw.bagRisks, v => ({ bagTag: text(record(v).bagTag), ...risk(v) }));
  const bagMap = unique(bags, b => b.tag_number), legMap = unique(legs, l => l.id);
  const generated = Date.parse(generatedAt);
  const observed = (p: OperationalProvenance) => { if (Date.parse(p.observedAt) > generated) invalid(); };
  for (const bag of bags) {
    if (Date.parse(bag.updated_at) > generated) return invalid();
    for (const event of bag.events) { if (Date.parse(event.timestamp) > generated) return invalid(); if (event.provenance) observed(event.provenance); }
  }
  for (const leg of legs) {
    observed(leg.provenance);
    if ((leg.scheduledDepartureAt && leg.scheduledArrivalAt && Date.parse(leg.scheduledArrivalAt) < Date.parse(leg.scheduledDepartureAt)) || (leg.estimatedDepartureAt && leg.estimatedArrivalAt && Date.parse(leg.estimatedArrivalAt) < Date.parse(leg.estimatedDepartureAt)) || (leg.actualArrivalAt && Date.parse(leg.actualArrivalAt) > generated)) return invalid();
  }
  for (const c of connections) { observed(c.provenance); if (c.deadline) observed(c.deadline.provenance); }
  for (const r of [...flightRisks, ...bagRisks]) { if (r.assessedAt && Date.parse(r.assessedAt) > generated) return invalid(); r.evidence.forEach(observed); }
  unique(bags, b => b.id); unique(connections, c => c.id); unique(connections, c => c.bagTag);
  unique(flightRisks, r => r.flightLegId); unique(bagRisks, r => r.bagTag);
  for (const c of connections) {
    if (!c.bagTag.trim() || (c.status !== "pending" && (c.attention === "action_required" || c.attention === "at_risk")) || (c.status === "missed" && c.attention !== "unknown")) return invalid();
    if (!bagMap.has(c.bagTag) || legMap.get(c.inboundLegId)?.destination !== "HKG" || legMap.get(c.outboundLegId)?.origin !== "HKG" || c.inboundLegId === c.outboundLegId) return invalid();
  }
  for (const r of flightRisks) if (!legMap.has(r.flightLegId)) return invalid();
  for (const r of bagRisks) if (!bagMap.has(r.bagTag)) return invalid();
  let transferSuccess: TransferControlSnapshot["transferSuccess"] = null;
  if (raw.transferSuccess !== null) {
    const s = record(raw.transferSuccess);
    if (typeof s.successful !== "number" || typeof s.eligible !== "number" || !Number.isSafeInteger(s.successful) || !Number.isSafeInteger(s.eligible) || s.successful < 0 || s.successful > s.eligible) return invalid();
    transferSuccess = { successful: s.successful, eligible: s.eligible, windowStart: instant(s.windowStart), windowEnd: instant(s.windowEnd), provenance: provenance(s.provenance) };
    observed(transferSuccess.provenance);
    if (Date.parse(transferSuccess.windowStart) >= Date.parse(transferSuccess.windowEnd) || Date.parse(transferSuccess.windowEnd) > Date.parse(generatedAt)) return invalid();
  }
  const missingInputs = strings(raw.missingInputs);
  if (availability === "available" && (!validUntil || Date.parse(generatedAt) >= Date.parse(validUntil))) return invalid();
  if (availability === "unavailable" && (bags.length || legs.length || connections.length || flightRisks.length || bagRisks.length || transferSuccess !== null || !missingInputs.length)) return invalid();
  return { availability, generatedAt, validUntil, source: text(raw.source), missingInputs, bags, legs, connections, flightRisks, bagRisks, transferSuccess };
}

function fresh(p: OperationalProvenance, now: Date): boolean {
  return Date.parse(p.observedAt) <= now.getTime() && now.getTime() < Date.parse(p.validUntil);
}
export function isOperationalProvenanceFresh(p: OperationalProvenance, now: Date): boolean { return fresh(p, now); }
export function isTransferSnapshotFresh(snapshot: TransferControlSnapshot, now: Date): boolean {
  return snapshot.availability === "available" && !!snapshot.validUntil && Date.parse(snapshot.generatedAt) <= now.getTime() && now.getTime() < Date.parse(snapshot.validUntil);
}
export function isConnectionFresh(snapshot: TransferControlSnapshot, connection: BagTransferConnection, now: Date): boolean {
  const inbound = snapshot.legs.find(l => l.id === connection.inboundLegId);
  const outbound = snapshot.legs.find(l => l.id === connection.outboundLegId);
  return isTransferSnapshotFresh(snapshot, now) && fresh(connection.provenance, now) && !!inbound && !!outbound && fresh(inbound.provenance, now) && fresh(outbound.provenance, now);
}
export function timeToActMinutes(deadline: HandlingDeadline | null, now: Date): number | null {
  return deadline && fresh(deadline.provenance, now) ? (Date.parse(deadline.at) - now.getTime()) / 60_000 : null;
}
function assessedScore(r: FlightRiskAssessment | BagRiskAssessment | undefined, now: Date): number | null {
  return r?.status === "assessed" && r.assessedAt && r.validUntil && !r.missingInputs.length && Date.parse(r.assessedAt) <= now.getTime() && now.getTime() < Date.parse(r.validUntil) && r.evidence.every(p => fresh(p, now)) ? r.score : null;
}
export function bagRiskScore(snapshot: TransferControlSnapshot, bagTag: string, now: Date): number | null {
  const bag = snapshot.bags.find(b => b.tag_number === bagTag);
  const assessment = snapshot.bagRisks.find(r => r.bagTag === bagTag);
  const connection = findBagConnection(snapshot, bagTag);
  const relatedLegs = connection ? snapshot.legs.filter(l => l.id === connection.inboundLegId || l.id === connection.outboundLegId) : [];
  const latestInput = bag && connection ? Math.max(Date.parse(bag.updated_at), Date.parse(connection.provenance.observedAt), ...relatedLegs.map(l => Date.parse(l.provenance.observedAt)), ...bag.events.map(e => Date.parse(e.timestamp))) : Infinity;
  return connection && isConnectionFresh(snapshot, connection, now) && assessment?.assessedAt && latestInput <= now.getTime() && latestInput <= Date.parse(assessment.assessedAt) ? assessedScore(assessment, now) : null;
}
function summary(snapshot: TransferControlSnapshot, leg: FlightLeg, records: BagTransferConnection[], now: Date, riskScore: number | null): OutboundFlightSummary {
  const current = isTransferSnapshotFresh(snapshot, now) && fresh(leg.provenance, now);
  const attention = records.map(c => current && isConnectionFresh(snapshot, c, now) ? c.attention : "unknown");
  const deadlines = current ? records.filter(c => c.status === "pending" && (c.attention === "action_required" || c.attention === "at_risk") && isConnectionFresh(snapshot, c, now) && timeToActMinutes(c.deadline, now) !== null).map(c => c.deadline!.at).sort((a, b) => Date.parse(a) - Date.parse(b)) : [];
  return { leg, transferBagCount: records.length, actionRequiredCount: attention.filter(a => a === "action_required").length,
    atRiskCount: attention.filter(a => a === "at_risk").length, onTrackCount: attention.filter(a => a === "on_track").length,
    unknownCount: attention.filter(a => a === "unknown").length, earliestActionAt: deadlines[0] ?? null, riskScore: current ? riskScore : null };
}
/** Aggregates departing HKG flights that receive transfer bags, scored from flightRisks. */
export function aggregateOutboundFlights(snapshot: TransferControlSnapshot, now: Date): OutboundFlightSummary[] {
  return snapshot.legs.filter(l => snapshot.connections.some(c => c.outboundLegId === l.id)).map(leg => {
    const assessment = snapshot.flightRisks.find(r => r.flightLegId === leg.id);
    const score = assessment?.assessedAt && Date.parse(leg.provenance.observedAt) <= Date.parse(assessment.assessedAt) ? assessedScore(assessment, now) : null;
    return summary(snapshot, leg, snapshot.connections.filter(c => c.outboundLegId === leg.id), now, score);
  });
}
/** Aggregates incoming feeder flights connecting onto a specific outbound leg. */
export function aggregateInboundConnections(snapshot: TransferControlSnapshot, outboundLegId: string, now: Date): InboundConnectionSummary[] {
  return snapshot.legs.filter(l => snapshot.connections.some(c => c.outboundLegId === outboundLegId && c.inboundLegId === l.id)).map(leg => summary(snapshot, leg, snapshot.connections.filter(c => c.outboundLegId === outboundLegId && c.inboundLegId === leg.id), now, null));
}
export function bagsForConnection(snapshot: TransferControlSnapshot, inboundLegId: string, outboundLegId: string): LiveBag[] {
  const tags = new Set(snapshot.connections.filter(c => c.inboundLegId === inboundLegId && c.outboundLegId === outboundLegId).map(c => c.bagTag));
  return snapshot.bags.filter(b => tags.has(b.tag_number));
}
export function findBagConnection(snapshot: TransferControlSnapshot, bagTag: string): BagTransferConnection | null {
  return snapshot.connections.find(c => c.bagTag === bagTag) ?? null;
}
export function transferMetrics(snapshot: TransferControlSnapshot, now: Date): TransferMetrics {
  if (!isTransferSnapshotFresh(snapshot, now)) return { total: null, actionRequired: null, atRisk: null, onTrack: null, unknown: null, success: null };
  const attention = snapshot.connections.map(c => isConnectionFresh(snapshot, c, now) ? c.attention : "unknown");
  const s = snapshot.transferSuccess;
  return { total: snapshot.connections.length, actionRequired: attention.filter(a => a === "action_required").length,
    atRisk: attention.filter(a => a === "at_risk").length, onTrack: attention.filter(a => a === "on_track").length,
    unknown: attention.filter(a => a === "unknown").length, success: s && s.eligible > 0 && fresh(s.provenance, now) ? 100 * s.successful / s.eligible : null };
}
