"use client";
import React, { useMemo, useState } from "react";
import type { InboundFlightSummary } from "../../lib/types";
import { isOperationalProvenanceFresh } from "../../lib/transferControl";

export function formatTimeToAct(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return minutes < 0 ? `${Math.ceil(Math.abs(minutes))} min overdue` : `${Math.floor(minutes)} min`;
}
export function stationTime(at: string | null | undefined): string {
  if (!at || !Number.isFinite(Date.parse(at))) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(at));
}
export function flightAttention(f: InboundFlightSummary): string {
  return f.actionRequiredCount ? "Action required" : f.atRiskCount ? "At risk" : f.unknownCount ? "Unavailable" : f.onTrackCount ? "On track" : "No active transfers";
}
export function IncomingFlightQueue({ flights, now, onSelect, unavailable, loading, actionOnly = false }: {
  flights: InboundFlightSummary[]; now: Date; onSelect: (id: string) => void; unavailable: boolean; loading: boolean; actionOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("risk");
  const rows = useMemo(() => flights.filter(f =>
    `${f.leg.flightNumber} ${f.leg.origin} ${f.leg.destination} ${f.leg.operatingDate}`.toLowerCase().includes(query.toLowerCase().trim()) &&
    (unavailable || ((!status || flightAttention(f) === status) && (!actionOnly || f.actionRequiredCount > 0))),
  ).sort((a, b) => {
    if (unavailable || sort === "flight") return a.leg.flightNumber.localeCompare(b.leg.flightNumber);
    if (sort === "deadline") return (a.earliestActionAt ? Date.parse(a.earliestActionAt) : Infinity) - (b.earliestActionAt ? Date.parse(b.earliestActionAt) : Infinity);
    if (sort === "action") return b.actionRequiredCount - a.actionRequiredCount;
    return (b.riskScore ?? -1) - (a.riskScore ?? -1);
  }), [flights, query, status, sort, actionOnly, unavailable]);
  return <section className="card-surface flight-queue" aria-labelledby="incoming-title" aria-busy={loading}>
    <div className="queue-heading"><div><h2 id="incoming-title">Incoming Flight Risk Queue</h2><p>Transfer arrivals into HKG · station times HKT (UTC+8)</p></div><span>{unavailable ? "Data unavailable" : `${flights.length} incoming flights`}</span></div>
    <div className="table-toolbar">
      <input type="search" aria-label="Search incoming flights" placeholder="Search flight or origin" value={query} onChange={e => setQuery(e.target.value)} />
      <select disabled={unavailable} aria-label="Filter incoming status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{["Action required", "At risk", "On track", "Unavailable"].map(s => <option key={s}>{s}</option>)}</select>
      <select disabled={unavailable} aria-label="Sort incoming flights" value={sort} onChange={e => setSort(e.target.value)}><option value="risk">Flight risk, highest first</option><option value="deadline">Deadline, earliest first</option><option value="action">Action required, highest first</option><option value="flight">Flight number</option></select>
    </div>
    <div className="operational-scroll"><table className="operational-table"><thead><tr><th scope="col">Inbound flight</th><th scope="col">Origin → HKG</th><th scope="col">ETA / arrival</th><th scope="col">Transfer bags</th><th scope="col">Flight risk /100</th><th scope="col">Earliest Time to Act</th><th scope="col">Action required</th><th scope="col">Status</th></tr></thead>
      <tbody>{rows.map(f => <tr key={f.leg.id} onClick={() => onSelect(f.leg.id)}><td><button className="row-link" data-inbound={f.leg.id} onClick={e => { e.stopPropagation(); onSelect(f.leg.id); }} aria-label={`Inspect incoming ${f.leg.flightNumber} ${f.leg.operatingDate}`}>{f.leg.flightNumber}</button><small>{f.leg.operatingDate}</small></td><td>{f.leg.origin} → {f.leg.destination}</td><td>{unavailable || !isOperationalProvenanceFresh(f.leg.provenance, now) ? "—" : stationTime(f.leg.actualArrivalAt ?? f.leg.estimatedArrivalAt ?? f.leg.scheduledArrivalAt)}<small>{f.leg.actualArrivalAt ? "Arrived" : f.leg.estimatedArrivalAt ? "Estimated" : "Scheduled"}</small></td><td>{f.transferBagCount}</td><td className="score-cell">{unavailable ? "—" : f.riskScore ?? "—"}</td><td>{formatTimeToAct(!unavailable && f.earliestActionAt ? (Date.parse(f.earliestActionAt) - now.getTime()) / 60000 : null)}</td><td>{unavailable ? "—" : f.actionRequiredCount}</td><td>{unavailable ? "Unavailable" : flightAttention(f)}</td></tr>)}</tbody>
    </table>{rows.length === 0 && <div className="table-empty" role="status">{loading ? "Loading incoming flights…" : unavailable ? "Incoming flight associations unavailable" : "No incoming flights match current filters"}</div>}</div>
  </section>;
}
