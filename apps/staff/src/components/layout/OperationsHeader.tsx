"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  BellIcon,
  ChevronDownIcon,
  SearchIcon,
} from "../icons/DashboardIcons";
import { formatHongKongClock } from "../../lib/utils";

interface OperationsHeaderProps {
  station: string;
  onStationChange?: (station: string) => void;
  exceptionCount: number;
  isLiveConnected: boolean;
  onOpenSearch: () => void;
  onResetDemo: () => void;
  onOpenExceptions: () => void;
  isSyncing: boolean;
}

export function OperationsHeader({
  station,
  exceptionCount,
  isLiveConnected,
  onOpenSearch,
  onResetDemo,
  onOpenExceptions,
  isSyncing,
}: OperationsHeaderProps) {
  const [clock, setClock] = useState<{
    dateLine: string;
    tzLine: string;
  } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setClock(formatHongKongClock(new Date()));
    const timer = setInterval(() => {
      setClock(formatHongKongClock(new Date()));
    }, 15_000);
    return () => clearInterval(timer);
  }, []);

  const handleResetClick = () => {
    if (
      window.confirm(
        "Reset demo baggage dataset to baseline? Any recent changes will be cleared.",
      )
    ) {
      onResetDemo();
      setUserMenuOpen(false);
    }
  };

  return (
    <header
      className="ops-header"
      style={{
        height: "82px",
        background: "#073b39",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        gap: "12px",
      }}
    >
      {/* Left: Brand & Operations Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <Image
            src="/cathay/cathay-brushwing-white.png"
            alt="Cathay Pacific"
            width={28}
            height={28}
            priority
            style={{ objectFit: "contain" }}
          />
          <span
            className="header-brand-text"
            style={{
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.07em",
              whiteSpace: "nowrap",
            }}
          >
            CATHAY PACIFIC
          </span>
        </div>

        <div
          className="header-brand-divider"
          style={{
            width: "1px",
            height: "28px",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />

        <div style={{ minWidth: 0 }}>
          <div
            className="header-title"
            style={{
              fontSize: "13.5px",
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
            }}
          >
            Ground Operations
          </div>
          <div
            className="header-subtitle"
            style={{
              fontSize: "11.5px",
              color: "#FFFFFF",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Baggage Transfer &amp; Recovery
          </div>
        </div>
      </div>

      {/* Center: Desktop Global Search Trigger */}
      <div
        style={{ flex: "1 1 380px", maxWidth: "430px", margin: "0 16px" }}
        className="header-search-wrap"
      >
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open global baggage search"
          className="focus-ring"
          style={{
            width: "100%",
            height: "40px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "10px",
            padding: "0 10px 0 13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#FFFFFF",
            cursor: "pointer",
            transition: "background-color 0.15s ease, border-color 0.15s ease",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              minWidth: 0,
            }}
          >
            <SearchIcon size={15} color="#FFFFFF" />
            <span
              style={{
                fontSize: "12.5px",
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Search by bag tag, PNR, flight, or passenger
            </span>
          </span>
          <kbd
            style={{
              fontSize: "11px",
              fontFamily: "inherit",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: "rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              borderRadius: "6px",
              padding: "2px 7px",
              flexShrink: 0,
            }}
          >
            ⌘ K
          </kbd>
        </button>
      </div>

      {/* Right: Mobile Search, Static Station Context, Clock, Bell, Operator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search baggage"
          className="mobile-search-btn focus-ring touch-target"
          style={{
            display: "none",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "8px",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          <SearchIcon size={17} color="#FFFFFF" />
        </button>

        {/* Static Station Display Context */}
        <div
          className="header-station-badge"
          aria-label={`Operating station ${station || "HKG · T1"}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 10px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            color: "#FFFFFF",
            fontSize: "12.5px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {station || "HKG · T1"}
        </div>

        <div
          style={{
            width: "1px",
            height: "24px",
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
          className="hide-sm"
        />

        {/* Clock — Deterministic Hydration (Initial Null -> Mounted Date) */}
        <div
          style={{ textAlign: "right", lineHeight: 1.25 }}
          className="tabular-nums hide-sm"
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#FFFFFF",
              minWidth: "112px",
            }}
          >
            {clock ? clock.dateLine : "—"}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "6px",
            }}
          >
            <span
              className={isLiveConnected ? "pulse-dot" : undefined}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isLiveConnected ? "#34D399" : "#F87171",
                display: "inline-block",
              }}
            />
            <span>
              {isLiveConnected ? (clock ? clock.tzLine : "UTC+8") : "Offline"}
            </span>
          </div>
        </div>

        {/* Bell */}
        <button
          type="button"
          onClick={onOpenExceptions}
          aria-label={`View ${exceptionCount} exception alerts`}
          className="focus-ring touch-target"
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            color: "#FFFFFF",
            padding: "6px",
            borderRadius: "8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BellIcon size={18} />
          {exceptionCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "5px",
                right: "5px",
                minWidth: "16px",
                height: "16px",
                borderRadius: "999px",
                backgroundColor: "#87323A",
                color: "#FFFFFF",
                fontSize: "10px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: "1.5px solid #004e4c",
              }}
            >
              {exceptionCount}
            </span>
          )}
        </button>

        {/* Operator Profile + Demo Reset */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="Operator profile and demo reset menu"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen((v) => !v)}
            className="focus-ring touch-target"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            <span
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12.5px",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              JD
            </span>
            <ChevronDownIcon size={13} color="#FFFFFF" />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                backgroundColor: "#FFFFFF",
                color: "#000000",
                borderRadius: "10px",
                border: "1px solid #E2E1DB",
                boxShadow: "0 12px 28px rgba(0, 0, 0, 0.16)",
                minWidth: "220px",
                padding: "8px",
                zIndex: 60,
              }}
            >
              <div
                style={{
                  padding: "6px 8px 8px",
                  borderBottom: "1px solid #F0EFEB",
                }}
              >
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#000000",
                  }}
                >
                  Ground Duty Lead · JD
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#000000",
                    marginTop: "2px",
                  }}
                >
                  Operator ID: STF-8821 · {station || "HKG · T1"}
                </div>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleResetClick}
                className="focus-ring touch-target"
                style={{
                  marginTop: "6px",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: "7px",
                  backgroundColor: "#FAF9F5",
                  color: "#000000",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  justifyContent: "flex-start",
                }}
              >
                {isSyncing ? "Resetting demo..." : "Reset Demo Baggage State"}
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 960px) {
          .header-search-wrap {
            display: none !important;
          }
          .hide-sm {
            display: none !important;
          }
          .mobile-search-btn {
            display: inline-flex !important;
          }
        }
        @media (max-width: 720px) {
          .ops-header {
            padding: 0 12px !important;
            gap: 8px !important;
            height: 64px !important;
          }
          .header-brand-text,
          .header-brand-divider,
          .header-title,
          .header-ops-title,
          .header-subtitle {
            display: none !important;
          }
          .header-station-badge {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
