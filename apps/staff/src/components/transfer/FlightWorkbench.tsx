"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { InboundFlightSummary, TransferControlSnapshot } from "../../lib/types";
import { aggregateInboundFlights, aggregateOutboundConnections, bagRiskScore, timeToActMinutes, isConnectionFresh, isOperationalProvenanceFresh, findBagConnection } from "../../lib/transferControl";
import { BaggageInvestigationPanel } from "../investigation/BaggageInvestigationPanel";
import { CloseIcon } from "../icons/DashboardIcons";
import { ConnectionBagTable } from "./ConnectionBagTable";
import { formatTimeToAct, stationTime, flightAttention } from "./IncomingFlightQueue";
import type { SelectionAction, TransferSelection } from "./selection";

export function FlightWorkbench({ snapshot, selection, now, stale, onSelection }: {
  snapshot: TransferControlSnapshot; selection: TransferSelection; now: Date; stale: boolean; onSelection: (action: SelectionAction) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const cachedInbound = useRef<InboundFlightSummary | null>(null);
  const [compact, setCompact] = useState(false);
  const [bagSearch, setBagSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const inboundFocus = useRef<string | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1280px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const inbound = aggregateInboundFlights(snapshot, now).find(f => f.leg.id === selection.inbound);
  if (inbound) cachedInbound.current = inbound;
  const header = inbound ?? (cachedInbound.current?.leg.id === selection.inbound ? cachedInbound.current : null);
  const connections = useMemo(() => selection.inbound ? aggregateOutboundConnections(snapshot, selection.inbound, now) : [], [snapshot, selection.inbound, now]);
  const selectedConnection = connections.find(c => c.leg.id === selection.outbound);
  const selectedBag = snapshot.bags.find(b => b.tag_number === selection.bag) ?? null;
  const relation = snapshot.connections.find(c => c.bagTag === selection.bag && c.inboundLegId === selection.inbound && c.outboundLegId === selection.outbound);
  const open = !!selection.inbound;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      inboundFocus.current = selection.inbound;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      const trigger = inboundFocus.current ? document.querySelector<HTMLElement>(`[data-inbound="${CSS.escape(inboundFocus.current)}"]`) : null;
      if (trigger) trigger.focus();
      else if (openerRef.current?.isConnected && openerRef.current !== document.body) openerRef.current.focus();
      else document.querySelector<HTMLElement>("#staff-main h1")?.focus();
    }
  }, [open, selection.inbound]);
  useEffect(() => { if (selection.bag) document.getElementById("case-heading")?.focus(); }, [selection.bag]);
  function back() {
    const target = selection.bag ? `[data-bag="${CSS.escape(selection.bag)}"]` : selection.outbound ? `[data-outbound="${CSS.escape(selection.outbound)}"]` : null;
    onSelection({ type: "back" });
    if (target) requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(target)?.focus());
  }
  const fresh = !stale && !!inbound && isOperationalProvenanceFresh(inbound.leg.provenance, now);
  const bagTime = fresh && relation?.status === "pending" && isConnectionFresh(snapshot, relation, now) ? timeToActMinutes(relation.deadline, now) : null;
  function searchBag(event: React.FormEvent) {
    event.preventDefault();
    const connection = findBagConnection(snapshot, bagSearch.trim());
    if (!connection) { setSearchError("Bag flight context unavailable."); return; }
    setSearchError("");
    onSelection({ type: "inbound", id: connection.inboundLegId });
    onSelection({ type: "outbound", id: connection.outboundLegId });
    onSelection({ type: "bag", id: connection.bagTag });
  }
  return <dialog ref={dialogRef} className="flight-dialog" aria-labelledby="workbench-title" aria-describedby="workbench-description" onCancel={e => { e.preventDefault(); back(); }}>
    {open && <div className="flight-workbench">
      <header className="workbench-header"><div className="workbench-title"><p>Incoming flight</p><h2 id="workbench-title">{header?.leg.flightNumber ?? "Flight unavailable"}<span>{header ? `${header.leg.origin} → HKG` : ""}</span></h2><p id="workbench-description">{header?.leg.operatingDate ?? "—"} · Arrival / ETA {fresh ? stationTime(header?.leg.actualArrivalAt ?? header?.leg.estimatedArrivalAt ?? header?.leg.scheduledArrivalAt) : "—"} HKT</p></div><dl className="workbench-metrics"><div><dt>Flight risk /100</dt><dd>{fresh ? header?.riskScore ?? "—" : "—"}</dd></div><div><dt>Affected bags</dt><dd>{fresh ? (header?.actionRequiredCount ?? 0) + (header?.atRiskCount ?? 0) : "—"}</dd></div><div><dt>Earliest Time to Act</dt><dd>{formatTimeToAct(fresh && header?.earliestActionAt ? (Date.parse(header.earliestActionAt) - now.getTime()) / 60000 : null)}</dd></div></dl><button autoFocus className="icon-button" aria-label="Close transfer workbench" onClick={() => onSelection({ type: "close" })}><CloseIcon size={18} color="#2D2D2D" /></button></header>
      <div className="workbench-context"><button className="text-button" onClick={back}>{selection.bag ? "Close baggage case" : selection.outbound ? "All onward connections" : "Close incoming flight"}</button><form className="workbench-search" onSubmit={searchBag}><input data-workbench-search aria-label="Locate bag within transfer flights" placeholder="Full bag tag" value={bagSearch} onChange={e => setBagSearch(e.target.value)} /><button type="submit">Find bag</button></form>{searchError && <span role="status">{searchError}</span>}{stale && <span role="status">Snapshot stale · current risk and deadlines unavailable</span>}</div>
      {!inbound ? <p className="table-empty" role="status">Selected incoming flight no longer available in this snapshot. Close or return without selecting replacement.</p> : <div className={`workbench-panes ${selection.outbound ? "has-connection" : ""} ${selection.bag ? "has-inspector" : ""}`}>
        <section className="connections-pane" inert={compact && !!selection.bag} aria-labelledby="connections-title"><div className="pane-heading"><div><h3 id="connections-title">Onward connections</h3><p>{header?.transferBagCount} transfer bags · {connections.length} connections</p></div></div>
          {!selection.outbound ? <div className="operational-scroll"><table className="operational-table"><thead><tr><th scope="col">Outbound flight</th><th scope="col">HKG → destination</th><th scope="col">Departure HKT</th><th scope="col">Handling cutoff HKT</th><th scope="col">Transfer bags</th><th scope="col">Action required</th><th scope="col">Connection risk /100</th></tr></thead><tbody>{connections.map(c => <tr key={c.leg.id} onClick={() => onSelection({ type: "outbound", id: c.leg.id })}><td><button className="row-link" data-outbound={c.leg.id} onClick={e => { e.stopPropagation(); onSelection({ type: "outbound", id: c.leg.id }); }}>{c.leg.flightNumber}</button><small>{c.leg.operatingDate}</small></td><td>HKG → {c.leg.destination}</td><td>{stale || !isOperationalProvenanceFresh(c.leg.provenance, now) ? "—" : stationTime(c.leg.estimatedDepartureAt ?? c.leg.scheduledDepartureAt)}</td><td>{stale ? "—" : stationTime(c.earliestActionAt)}</td><td>{c.transferBagCount}</td><td>{stale ? "—" : c.actionRequiredCount}</td><td>—</td></tr>)}</tbody></table>{!connections.length && <p className="table-empty">No associated onward connections available.</p>}</div> : <div className="connection-selector">{connections.map(c => <button key={c.leg.id} data-outbound={c.leg.id} aria-pressed={selection.outbound === c.leg.id} onClick={() => onSelection({ type: "outbound", id: c.leg.id })}><strong>{c.leg.flightNumber}<span>HKG → {c.leg.destination}</span></strong><span>{c.transferBagCount} bags · {stale ? "Unavailable" : flightAttention(c)}</span><span>Departure {stale || !isOperationalProvenanceFresh(c.leg.provenance, now) ? "—" : stationTime(c.leg.estimatedDepartureAt ?? c.leg.scheduledDepartureAt)} HKT</span></button>)}</div>}
        </section>
        {selection.outbound && <ConnectionBagTable snapshot={snapshot} inboundId={selection.inbound!} outboundId={selection.outbound} selectedTag={selection.bag} now={now} stale={stale} inert={compact && !!selection.bag} onSelect={id => onSelection({ type: "bag", id })} />}
        {selection.bag && <div className="inspector-pane">{selectedBag && relation && selectedConnection ? <BaggageInvestigationPanel bag={selectedBag} bagRisk={fresh ? bagRiskScore(snapshot, selectedBag.tag_number, now) : null} timeToAct={bagTime} connectionLabel={`${header?.leg.flightNumber ?? "—"} · ${selectedConnection.leg.flightNumber}`} onClose={back} /> : <div className="table-empty" role="status"><h3>Selected bag unavailable</h3><p>Bag no longer belongs to this connection in current snapshot.</p><button onClick={back}>Close baggage case</button></div>}</div>}
      </div>}
    </div>}
  </dialog>;
}
