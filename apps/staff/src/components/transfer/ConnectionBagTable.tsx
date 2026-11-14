"use client";
import React, { useMemo, useState } from "react";
import type { TransferControlSnapshot } from "../../lib/types";
import { bagsForConnection, bagRiskScore, timeToActMinutes, isTransferSnapshotFresh, isConnectionFresh } from "../../lib/transferControl";
import { formatStatusLabel } from "../../lib/utils";
import { formatTimeToAct } from "./IncomingFlightQueue";

export function ConnectionBagTable({ snapshot, inboundId, outboundId, selectedTag, now, onSelect, stale = false, inert = false }: {
  snapshot: TransferControlSnapshot; inboundId: string; outboundId: string; selectedTag: string | null; now: Date; onSelect: (tag: string) => void; stale?: boolean; inert?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("risk");
  const inbound = snapshot.legs.find(l => l.id === inboundId);
  const outbound = snapshot.legs.find(l => l.id === outboundId);
  const fresh = !stale && isTransferSnapshotFresh(snapshot, now);
  const rows = useMemo(() => bagsForConnection(snapshot, inboundId, outboundId).map(bag => {
    const connection = snapshot.connections.find(c => c.bagTag === bag.tag_number && c.inboundLegId === inboundId && c.outboundLegId === outboundId);
    const deadline = fresh && connection?.status === "pending" && isConnectionFresh(snapshot, connection, now) ? connection.deadline : null;
    return { bag, risk: fresh ? bagRiskScore(snapshot, bag.tag_number, now) : null, time: timeToActMinutes(deadline, now) };
  }).filter(r => r.bag.tag_number.toLowerCase().includes(query.trim().toLowerCase()) && (!status || r.bag.status === status)).sort((a, b) => sort === "tag" ? a.bag.tag_number.localeCompare(b.bag.tag_number) : sort === "deadline" ? (a.time ?? Infinity) - (b.time ?? Infinity) : (b.risk ?? -1) - (a.risk ?? -1)), [snapshot, inboundId, outboundId, now, query, status, sort, fresh]);
  const statuses = [...new Set(bagsForConnection(snapshot, inboundId, outboundId).map(b => b.status))];
  return <section className="bags-pane" inert={inert} aria-labelledby="bags-title">
    <div className="pane-heading"><div><h3 id="bags-title">Connection bags</h3><p>{inbound?.flightNumber ?? "—"} · {outbound?.flightNumber ?? "—"}</p></div><span>{bagsForConnection(snapshot, inboundId, outboundId).length} bags</span></div>
    <div className="table-toolbar"><input type="search" aria-label="Search connection bag tags" placeholder="Search full bag tag" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter bag status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s} value={s}>{formatStatusLabel(s)}</option>)}</select><select aria-label="Sort connection bags" value={sort} onChange={e => setSort(e.target.value)}><option value="risk">Bag risk, highest first</option><option value="deadline">Time to Act, earliest first</option><option value="tag">Bag ID</option></select></div>
    <div className="operational-scroll"><table className="operational-table bag-pair-table"><thead><tr><th scope="col">Bag ID</th><th scope="col">Flight</th><th scope="col">Connection</th><th scope="col">Bag risk /100</th><th scope="col">Time to Act</th><th scope="col">Reported status</th></tr></thead><tbody>{rows.map(({ bag, risk, time }) => <tr key={bag.tag_number} onClick={() => onSelect(bag.tag_number)} aria-selected={selectedTag === bag.tag_number}><td><button data-bag={bag.tag_number} className="row-link" aria-label={`Inspect bag ${bag.tag_number}`} onClick={e => { e.stopPropagation(); onSelect(bag.tag_number); }}>{bag.tag_number}</button></td><td>{inbound?.flightNumber ?? "—"}</td><td>{outbound?.flightNumber ?? "—"}</td><td className="score-cell">{risk ?? "—"}</td><td>{formatTimeToAct(time)}</td><td>{fresh ? formatStatusLabel(bag.status) : "Unavailable"}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="table-empty" role="status">No bags match this connection and current filters.</p>}</div>
  </section>;
}
