"use client";

import React, { useId, useMemo, useState } from "react";
import type { LiveBag } from "../../lib/types";
import {
  formatStatusLabel,
  formatTimeHHMM,
  isAtRiskBag,
  isExceptionBag,
  scannerBadgeLabel,
} from "../../lib/utils";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  SearchIcon,
} from "../icons/DashboardIcons";

interface SecondaryViewProps {
  bags: LiveBag[];
  selectedTagNumber: string;
  onSelectBag: (tagNumber: string) => void;
  onSwitchToTransferControl: () => void;
}

export function ExceptionsView({
  bags,
  selectedTagNumber,
  onSelectBag,
}: SecondaryViewProps) {
  const exceptions = useMemo(
    () =>
      bags
        .filter((b) => isExceptionBag(b) || b.risk_score >= 65)
        .sort((a, b) => b.risk_score - a.risk_score),
    [bags],
  );

  return (
    <section aria-label="Active Exceptions and Priority Intercepts">
      <div style={{ marginBottom: "18px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "34px",
            fontWeight: 700,
            color: "#141918",
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
          }}
        >
          Active Exceptions &amp; Priority Intercepts
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#4C5755" }}>
          Baggage records currently flagged for exception handling or elevated
          risk score.
        </p>
      </div>

      {exceptions.length === 0 ? (
        <div
          className="card-surface"
          style={{ padding: "36px 24px", textAlign: "center" }}
        >
          <CheckCircleIcon size={28} color="#006564" />
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              marginTop: "10px",
              color: "#141918",
            }}
          >
            Zero active exceptions
          </div>
          <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>
            No baggage records in current station snapshot are flagged as
            exceptions.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {exceptions.map((bag) => {
            const active = bag.tag_number === selectedTagNumber;
            return (
              <button
                key={bag.tag_number}
                type="button"
                aria-pressed={active}
                aria-label={`Select exception bag ${bag.tag_number} for ${bag.passenger_name}`}
                onClick={() => onSelectBag(bag.tag_number)}
                className="card-surface focus-ring"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 18px",
                  borderColor: active
                    ? "#004B4A"
                    : isExceptionBag(bag)
                      ? "#D8D3CB"
                      : "#E8E5DE",
                  backgroundColor: active ? "#F3F1EC" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "9px",
                      backgroundColor: "#F3F1EC",
                      border: "1px solid #D8D3CB",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangleIcon size={17} color="#87323A" />
                  </span>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "#141918",
                        }}
                      >
                        {bag.tag_number}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        {bag.passenger_name}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          backgroundColor: "#F3F1EC",
                          border: "1px solid #D8D3CB",
                          color: "#762830",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {formatStatusLabel(bag.status)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: "#4C5755",
                        marginTop: "4px",
                      }}
                    >
                      {bag.flight_number} ({bag.departure_airport} →{" "}
                      {bag.arrival_airport}) · {bag.last_known_location}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#762830",
                        marginTop: "4px",
                        fontWeight: 500,
                      }}
                    >
                      {bag.passenger_risk_summary || bag.recommended_action}
                    </div>
                  </div>
                </div>
                <div
                  style={{ textAlign: "right", flexShrink: 0 }}
                  className="tabular-nums"
                >
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#762830",
                    }}
                  >
                    {bag.risk_score}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7280" }}>
                    Risk score
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function BaggageTraceView({
  bags,
  selectedTagNumber,
  onSelectBag,
}: SecondaryViewProps) {
  const [query, setQuery] = useState("");
  const searchInputId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bags;
    return bags.filter((b) =>
      `${b.tag_number} ${b.tag_code} ${b.booking_reference} ${b.passenger_name} ${b.flight_number}`
        .toLowerCase()
        .includes(q),
    );
  }, [bags, query]);

  return (
    <section aria-label="Baggage Trace and Scan Audit">
      <div style={{ marginBottom: "16px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "34px",
            fontWeight: 700,
            color: "#141918",
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
          }}
        >
          Baggage Trace &amp; Scan Audit
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#4C5755" }}>
          Recorded baggage events across reported Optical, RFID, PN532 NFC, and
          Staff Override entries.
        </p>
      </div>

      <div
        className="card-surface"
        style={{
          padding: "12px 14px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <SearchIcon size={16} color="#006564" />
        <label htmlFor={searchInputId} className="sr-only">
          Trace baggage by bag tag, NFC UID, PNR, flight, or passenger
        </label>
        <input
          id={searchInputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Trace by 10-digit bag tag, NFC UID, PNR, flight, or passenger..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "13.5px",
            color: "#141918",
            backgroundColor: "transparent",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {results.map((bag) => {
          const active = bag.tag_number === selectedTagNumber;
          return (
            <button
              key={bag.tag_number}
              type="button"
              aria-pressed={active}
              aria-label={`Inspect trace for bag ${bag.tag_number}, ${bag.passenger_name}`}
              onClick={() => onSelectBag(bag.tag_number)}
              className="card-surface focus-ring"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                cursor: "pointer",
                borderColor: active ? "#004B4A" : "#E8E5DE",
                backgroundColor: active ? "#EFEEE9" : "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div>
                  <span
                    className="tabular-nums"
                    style={{
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "#141918",
                    }}
                  >
                    {bag.tag_number}
                  </span>
                  <span style={{ margin: "0 8px", color: "#9CA3AF" }}>·</span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "#374151",
                    }}
                  >
                    {bag.passenger_name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "#004B4A",
                  }}
                >
                  {bag.flight_number} ({bag.departure_airport} →{" "}
                  {bag.arrival_airport})
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {(bag.events || []).map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      fontSize: "11.5px",
                      padding: "4px 9px",
                      borderRadius: "7px",
                      backgroundColor: "#FAF9F5",
                      border: "1px solid #E8E5DE",
                      color: "#374151",
                    }}
                  >
                    <strong className="tabular-nums">
                      {formatTimeHHMM(evt.timestamp)}
                    </strong>{" "}
                    · {formatStatusLabel(evt.event_type)} (
                    {scannerBadgeLabel(evt.scanner_type)})
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PerformanceView({
  bags,
  onSwitchToTransferControl,
}: SecondaryViewProps) {
  const stats = useMemo(() => {
    const total = bags.length;
    const exceptions = bags.filter(isExceptionBag).length;
    const atRisk = bags.filter(isAtRiskBag).length;
    const avgRisk =
      total > 0
        ? Math.round(bags.reduce((s, b) => s + b.risk_score, 0) / total)
        : 0;
    const totalEvents = bags.reduce((s, b) => s + (b.events?.length ?? 0), 0);
    return { total, exceptions, atRisk, avgRisk, totalEvents };
  }, [bags]);

  return (
    <section aria-label="Station Snapshot Summary">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "18px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "34px",
              fontWeight: 700,
              color: "#141918",
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
            }}
          >
            Station Snapshot Metrics
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#4C5755" }}>
            Current snapshot counts from loaded station records. Historical
            recovery durations and verified completion rates are unavailable.
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitchToTransferControl}
          className="focus-ring touch-target"
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#004B4A",
            color: "#FFFFFF",
            fontSize: "12.5px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back to Transfer Control
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <div className="card-surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600 }}>
            Records in Snapshot
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: "30px",
              fontWeight: 700,
              color: "#141918",
              marginTop: "4px",
            }}
          >
            {stats.total}
          </div>
          <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
            {stats.totalEvents} scan events logged
          </div>
        </div>

        <div className="card-surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600 }}>
            Flagged At-Risk
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: "30px",
              fontWeight: 700,
              color: "#8C420B",
              marginTop: "4px",
            }}
          >
            {stats.atRisk}
          </div>
          <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
            {stats.exceptions} active exceptions
          </div>
        </div>

        <div className="card-surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600 }}>
            Mean Risk Score
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: "30px",
              fontWeight: 700,
              color: "#004B4A",
              marginTop: "4px",
            }}
          >
            {stats.avgRisk}/100
          </div>
          <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
            Model estimate on active records
          </div>
        </div>

        <div
          className="card-surface"
          style={{ padding: "16px 18px", backgroundColor: "#FAF9F5" }}
        >
          <div style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600 }}>
            Recovery Duration / Rate
          </div>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#4C5755",
              marginTop: "8px",
            }}
          >
            Unavailable
          </div>
          <div style={{ fontSize: "11px", color: "#76827F", marginTop: "3px" }}>
            Requires end-to-end physical telemetry
          </div>
        </div>
      </div>

      <div className="card-surface" style={{ padding: "18px 20px" }}>
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: "14.5px",
            fontWeight: 700,
            color: "#141918",
          }}
        >
          Risk Score Distribution (Current Snapshot)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...bags]
            .sort((a, b) => b.risk_score - a.risk_score)
            .map((bag) => (
              <div
                key={bag.tag_number}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 48px",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: "12.5px",
                }}
              >
                <span
                  className="tabular-nums"
                  style={{ fontWeight: 600, color: "#141918" }}
                >
                  {bag.tag_number}
                </span>
                <div
                  role="progressbar"
                  aria-valuenow={bag.risk_score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Risk score for bag ${bag.tag_number}`}
                  style={{
                    height: "8px",
                    borderRadius: "999px",
                    backgroundColor: "#ECEAE3",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${bag.risk_score}%`,
                      height: "100%",
                      borderRadius: "999px",
                      backgroundColor:
                        bag.risk_score >= 70
                          ? "#87323A"
                          : bag.risk_score >= 40
                            ? "#856432"
                            : "#006564",
                    }}
                  />
                </div>
                <span
                  className="tabular-nums"
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#374151",
                  }}
                >
                  {bag.risk_score}
                </span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
