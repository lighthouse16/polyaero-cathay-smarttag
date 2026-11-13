"use client";

import React, { useEffect, useRef, useState } from "react";

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
  animationDelay?: number;
  onClick?: () => void;
}

function parseNumberMeta(val: string | number) {
  if (typeof val === "number") {
    return {
      num: val,
      decimals: Number.isInteger(val) ? 0 : 1,
      suffix: "",
      hasCommas: false,
    };
  }
  const str = String(val).trim();
  if (str === "—" || str === "-" || str === "") {
    return { num: null, decimals: 0, suffix: "", hasCommas: false };
  }
  const isPercent = str.endsWith("%");
  const clean = isPercent ? str.slice(0, -1).trim() : str;
  const hasCommas = clean.includes(",");
  const uncomma = clean.replace(/,/g, "");
  const num = parseFloat(uncomma);
  if (isNaN(num)) {
    return { num: null, decimals: 0, suffix: "", hasCommas: false };
  }
  const parts = uncomma.split(".");
  const decimals = parts.length > 1 ? parts[1].length : 0;
  return { num, decimals, suffix: isPercent ? "%" : "", hasCommas };
}

function formatValue(current: number, meta: ReturnType<typeof parseNumberMeta>) {
  if (meta.num === null) return "";
  let formatted = "";
  if (meta.hasCommas) {
    formatted = Math.round(current).toLocaleString("en-US");
  } else if (meta.decimals > 0) {
    formatted = current.toFixed(meta.decimals);
  } else {
    formatted = Math.round(current).toString();
  }
  return formatted + meta.suffix;
}

export function OperationalMetricCard({
  title,
  value,
  sublabel,
  icon,
  accentColor,
  tintBackground = "#FFFFFF",
  borderColor = "#E8E5DE",
  iconBg = "#F0EFEB",
  sparklinePoints,
  animationDelay = 0,
  onClick,
}: OperationalMetricCardProps) {
  const [displayValue, setDisplayValue] = useState<string | number>(value);
  const [isLineDrawn, setIsLineDrawn] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(value);
      setIsLineDrawn(true);
      return;
    }

    const targetMeta = parseNumberMeta(value);
    if (targetMeta.num === null) {
      setDisplayValue(value);
      setIsLineDrawn(true);
      return;
    }

    const prevMeta = parseNumberMeta(prevValueRef.current);
    const startNum =
      prevMeta.num !== null && prevMeta.num !== targetMeta.num
        ? prevMeta.num
        : 0;
    prevValueRef.current = value;

    const duration = 1200;
    let frameId: number;
    let startTime: number | null = null;

    const startTimeout = setTimeout(() => {
      setIsLineDrawn(true);
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = startNum + (targetMeta.num! - startNum) * ease;

        if (progress < 1) {
          setDisplayValue(formatValue(current, targetMeta));
          frameId = requestAnimationFrame(step);
        } else {
          setDisplayValue(value);
        }
      };
      frameId = requestAnimationFrame(step);
    }, animationDelay);

    return () => {
      clearTimeout(startTimeout);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [value, animationDelay]);

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
              fontSize: "clamp(22px, 2.1vw, 30px)",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#000000",
              letterSpacing: "-0.02em",
            }}
          >
            {displayValue}
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
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
              color: "#000000",
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
            <path
              d={linePath}
              pathLength={1}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: isLineDrawn ? 0 : 1,
                transition:
                  "stroke-dashoffset 1.3s cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: `${animationDelay}ms`,
              }}
            />
          </svg>
        </div>
      )}
    </div>
  );
}
