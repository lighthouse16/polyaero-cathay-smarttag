"use client";

import React from "react";

interface OperationalMetricCardProps {
  title: string;
  value: string | number;
  sublabel: string;
  icon: React.ReactNode;
  accentColor: string;
  tintBackground?: string;
  borderColor?: string;
  iconBg?: string;
  sparklinePoints?: number[];
  onClick?: () => void;
}

export function OperationalMetricCard({
  title,
  value,
  sublabel,
  icon,
  accentColor,
  tintBackground = "#FFFFFF",
  borderColor = "#E8E5DE",
  iconBg = "#F1F5F9",
  sparklinePoints,
  onClick,
}: OperationalMetricCardProps) {
  // Draw only genuine historical samples; no sparkline for snapshot-only data.
  const pts =
    sparklinePoints && sparklinePoints.length >= 2 ? sparklinePoints : [1, 1];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const width = 180;
  const height = 26;

  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y =
      max === min
        ? height * 0.65
        : height - 4 - ((v - min) / span) * (height - 8);
    return { x, y };
  });

  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `spark-${accentColor.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="card-surface focus-ring"
      style={{
        backgroundColor: tintBackground,
        borderColor,
        padding: "13px 14px 8px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        minWidth: 0,
        minHeight: "126px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "11px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "9px",
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="tabular-nums"
            style={{
              fontSize: "31px",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#141918",
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#4C5755",
              marginTop: "3px",
              lineHeight: 1.4,
            }}
          >
            {title}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: "10.5px",
              fontWeight: 600,
              color: accentColor,
              marginTop: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sublabel}
          </div>
        </div>
      </div>

      {/* Micro Sparkline */}
      {sparklinePoints && sparklinePoints.length >= 2 && (
        <div style={{ marginTop: "6px", height: "24px", width: "100%" }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              overflow: "visible",
            }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
