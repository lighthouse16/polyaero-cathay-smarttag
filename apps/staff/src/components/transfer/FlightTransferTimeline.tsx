"use client";

import React, { useMemo } from "react";
import type { LiveBag } from "../../lib/types";
import { CathayBrushwingIcon } from "../icons/DashboardIcons";

interface Props {
  bags: LiveBag[];
  selectedFlight: string | null;
  onSelectFlight: (flight: string) => void;
}

interface TimelineFlightRow {
  flightNumber: string;
  route: string;
  arrTime: string;
  depTime: string;
  transferMinutes: number;
  arrivedPct: number;
  transferPct: number;
  departsPct: number;
  isAtRisk: boolean;
  isHatchedTail: boolean;
}

const TIME_TICKS = [
  "14:00",
  "14:15",
  "14:30",
  "14:45",
  "15:00",
  "15:15",
  "15:30",
  "15:45",
  "16:00",
  "16:15",
  "16:30",
];

const FLIGHT_META: Record<
  string,
  { arrTime: string; depTime: string; isHatchedTail: boolean }
> = {
  CX255: { arrTime: "14:15", depTime: "16:30", isHatchedTail: false },
  CX703: { arrTime: "13:52", depTime: "15:40", isHatchedTail: true },
};

export function FlightTransferTimeline({
  bags,
  selectedFlight,
  onSelectFlight,
}: Props) {
  const rows = useMemo<TimelineFlightRow[]>(() => {
    const byFlight = new Map<string, LiveBag>();
    const sorted = [...bags].sort((a, b) => b.risk_score - a.risk_score);
    for (const bag of sorted) {
      if (!byFlight.has(bag.flight_number)) {
        byFlight.set(bag.flight_number, bag);
      }
      if (byFlight.size >= 2) break;
    }

    if (byFlight.size === 0) return [];

    return Array.from(byFlight.values()).map((bag, idx) => {
      const meta = FLIGHT_META[bag.flight_number];
      const transferMinutes = bag.connection_minutes ?? (idx === 0 ? 35 : 48);
      const isAtRisk =
        bag.risk_score >= 70 ||
        bag.status === "MISROUTED" ||
        transferMinutes <= 38;
      return {
        flightNumber: bag.flight_number,
        route: `${bag.departure_airport} → ${bag.arrival_airport}`,
        arrTime: meta?.arrTime ?? "14:15",
        depTime: meta?.depTime ?? "16:30",
        transferMinutes,
        arrivedPct: idx === 0 ? 31 : 31,
        transferPct: idx === 0 ? 40 : 41,
        departsPct: idx === 0 ? 29 : 28,
        isAtRisk,
        isHatchedTail: meta?.isHatchedTail ?? idx === 1,
      };
    });
  }, [bags]);

  // 14:32 sits between 14:30 (tick 2 of 10) and 14:45 (tick 3 of 10): ~21.3% across the bar area
  const nowMarkerLeftPct = 21.3;

  return (
    <section
      className="card-surface"
      aria-label="Transfer timeline"
      style={{
        padding: "14px 18px 16px",
        backgroundColor: "#FFFFFF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          marginBottom: "6px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "15.5px",
            fontWeight: 700,
            color: "#000000",
            letterSpacing: "-0.01em",
          }}
        >
          Transfer timeline
        </h2>
        <span
          title="Live baggage transfer window and make-up progress (HKT)"
          aria-label="Transfer timeline info"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "15px",
            height: "15px",
            borderRadius: "999px",
            border: "1px solid #C5CCC9",
            color: "#000000",
            fontSize: "10px",
            fontWeight: 700,
            lineHeight: 1,
            cursor: "help",
          }}
        >
          i
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: "12.5px", color: "#000000", padding: "12px 0" }}>
          No active transfer flights in current view.
        </div>
      ) : (
        <div
          className="timeline-scroll"
          tabIndex={0}
          role="region"
          aria-label="Flight transfer timeline bars"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingTop: "4px",
            paddingBottom: "4px",
          }}
        >
          <div style={{ minWidth: "560px", position: "relative" }}>
            {/* Continuous vertical 14:32 line running from badge down through bars */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `calc(166px + (100% - 166px) * ${nowMarkerLeftPct / 100})`,
                top: "22px",
                bottom: "0px",
                width: "1.5px",
                transform: "translateX(-50%)",
                backgroundColor: "#0B4D3E",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />

            {/* Time axis header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "154px 1fr",
                alignItems: "end",
                gap: "12px",
                marginBottom: "8px",
                paddingTop: "28px",
              }}
            >
              <div />
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10.5px",
                  color: "#000000",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: `${nowMarkerLeftPct}%`,
                    top: "-24px",
                    transform: "translateX(-50%)",
                    backgroundColor: "#0B4D3E",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 700,
                    lineHeight: 1.25,
                    padding: "2px 7px",
                    borderRadius: "5px",
                    letterSpacing: "0.01em",
                    boxShadow: "0 1px 3px rgba(11,77,62,0.25)",
                    zIndex: 3,
                    display: "inline-block",
                  }}
                >
                  14:32
                </span>
                {TIME_TICKS.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </div>

            {/* Flight rows */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                position: "relative",
              }}
            >

              {rows.map((row) => {
                const isSelected = selectedFlight === row.flightNumber;
                return (
                  <div
                    key={row.flightNumber}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "154px 1fr",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectFlight(row.flightNumber)}
                      className="focus-ring"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        textAlign: "left",
                        background: isSelected ? "#F0EFEB" : "transparent",
                        border: isSelected
                          ? "1px solid #D6D3CB"
                          : "1px solid transparent",
                        borderRadius: "8px",
                        padding: "4px 6px",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <CathayBrushwingIcon
                        style={{
                          width: "22px",
                          height: "18px",
                          color: "#000000",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: "#000000",
                            whiteSpace: "nowrap",
                            lineHeight: 1.25,
                          }}
                        >
                          {row.flightNumber}{" "}
                          <span style={{ fontWeight: 700, color: "#000000" }}>
                            {row.route}
                          </span>
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: "10.5px",
                            color: "#000000",
                            marginTop: "1px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Arr {row.arrTime} · Dep {row.depTime}
                        </div>
                      </div>
                    </button>

                    {/* Segmented transfer bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        height: "28px",
                        borderRadius: "6px",
                        overflow: "hidden",
                        border: "1px solid rgba(20, 25, 24, 0.06)",
                        backgroundColor: "#F3F4F2",
                      }}
                    >
                      <div
                        style={{
                          width: `${row.arrivedPct}%`,
                          backgroundColor: "#E5E8E3",
                          color: "#000000",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          borderRight: "1px solid rgba(255,255,255,0.7)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Arrived
                      </div>

                      <div
                        className="tabular-nums"
                        style={{
                          width: `${row.transferPct}%`,
                          backgroundColor: row.isAtRisk ? "#E9E5DC" : "#E5E8E3",
                          color: "#000000",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRight: "1px solid rgba(255,255,255,0.7)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Transfer ({row.transferMinutes}m)
                      </div>

                      <div
                        className={row.isHatchedTail ? "hatched-bar" : undefined}
                        style={{
                          width: `${row.departsPct}%`,
                          backgroundColor: row.isHatchedTail
                            ? undefined
                            : "#E9ECEB",
                          color: "#000000",
                          fontSize: "11.5px",
                          fontWeight: 400,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.isHatchedTail ? "" : "Departs"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
