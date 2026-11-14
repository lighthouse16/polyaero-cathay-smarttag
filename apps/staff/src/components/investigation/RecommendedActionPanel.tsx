"use client";

import React, { useState } from "react";
import type { LiveBag } from "../../lib/types";
import type { PendingStaffAction } from "./ActionConfirmationModal";
import { CheckIcon, ChevronDownIcon, TruckIcon } from "../icons/DashboardIcons";

interface RecommendedActionPanelProps {
  bag: LiveBag;
  isSyncing: boolean;
  onRequestAction: (action: PendingStaffAction) => void;
  onEvaluateRisk: () => void;
}

export function RecommendedActionPanel({
  bag,
  isSyncing,
  onRequestAction,
  onEvaluateRisk,
}: RecommendedActionPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div style={{ marginTop: "14px" }}>
      <h3
        style={{
          margin: "0 0 9px",
          fontSize: "13.5px",
          fontWeight: 700,
          color: "#000000",
        }}
      >
        Recommended action
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          position: "relative",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={isSyncing}
          onClick={() =>
            onRequestAction({
              targetStatus: "RECOVERY_IN_PROGRESS",
              title: "Dispatch for retrieval",
              description:
                "Dispatches ramp retrieval team and records recovery in progress in the station database.",
              ctaLabel: "Dispatch for retrieval",
              tone: "jade",
            })
          }
          className="focus-ring touch-target"
          style={{
            flex: "1 1 140px",
            minHeight: "42px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#004B4A",
            color: "#FFFFFF",
            fontSize: "12.5px",
            fontWeight: 700,
            padding: "0 14px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            cursor: isSyncing ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <TruckIcon size={15} color="#FFFFFF" />
          <span>Dispatch for retrieval</span>
        </button>

        <div style={{ display: "inline-flex", alignItems: "stretch", flex: "1 1 140px" }}>
          <button
            type="button"
            disabled={isSyncing}
            onClick={() =>
              onRequestAction({
                targetStatus: "LOADED",
                title: "Mark as located",
                description:
                  "Confirms bag is located and updates baggage status to LOADED in the station record.",
                ctaLabel: "Mark as located",
                tone: "jade",
              })
            }
            className="focus-ring touch-target"
            style={{
              flex: 1,
              minHeight: "42px",
              borderRadius: "8px 0 0 8px",
              border: "1px solid #D6D1C6",
              borderRight: "none",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              fontSize: "12.5px",
              fontWeight: 700,
              padding: "0 12px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              cursor: isSyncing ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <CheckIcon size={14} color="#004B4A" />
            <span>Mark as located</span>
          </button>

          <button
            type="button"
            aria-label="More station status actions"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className="focus-ring touch-target"
            style={{
              minHeight: "42px",
              width: "36px",
              borderRadius: "0 8px 8px 0",
              border: "1px solid #D6D1C6",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronDownIcon size={14} />
          </button>
        </div>

        {moreOpen && (
          <div
            role="menu"
            aria-label="Additional baggage status actions"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E1DB",
              borderRadius: "10px",
              boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
              padding: "5px",
              zIndex: 35,
              minWidth: "220px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onRequestAction({
                  targetStatus: "MISROUTED",
                  title: "Record misrouted status",
                  description: `Flags baggage tag ${bag.tag_number} as MISROUTED in station records.`,
                  ctaLabel: "Record misrouted status",
                  tone: "danger",
                });
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 11px",
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 700,
                color: "#000000",
                cursor: "pointer",
              }}
            >
              Record Misrouted Exception
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onRequestAction({
                  targetStatus: "MISSING",
                  title: "Record missing status",
                  description: `Flags baggage tag ${bag.tag_number} as MISSING in station records.`,
                  ctaLabel: "Record missing status",
                  tone: "danger",
                });
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 11px",
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 700,
                color: "#000000",
                cursor: "pointer",
              }}
            >
              Record Missing (Trace Required)
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onRequestAction({
                  targetStatus: "CHECKED_IN",
                  title: "Record bag accepted",
                  description: `Records bag ${bag.tag_number} accepted at current station.`,
                  ctaLabel: "Record bag accepted",
                  tone: "jade",
                });
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 11px",
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 400,
                color: "#000000",
                cursor: "pointer",
              }}
            >
              Record bag accepted
            </button>
            <div
              style={{
                height: "1px",
                backgroundColor: "#F0EFEB",
                margin: "4px 0",
              }}
            />
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onEvaluateRisk();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 11px",
                border: "none",
                borderRadius: "6px",
                background: "#FAF9F5",
                fontSize: "12px",
                fontWeight: 700,
                color: "#000000",
                cursor: "pointer",
              }}
            >
              Evaluate AI Risk Model
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
