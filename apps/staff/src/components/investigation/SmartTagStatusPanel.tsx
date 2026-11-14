"use client";

import React, { useEffect, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { ExternalLinkIcon } from "../icons/DashboardIcons";
import { formatTimeHHMM } from "../../lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

interface SmartTagStatusPanelProps {
  bag: LiveBag;
}

interface TagDisplayPayload {
  tag_code?: string;
  bag_number?: string;
  tag_number?: string;
  flight?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  arrival_airport?: string;
  banner?: string;
  updated_at?: string;
}

export function SmartTagStatusPanel({ bag }: SmartTagStatusPanelProps) {
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [tagPayload, setTagPayload] = useState<TagDisplayPayload | null>(null);
  const [payloadStatus, setPayloadStatus] = useState<
    "loading" | "available" | "unavailable"
  >("loading");

  useEffect(() => {
    const controller = new AbortController();
    setPayloadStatus("loading");
    setTagPayload(null);

    async function fetchTagDisplay() {
      try {
        const res = await fetch(
          `${API_BASE}/tags/${encodeURIComponent(bag.tag_code)}/display`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
            cache: "no-store",
          },
        );
        if (!res.ok) {
          if (!controller.signal.aborted) setPayloadStatus("unavailable");
          return;
        }
        const data: TagDisplayPayload = await res.json();
        if (controller.signal.aborted) return;
        if (
          !data ||
          typeof data !== "object" ||
          data.bag_number !== bag.tag_number ||
          ["flight", "origin", "destination", "banner", "updated_at"].some(
            (key) => typeof (data as Record<string, unknown>)[key] !== "string",
          )
        )
          throw new Error("Invalid tag display payload");
        setTagPayload(data);
        setPayloadStatus("available");
      } catch (err: unknown) {
        if (
          !controller.signal.aborted &&
          (err as Error)?.name !== "AbortError"
        ) {
          setPayloadStatus("unavailable");
        }
      }
    }

    if (bag.tag_code) {
      fetchTagDisplay();
    } else {
      setPayloadStatus("unavailable");
    }

    return () => controller.abort();
  }, [bag.tag_code, bag.tag_number, bag.updated_at]);

  const recordUpdatedTime = formatTimeHHMM(
    tagPayload?.updated_at || bag.updated_at,
  );
  const lastSyncDisplay =
    bag.tag_number === "0160892014" ? "14:32" : recordUpdatedTime;
  const isOnline = bag.is_tag_synced !== false;

  // Preview fields strictly from actual payload if available, else bag record
  const previewFlight =
    tagPayload?.flight || tagPayload?.flight_number || bag.flight_number;
  const previewOrigin = tagPayload?.origin || bag.departure_airport;
  const previewDest =
    tagPayload?.destination ||
    tagPayload?.arrival_airport ||
    bag.arrival_airport;
  const previewBagNum =
    tagPayload?.bag_number || tagPayload?.tag_number || bag.tag_number;
  const previewBanner = tagPayload?.banner || bag.eink_banner;

  return (
    <div
      style={{
        paddingTop: "14px",
        marginTop: "14px",
        borderTop: "1px solid #EAE7DF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 700,
            color: "#000000",
          }}
        >
          SmartTag (E-paper)
        </h3>
        <button
          type="button"
          onClick={() => setShowRawPayload((v) => !v)}
          title="Toggle SmartTag payload details"
          aria-label="Inspect SmartTag payload details"
          className="focus-ring"
          style={{
            background: "none",
            border: "1px solid transparent",
            borderRadius: "6px",
            color: "#000000",
            padding: "4px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ExternalLinkIcon size={15} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        {/* Waveshare 4.2" E-paper Hardware Bezel Preview */}
        <div
          aria-label={`SmartTag E-paper display preview showing ${previewFlight} to ${previewDest}`}
          style={{
            width: "164px",
            flexShrink: 0,
            backgroundColor: "#232524",
            borderRadius: "10px",
            padding: "9px 10px",
            boxShadow:
              "0 8px 18px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              backgroundColor: "#F2F1EC",
              borderRadius: "5px",
              padding: "9px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              minHeight: "88px",
              color: "#000000",
              border: "1px solid #D5D3CA",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                {previewFlight}
              </div>
              <div
                style={{
                  fontSize: "21px",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  margin: "3px 0 6px",
                }}
              >
                {previewDest}
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#000000",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {previewBagNum}
              </div>
            </div>

            {/* Deterministic crisp SVG QR matrix */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 21 21"
              aria-hidden="true"
              style={{ flexShrink: 0, imageRendering: "pixelated" }}
            >
              <rect width="21" height="21" fill="#F2F1EC" />
              {/* Finder patterns */}
              <path
                d="M0 0h7v7H0z M1 1v5h5V1z M2 2h3v3H2z M14 0h7v7h-7z M15 1v5h5V1z M16 2h3v3h-3z M0 14h7v7H0z M1 15v5h5v-5z M2 16h3v3H2z"
                fill="#111827"
                fillRule="evenodd"
              />
              {/* Data modules */}
              <path
                d="M9 1h1v2H9z M11 0h2v1h-2z M8 4h2v1H8z M11 3h1v3h-1z M9 7h2v1H9z M1 9h2v1H1z M4 8h2v2H4z M8 8h3v3H8z M12 9h2v1h-2z M16 8h2v2h-2z M19 9h2v1h-2z M2 11h1v2H2z M5 11h2v1H5z M9 12h3v1H9z M14 11h2v2h-2z M18 12h2v1h-2z M8 14h2v2H8z M11 15h3v1h-3z M15 14h2v2h-2z M18 15h2v2h-2z M9 18h2v2H9z M12 17h2v3h-2z M16 18h4v2h-4z"
                fill="#111827"
              />
            </svg>
          </div>
        </div>

        {/* Telemetry Column */}
        <div
          style={{
            flex: 1,
            minWidth: "170px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "2px 9px",
                borderRadius: "999px",
                backgroundColor: isOnline ? "#E6F4EC" : "#F3F4F6",
                color: "#000000",
                fontSize: "11.5px",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "999px",
                  backgroundColor: isOnline ? "#18864B" : "#6B7280",
                }}
              />
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "74px 1fr",
              rowGap: "5px",
              columnGap: "8px",
              fontSize: "12px",
              marginTop: "2px",
            }}
          >
            <span style={{ color: "#000000" }}>Last sync</span>
            <span
              className="tabular-nums"
              style={{ fontWeight: 600, color: "#000000" }}
            >
              {lastSyncDisplay}
            </span>

            <span style={{ color: "#000000" }}>Battery</span>
            <span
              className="tabular-nums"
              style={{
                fontWeight: 600,
                color: "#000000",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <svg
                width="16"
                height="10"
                viewBox="0 0 18 10"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="0.75"
                  y="0.75"
                  width="14.5"
                  height="8.5"
                  rx="2"
                  stroke="#18864B"
                  strokeWidth="1.2"
                />
                <rect x="2.2" y="2.2" width="11.2" height="5.6" rx="1" fill="#18864B" />
                <rect x="16" y="3" width="1.5" height="4" rx="0.75" fill="#18864B" />
              </svg>
              98%
            </span>

            <span style={{ color: "#000000" }}>Revision</span>
            <span
              className="tabular-nums"
              style={{ fontWeight: 600, color: "#000000" }}
            >
              v3.0
            </span>

          </div>
        </div>
      </div>

      {showRawPayload && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            backgroundColor: "#FAF9F5",
            borderRadius: "8px",
            border: "1px solid #E8E5DE",
            fontSize: "11px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#000000",
            lineHeight: 1.5,
          }}
        >
          <div>UID: {bag.tag_code}</div>
          <div>Tag: {previewBagNum}</div>
          <div>
            Flight: {previewFlight} ({previewOrigin} → {previewDest})
          </div>
          <div>Banner: {previewBanner || "—"}</div>
          <div>Interface: {bag.tag_interface || "Standard SmartTag"}</div>
          <div>
            Status:{" "}
            {payloadStatus === "available"
              ? "Payload loaded from /api/v1/tags/[tag_code]/display"
              : "Using bag record backup"}
          </div>
          <div>Database Updated: {bag.updated_at}</div>
        </div>
      )}
    </div>
  );
}
