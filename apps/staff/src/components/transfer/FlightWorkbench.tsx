"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { OutboundFlightSummary, TransferControlSnapshot } from "../../lib/types";
import {
  aggregateOutboundFlights,
  aggregateInboundConnections,
  bagRiskScore,
  timeToActMinutes,
  isConnectionFresh,
  isOperationalProvenanceFresh,
  findBagConnection,
} from "../../lib/transferControl";
import { BaggageInvestigationPanel } from "../investigation/BaggageInvestigationPanel";
import { ArrowLeftIcon, ChevronRightIcon, CloseIcon } from "../icons/DashboardIcons";
import { ConnectionBagTable } from "./ConnectionBagTable";
import { stationTime, flightAttention } from "./OutboundFlightQueue";
import { WorkbenchMetrics } from "./WorkbenchMetrics";
import { OperationsCopilotDrawer } from "../copilot/OperationsCopilotDrawer";
import type { SelectionAction, TransferSelection } from "./selection";

export function FlightWorkbench({
  snapshot,
  selection,
  now,
  stale,
  onSelection,
  copilotOpen = false,
  onCopilotOpenChange,
}: {
  snapshot: TransferControlSnapshot;
  selection: TransferSelection;
  now: Date;
  stale: boolean;
  onSelection: (action: SelectionAction) => void;
  copilotOpen?: boolean;
  onCopilotOpenChange?: (open: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const cachedOutbound = useRef<OutboundFlightSummary | null>(null);
  const [compact, setCompact] = useState(false);
  const [bagSearch, setBagSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const outboundFocus = useRef<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1280px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const outbound = aggregateOutboundFlights(snapshot, now).find(
    (f) => f.leg.id === selection.outbound,
  );
  if (outbound) cachedOutbound.current = outbound;
  const header =
    outbound ?? (cachedOutbound.current?.leg.id === selection.outbound ? cachedOutbound.current : null);
  const connections = useMemo(
    () => (selection.outbound ? aggregateInboundConnections(snapshot, selection.outbound, now) : []),
    [snapshot, selection.outbound, now],
  );
  const selectedConnection = connections.find((c) => c.leg.id === selection.inbound);
  const selectedBag = snapshot.bags.find((b) => b.tag_number === selection.bag) ?? null;
  const relation = snapshot.connections.find(
    (c) =>
      c.bagTag === selection.bag &&
      c.outboundLegId === selection.outbound &&
      c.inboundLegId === selection.inbound,
  );
  const open = !!selection.outbound;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      outboundFocus.current = selection.outbound;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      const trigger = outboundFocus.current
        ? document.querySelector<HTMLElement>(`[data-outbound="${CSS.escape(outboundFocus.current)}"]`)
        : null;
      if (trigger) trigger.focus();
      else if (openerRef.current?.isConnected && openerRef.current !== document.body) {
        openerRef.current.focus();
      } else {
        document.querySelector<HTMLElement>("#staff-main h1")?.focus();
      }
    }
  }, [open, selection.outbound]);

  useEffect(() => {
    if (selection.bag) document.getElementById("case-heading")?.focus();
  }, [selection.bag]);

  function back() {
    const target = selection.bag
      ? `[data-bag="${CSS.escape(selection.bag)}"]`
      : selection.inbound
        ? `[data-inbound="${CSS.escape(selection.inbound)}"]`
        : null;
    onSelection({ type: "back" });
    if (target) requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(target)?.focus());
  }

  const fresh = !stale && !!outbound && isOperationalProvenanceFresh(outbound.leg.provenance, now);
  const bagTime =
    fresh && relation?.status === "pending" && isConnectionFresh(snapshot, relation, now)
      ? timeToActMinutes(relation.deadline, now)
      : null;

  function searchBag(event: React.FormEvent) {
    event.preventDefault();
    const connection = findBagConnection(snapshot, bagSearch.trim());
    if (!connection) {
      setSearchError("Bag flight context unavailable.");
      return;
    }
    setSearchError("");
    onSelection({ type: "outbound", id: connection.outboundLegId });
    onSelection({ type: "inbound", id: connection.inboundLegId });
    onSelection({ type: "bag", id: connection.bagTag });
  }

  return (
    <dialog
      ref={dialogRef}
      className="flight-dialog"
      aria-labelledby="workbench-title"
      aria-describedby="workbench-description"
      onCancel={(e) => {
        e.preventDefault();
        back();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onSelection({ type: "close" });
      }}
    >
      {open && (
        <div className="flight-workbench">
          <header className="workbench-header">
            <div className="workbench-title">
              <p>Outbound flight</p>
              <h2 id="workbench-title">
                {header?.leg.flightNumber ?? "Flight unavailable"}
                <span>{header ? `HKG → ${header.leg.destination}` : ""}</span>
              </h2>
              <p id="workbench-description">
                {header?.leg.operatingDate ?? "—"} · Departure / ETD{" "}
                {fresh
                  ? stationTime(
                      header?.leg.estimatedDepartureAt ?? header?.leg.scheduledDepartureAt,
                    )
                  : "—"}{" "}
                HKT
              </p>
            </div>
            <WorkbenchMetrics header={header} fresh={fresh} now={now} />
            <button
              autoFocus
              className="icon-button"
              aria-label="Close transfer workbench"
              onClick={() => onSelection({ type: "close" })}
            >
              <CloseIcon size={18} color="#2D2D2D" />
            </button>
          </header>

          <div className="workbench-context">
            <div className="workbench-nav-trail">
              <button
                type="button"
                className="back-button"
                onClick={back}
                aria-label={
                  selection.bag
                    ? "Back to connection bags"
                    : selection.inbound
                      ? "Back to incoming feeder flights"
                      : "Back to outbound flights"
                }
              >
                <ArrowLeftIcon size={15} color="#2D2D2D" />
                Back
              </button>
              <nav className="breadcrumbs" aria-label="Transfer drill-down">
                <button type="button" onClick={() => onSelection({ type: "close" })}>
                  Queue
                </button>
                <ChevronRightIcon size={12} color="#66686A" />
                <button
                  type="button"
                  aria-current={!selection.inbound ? "location" : undefined}
                  onClick={() => selection.outbound && onSelection({ type: "outbound", id: selection.outbound })}
                >
                  {header?.leg.flightNumber ?? "Outbound"}
                </button>
                {selection.inbound && selectedConnection && (
                  <>
                    <ChevronRightIcon size={12} color="#66686A" />
                    <button
                      type="button"
                      aria-current={!selection.bag ? "location" : undefined}
                      onClick={() =>
                        onSelection({ type: "inbound", id: selectedConnection.leg.id })
                      }
                    >
                      {selectedConnection.leg.flightNumber} ({selectedConnection.leg.origin})
                    </button>
                  </>
                )}
                {selection.bag && (
                  <>
                    <ChevronRightIcon size={12} color="#66686A" />
                    <span aria-current="location" className="breadcrumb-leaf">
                      {selection.bag}
                    </span>
                  </>
                )}
              </nav>
            </div>

            <form className="workbench-search" onSubmit={searchBag}>
              <input
                id="workbench-bag-search"
                name="workbench-bag-search"
                data-workbench-search
                aria-label="Locate bag within transfer flights"
                placeholder="Full bag tag"
                value={bagSearch}
                onChange={(e) => {
                  setBagSearch(e.target.value);
                  if (searchError) setSearchError("");
                }}
              />
              <button type="submit">Find bag</button>
            </form>
            {searchError && (
              <span className="workbench-inline-status" role="status">
                {searchError}
              </span>
            )}
            {stale && (
              <span className="workbench-inline-status" role="status">
                Snapshot stale · current risk and deadlines unavailable
              </span>
            )}
          </div>

          {!outbound ? (
            <p className="table-empty" role="status">
              Selected outbound flight no longer available in this snapshot. Close or return without
              selecting replacement.
            </p>
          ) : (
            <div
              className={`workbench-panes ${selection.inbound ? "has-connection" : ""} ${
                selection.bag ? "has-inspector" : ""
              }`}
            >
              <section
                className="connections-pane"
                inert={compact && !!selection.bag}
                aria-labelledby="connections-title"
              >
                <div className="pane-heading">
                  <div>
                    <h3 id="connections-title">Incoming feeder flights</h3>
                    <p>
                      {header?.transferBagCount} transfer bags · {connections.length}{" "}
                      {connections.length === 1 ? "feeder flight" : "feeder flights"}
                    </p>
                  </div>
                </div>
                {!selection.inbound ? (
                  <div className="operational-scroll">
                    <table className="operational-table">
                      <thead>
                        <tr>
                          <th scope="col">Inbound flight</th>
                          <th scope="col">Origin → HKG</th>
                          <th scope="col">Arrival / ETA</th>
                          <th scope="col">Handling cutoff HKT</th>
                          <th scope="col">Transfer bags</th>
                          <th scope="col">Action required</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {connections.map((c) => {
                          const attn = stale ? "Unavailable" : flightAttention(c);
                          return (
                            <tr
                              key={c.leg.id}
                              tabIndex={0}
                              className="interactive-row"
                              onClick={() => onSelection({ type: "inbound", id: c.leg.id })}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                                } else if (
                                  (e.key === "Enter" || e.key === " ") &&
                                  (e.target as HTMLElement).tagName !== "BUTTON"
                                ) {
                                  e.preventDefault();
                                  onSelection({ type: "inbound", id: c.leg.id });
                                }
                              }}
                            >
                              <td>
                                <button
                                  className="row-link"
                                  data-inbound={c.leg.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelection({ type: "inbound", id: c.leg.id });
                                  }}
                                >
                                  {c.leg.flightNumber}
                                </button>
                                <small>{c.leg.operatingDate}</small>
                              </td>
                              <td>{c.leg.origin} → HKG</td>
                              <td>
                                {stale || !isOperationalProvenanceFresh(c.leg.provenance, now)
                                  ? "—"
                                  : stationTime(
                                      c.leg.actualArrivalAt ??
                                        c.leg.estimatedArrivalAt ??
                                        c.leg.scheduledArrivalAt,
                                    )}
                              </td>
                              <td>{stale ? "—" : stationTime(c.earliestActionAt)}</td>
                              <td>{c.transferBagCount}</td>
                              <td>{stale ? "—" : c.actionRequiredCount}</td>
                              <td>
                                <span className="status-cell-wrap">
                                  <span
                                    className="status-pill"
                                    data-tone={
                                      attn === "Action required"
                                        ? "action"
                                        : attn === "At risk"
                                          ? "risk"
                                          : attn === "On track"
                                            ? "track"
                                            : "unknown"
                                    }
                                  >
                                    {attn === "Unavailable" ? "—" : attn}
                                  </span>
                                  <ChevronRightIcon size={14} className="row-chevron" />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!connections.length && (
                      <p className="table-empty">No associated incoming feeder flights available.</p>
                    )}
                  </div>
                ) : (
                  <div className="connection-selector">
                    {connections.map((c) => {
                      const attn = stale ? "Unavailable" : flightAttention(c);
                      return (
                        <button
                          key={c.leg.id}
                          data-inbound={c.leg.id}
                          aria-pressed={selection.inbound === c.leg.id}
                          onClick={() => onSelection({ type: "inbound", id: c.leg.id })}
                        >
                          <strong>
                            {c.leg.flightNumber}
                            <span>{c.leg.origin} → HKG</span>
                          </strong>
                          <span>
                            {c.transferBagCount} bags · {attn}
                          </span>
                          <span>
                            Arrival{" "}
                            {stale || !isOperationalProvenanceFresh(c.leg.provenance, now)
                              ? "—"
                              : stationTime(
                                  c.leg.actualArrivalAt ??
                                    c.leg.estimatedArrivalAt ??
                                    c.leg.scheduledArrivalAt,
                                )}{" "}
                            HKT
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {selection.inbound && (
                <ConnectionBagTable
                  key={`${selection.outbound}-${selection.inbound}`}
                  snapshot={snapshot}
                  inboundId={selection.inbound}
                  outboundId={selection.outbound!}
                  selectedTag={selection.bag}
                  now={now}
                  stale={stale}
                  inert={compact && !!selection.bag}
                  onSelect={(id) => onSelection({ type: "bag", id })}
                />
              )}

              {selection.bag && (
                <div key={selection.bag} className="inspector-pane">
                  {selectedBag && relation && selectedConnection ? (
                    <BaggageInvestigationPanel
                      bag={selectedBag}
                      bagRisk={fresh ? bagRiskScore(snapshot, selectedBag.tag_number, now) : null}
                      timeToAct={bagTime}
                      connectionLabel={`${header?.leg.flightNumber ?? "—"} ← ${selectedConnection.leg.flightNumber}`}
                      onClose={back}
                    />
                  ) : (
                    <div className="table-empty" role="status">
                      <h3>Selected bag unavailable</h3>
                      <p>Bag no longer belongs to this connection in current snapshot.</p>
                      <button className="back-button" onClick={back}>
                        Close baggage case
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {onCopilotOpenChange && (
            <OperationsCopilotDrawer
              open={copilotOpen}
              onOpenChange={onCopilotOpenChange}
              snapshot={snapshot}
              now={now}
              activeView="transfer-control"
              onLocateBag={(tag) => {
                const connection = findBagConnection(snapshot, tag);
                if (connection) {
                  onSelection({ type: "outbound", id: connection.outboundLegId });
                  onSelection({ type: "inbound", id: connection.inboundLegId });
                  onSelection({ type: "bag", id: connection.bagTag });
                }
              }}
              onSelectOutboundFlight={(id) => onSelection({ type: "outbound", id })}
            />
          )}
        </div>
      )}
    </dialog>
  );
}
