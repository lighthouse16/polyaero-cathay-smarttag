"use client";
import React, { useId, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { formatStatusLabel } from "../../lib/utils";
import { stationTime } from "../transfer/IncomingFlightQueue";
interface Props { bags: LiveBag[]; selectedTagNumber: string; onSelectBag: (tag: string) => void; onSwitchToTransferControl: () => void; }
export function BaggageTraceView({ bags, selectedTagNumber, onSelectBag }: Props) {
  const [query, setQuery] = useState("");
  const id = useId();
  const filtered = bags.filter(b => `${b.tag_number} ${b.tag_code} ${b.flight_number}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-labelledby="trace-title"><div className="page-heading"><div><h1 id="trace-title">Baggage Trace</h1><p>Source-reported custody records · HKT (UTC+8)</p></div></div><div className="card-surface"><div className="table-toolbar"><label htmlFor={id} className="sr-only">Search bag tag, tag UID or flight</label><input id={id} type="search" placeholder="Search bag tag, tag UID or flight" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="operational-scroll"><table className="operational-table"><thead><tr><th scope="col">Bag ID</th><th scope="col">Reported flight</th><th scope="col">Status</th><th scope="col">Last reported event</th><th scope="col">Source</th></tr></thead><tbody>{filtered.map(b => { const event = [...b.events].sort((a, c) => Date.parse(c.timestamp) - Date.parse(a.timestamp))[0]; return <tr key={b.tag_number} aria-selected={selectedTagNumber === b.tag_number}><td><button className="row-link" onClick={() => onSelectBag(b.tag_number)}>{b.tag_number}</button></td><td>{b.flight_number}</td><td>{formatStatusLabel(b.status)}</td><td>{event ? `${stationTime(event.timestamp)} · ${formatStatusLabel(event.event_type)}` : "—"}</td><td>{event ? `${event.scanner_type} · reported` : "Unavailable"}</td></tr>; })}</tbody></table>{!filtered.length && <p className="table-empty" role="status">No authorized baggage records available for current search.</p>}</div></div></section>;
}
export function PerformanceView({ bags, onSwitchToTransferControl }: Props) {
  return <section aria-labelledby="performance-title"><div className="page-heading"><div><h1 id="performance-title">Performance</h1><p>Current authorized snapshot only. Historical operational metrics unavailable.</p></div></div><div className="card-surface performance-summary"><h2>Snapshot coverage</h2><p>{bags.length ? `${bags.length} baggage records · ${bags.reduce((n, b) => n + b.events.length, 0)} source-reported events` : "Authorized baggage records unavailable"}</p><p>Historical transfer outcomes, recovery durations and station-wide eligible population require upstream integration.</p><button className="text-button" onClick={onSwitchToTransferControl}>Back to Transfer Control</button></div></section>;
}
