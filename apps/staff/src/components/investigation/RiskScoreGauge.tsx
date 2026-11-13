"use client";

import React, { useEffect, useState } from "react";

interface RiskScoreGaugeProps {
  score: number;
}

export function RiskScoreGauge({ score }: RiskScoreGaugeProps) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const safeScore = Number.isFinite(score) ? score : 0;
  const clamped = Math.max(0, Math.min(100, Math.round(safeScore)));
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  // Open arc ~300 degrees (83.3% of full circle), starting near top-left
  const arcFraction = 0.84;
  const trackLength = circumference * arcFraction;
  const filledLength = (clamped / 100) * trackLength;

  const strokeColor =
    clamped >= 70 ? "#87323A" : clamped >= 40 ? "#856432" : "#2D614E";

  return (
    <div
      style={{
        position: "relative",
        width: "92px",
        height: "92px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="img"
      aria-label={`Risk score ${clamped} out of 100`}
    >
      <svg
        width="92"
        height="92"
        viewBox="0 0 92 92"
        style={{ transform: "rotate(120deg)" }}
      >
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="#ECEAE2"
          strokeWidth="8.5"
          strokeDasharray={`${trackLength} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8.5"
          strokeDasharray={`${entered ? filledLength : 0} ${circumference}`}
          strokeLinecap="round"
          style={{
            transition:
              "stroke-dasharray 0.85s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.25s ease",
          }}
        />
      </svg>
      <div
        className="tabular-nums"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1.05,
        }}
      >
        <span style={{ fontSize: "23px", fontWeight: 700, color: "#141918" }}>
          {clamped}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "#6B7280",
            marginTop: "2px",
          }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}
