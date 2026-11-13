"use client";

import React from "react";
import type { LiveBag } from "../../lib/types";
import { parseRiskFactors } from "../../lib/utils";

interface RiskFactorsListProps {
  bag: LiveBag;
}

export function RiskFactorsList({ bag }: RiskFactorsListProps) {
  const factors = parseRiskFactors(bag);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: "13.5px",
          fontWeight: 700,
          color: "#141918",
        }}
      >
        Risk drivers
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {factors.map((f, idx) => {
          const barColor =
            f.severity === "high"
              ? "#87323A"
              : f.severity === "medium"
                ? "#947243"
                : "#B9BDB7";

          if (f.weightPct !== null) {
            return (
              <div
                key={`${f.label}-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 64px 32px",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#374151",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={f.label}
                >
                  {f.label}
                </span>
                <div
                  style={{
                    height: "6px",
                    borderRadius: "999px",
                    backgroundColor: "#EAE8E1",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(8, f.weightPct))}%`,
                      height: "100%",
                      borderRadius: "999px",
                      backgroundColor: barColor,
                      transition: "width 0.35s ease",
                    }}
                  />
                </div>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 500,
                    color: "#4B5563",
                    textAlign: "right",
                  }}
                >
                  {f.weightPct}%
                </span>
              </div>
            );
          }

          return (
            <div
              key={`${f.label}-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "#374151",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: barColor,
                  flexShrink: 0,
                }}
              />
              <span>{f.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
