"use client";

import React, { useEffect, useRef, useState } from "react";
import type { SidebarView } from "../../lib/types";
import {
  AlertTriangleIcon,
  BarChartIcon,
  LayersIcon,
  LuggageIcon,
  SidebarToggleIcon,
} from "../icons/DashboardIcons";

interface OperationsSidebarProps {
  activeView: SidebarView;
  onSelectView: (view: SidebarView) => void;
  exceptionCount: number;
  isOpen?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: Array<{
  id: SidebarView;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}> = [
  {
    id: "transfer-control",
    label: "Transfer Control",
    renderIcon: () => <LayersIcon size={16} color="#FFFFFF" />,
  },
  {
    id: "exceptions",
    label: "Exceptions",
    renderIcon: () => <AlertTriangleIcon size={16} color="#FFFFFF" />,
  },
  {
    id: "baggage-trace",
    label: "Baggage Trace",
    renderIcon: () => <LuggageIcon size={16} color="#FFFFFF" />,
  },
  {
    id: "performance",
    label: "Performance",
    renderIcon: () => <BarChartIcon size={16} color="#FFFFFF" />,
  },
];

export function OperationsSidebar({
  activeView,
  onSelectView,
  exceptionCount,
  isOpen = true,
  onToggle,
  mobileOpen = false,
  onCloseMobile,
}: OperationsSidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const closeRef = useRef(onCloseMobile);
  closeRef.current = onCloseMobile;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const buttons = Array.from(
      sidebar?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    buttons[0]?.focus();
    const main = document.querySelector("main");
    if (main) main.inert = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current?.();
      }
      if (e.key === "Tab" && buttons.length) {
        if (e.shiftKey && document.activeElement === buttons[0]) {
          e.preventDefault();
          buttons.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
          e.preventDefault();
          buttons[0].focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (main) main.inert = false;
      previous?.focus();
    };
  }, [mobileOpen, isMobile]);

  return (
    <>
      {mobileOpen && isMobile && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          className="sidebar-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 48,
          }}
        />
      )}

      <aside
        ref={sidebarRef}
        inert={(isMobile && !mobileOpen) || (!isMobile && !isOpen)}
        role={isMobile && mobileOpen ? "dialog" : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        aria-label="Ground Operations Navigation"
        className={`ops-sidebar ${mobileOpen ? "ops-sidebar-open" : ""} ${!isOpen ? "ops-sidebar-collapsed" : ""}`}
        style={{
          width: isMobile ? undefined : isOpen ? "208px" : "0px",
          flexShrink: 0,
          background: "#052f2d",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: isMobile ? "18px 12px" : isOpen ? "18px 12px" : "0px",
          position: "relative",
          overflow: "hidden",
          opacity: isMobile ? undefined : isOpen ? 1 : 0,
          visibility: isMobile ? undefined : isOpen ? "visible" : "hidden",
          pointerEvents: isMobile ? undefined : isOpen ? "auto" : "none",
          transition:
            "width 0.22s cubic-bezier(0.2, 0, 0, 1), padding 0.22s ease, opacity 0.18s ease",
          minHeight: "calc(100vh - var(--ops-header-height, 82px))",
        }}
      >
        {/* Subtle Cathay Wing Watermark Arc at Bottom-Left */}
        <svg
          viewBox="0 0 220 260"
          fill="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-30px",
            bottom: "-10px",
            width: "220px",
            height: "260px",
            pointerEvents: "none",
            opacity: 0.14,
          }}
        >
          <path
            d="M-10 250C40 165 100 110 210 70C140 135 90 190 50 260H-10V250Z"
            fill="#2B8C87"
          />
          <path
            d="M-20 190C25 130 75 90 155 60C95 110 55 150 20 215L-20 190Z"
            fill="#607F76"
          />
        </svg>

        <nav
          aria-label="Navigation links"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            position: "relative",
            zIndex: 2,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile?.();
                }}
                aria-current={active ? "page" : undefined}
                className="focus-ring touch-target"
                style={{
                  width: "100%",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: active
                    ? "1px solid rgba(255, 255, 255, 0.16)"
                    : "1px solid transparent",
                  backgroundColor: active
                    ? "rgba(255, 255, 255, 0.14)"
                    : "transparent",
                  color: "#FFFFFF",
                  fontSize: "13.5px",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.15s ease",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {item.renderIcon(active)}
                  <span>{item.label}</span>
                </span>
                {item.id === "exceptions" && exceptionCount > 0 && (
                  <span
                    style={{
                      minWidth: "20px",
                      height: "20px",
                      padding: "0 6px",
                      borderRadius: "999px",
                      backgroundColor: "#87323A",
                      color: "#FFFFFF",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {exceptionCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Collapse Button (Replaced Station Context box) */}
        {onToggle && (
          <div style={{ position: "relative", zIndex: 2 }}>
            <button
              type="button"
              onClick={() => {
                onToggle();
                onCloseMobile?.();
              }}
              aria-label="Collapse sidebar"
              className="focus-ring touch-target"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "9px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                color: "#FFFFFF",
                fontSize: "12.5px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
            >
              <SidebarToggleIcon size={16} color="#FFFFFF" collapsed={false} />
              <span>Collapse sidebar</span>
            </button>
          </div>
        )}

        <style jsx>{`
          @media (max-width: 960px) {
            .ops-sidebar {
              position: fixed !important;
              left: 0;
              top: var(--ops-header-height, 82px) !important;
              bottom: 0;
              z-index: 50;
              width: 208px !important;
              padding: 18px 12px !important;
              opacity: 1 !important;
              visibility: visible !important;
              transform: translateX(-100%);
              transition: transform 0.2s ease;
            }
            .ops-sidebar.ops-sidebar-open {
              transform: translateX(0);
            }
          }
        `}</style>
      </aside>

      {!isOpen && !isMobile && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar (Ctrl+B)"
          className="focus-ring"
          style={{
            position: "fixed",
            left: "12px",
            bottom: "16px",
            zIndex: 45,
            background: "#052f2d",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            color: "#FFFFFF",
            padding: "8px 12px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12px",
            fontWeight: 600,
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#08413f";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#052f2d";
          }}
        >
          <SidebarToggleIcon size={14} color="#FFFFFF" collapsed={true} />
          <span>Expand sidebar</span>
        </button>
      )}
    </>
  );
}
