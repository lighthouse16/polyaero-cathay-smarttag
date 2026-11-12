"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { timelineDomain } from "../../lib/dashboard";
import { formatTimeHHMM } from "../../lib/utils";

interface Props {
  bags: LiveBag[];
  selectedFlight: string | null;
  onSelectFlight: (flight: string) => void;
}
export function FlightTransferTimeline({
  bags,
  selectedFlight,
  onSelectFlight,
}: Props) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const rows = useMemo(
    () => [...bags].sort((a, b) => b.risk_score - a.risk_score).slice(0, 4),
    [bags],
  );
  const domain = useMemo(() => timelineDomain(rows), [rows]);
  const scale = (ms: number) =>
    domain ? 10 + ((ms - domain[0]) / (domain[1] - domain[0])) * 630 : 0;
  return (
    <section
      className="card-surface timeline"
      aria-label="Recorded transfer timeline"
    >
      <h2>
        Transfer timeline <span>Recorded events · HKT</span>
      </h2>
      <p>
        No inbound flight or verified transfer interval supplied. Dots show
        recorded events; outlined marker shows scheduled departure.
      </p>
      {!domain ? (
        <div className="empty">No timestamped events available.</div>
      ) : (
        <div
          className="timeline-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable transfer timeline"
        >
          <div className="axis-row">
            <div />{" "}
            <svg
              viewBox="0 0 650 34"
              role="img"
              aria-label="Shared timestamp axis"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const ms = domain[0] + ((domain[1] - domain[0]) * i) / 4;
                return (
                  <text
                    key={i}
                    x={scale(ms)}
                    y={24}
                    textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
                  >
                    {formatTimeHHMM(new Date(ms).toISOString())}
                  </text>
                );
              })}
            </svg>
          </div>
          {rows.map((bag) => (
            <div className="flight-row" key={bag.tag_number}>
              <button
                aria-pressed={selectedFlight === bag.flight_number}
                onClick={() => onSelectFlight(bag.flight_number)}
              >
                <strong>
                  {bag.flight_number} · {bag.departure_airport} →{" "}
                  {bag.arrival_airport}
                </strong>
                <small>
                  {bag.tag_number} · Buffer{" "}
                  {bag.connection_minutes == null
                    ? "unavailable"
                    : `${bag.connection_minutes} min`}
                </small>
              </button>
              <svg
                viewBox="0 0 650 44"
                role="img"
                aria-label={`Recorded events for ${bag.tag_number}`}
              >
                <line
                  x1="10"
                  y1="22"
                  x2="640"
                  y2="22"
                  stroke="#d5d9d4"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {bag.events.map((e) => (
                  <circle
                    tabIndex={0}
                    key={e.id}
                    cx={scale(Date.parse(e.timestamp))}
                    cy="22"
                    r="5"
                    fill={
                      ["MISROUTED", "MISSING"].includes(e.event_type)
                        ? "#8f3236"
                        : "#006564"
                    }
                  >
                    <title>
                      {e.event_type} ·{" "}
                      {new Date(e.timestamp).toLocaleString("en-GB", {
                        timeZone: "Asia/Hong_Kong",
                      })}{" "}
                      HKT · {e.scanner_type} · {e.station_name}
                    </title>
                  </circle>
                ))}
                {bag.departure_time &&
                  Number.isFinite(Date.parse(bag.departure_time)) && (
                    <rect
                      tabIndex={0}
                      x={scale(Date.parse(bag.departure_time)) - 4}
                      y="14"
                      width="8"
                      height="16"
                      fill="white"
                      stroke="#596663"
                      strokeWidth="2"
                    >
                      <title>Scheduled departure · {bag.departure_time}</title>
                    </rect>
                  )}
                {now != null && now >= domain[0] && now <= domain[1] && (
                  <g>
                    <line
                      x1={scale(now)}
                      x2={scale(now)}
                      y1="0"
                      y2="44"
                      stroke="#073b39"
                    />
                    <text x={scale(now) + 4} y="9">
                      Now
                    </text>
                  </g>
                )}
              </svg>
            </div>
          ))}
          {now != null && (now < domain[0] || now > domain[1]) && (
            <small>Current time outside recorded timeline range.</small>
          )}
        </div>
      )}
      <style jsx>{`
        .timeline {
          padding: 18px;
        }
        h2 {
          font-size: 19px;
          margin: 0;
        }
        h2 span {
          font-size: 11px;
          font-weight: 400;
          color: #56615d;
          margin-left: 10px;
        }
        p {
          font-size: 11.5px;
          color: #56615d;
          line-height: 1.5;
          margin: 8px 0;
        }
        .timeline-scroll {
          overflow-x: auto;
        }
        .axis-row,
        .flight-row {
          display: grid;
          grid-template-columns: 190px minmax(260px, 1fr);
          min-width: 450px;
          align-items: center;
        }
        svg {
          width: 100%;
          overflow: visible;
        }
        svg text {
          font-size: 12px;
          fill: #56615d;
        }
        .flight-row {
          border-top: 1px solid #efeee9;
        }
        button {
          display: block;
          text-align: left;
          background: none;
          border: 0;
          padding: 6px 8px;
          color: #192320;
          border-radius: 6px;
        }
        button[aria-pressed="true"] {
          background: #e9eeea;
        }
        strong {
          font-size: 12px;
        }
        small {
          display: block;
          font-size: 10.5px;
          color: #56615d;
          padding-top: 3px;
        }
        .empty {
          padding: 30px 0;
          color: #56615d;
          font-size: 12px;
        }
      `}</style>
    </section>
  );
}
