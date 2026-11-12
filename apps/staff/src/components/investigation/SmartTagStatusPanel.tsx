"use client";

import React, { useEffect, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { ExternalLinkIcon } from "../icons/DashboardIcons";
import { formatTimeHHMM, getLatestEvent } from "../../lib/utils";

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

  const latest = getLatestEvent(bag);
  const recordUpdatedTime = formatTimeHHMM(
    tagPayload?.updated_at || bag.updated_at,
  );
  const latestScanTime = latest
    ? `${formatTimeHHMM(latest.timestamp)} · ${latest.location_code}`
    : "No scan recorded";

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

  const statusBadgeText =
    payloadStatus === "loading"
      ? "Fetching payload..."
      : payloadStatus === "available"
        ? "Payload available · hardware refresh unverified"
        : "Payload unavailable · display unverified";

  return (
    <div
      style={{
        paddingTop: "16px",
        marginTop: "16px",
        borderTop: "1px solid #EAE7DF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "14.5px",
            fontWeight: 700,
            color: "#141918",
          }}
        >
          SmartTag (E-paper Preview)
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
            color: "#6B7280",
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
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Waveshare 4.2" E-paper Hardware Bezel Preview (No Fake QR) */}
        <div
          aria-label={`SmartTag E-paper display preview showing ${previewFlight} to ${previewDest}`}
          style={{
            width: "148px",
            flexShrink: 0,
            backgroundColor: "#1E2120",
            borderRadius: "10px",
            padding: "8px 9px",
            boxShadow:
              "0 6px 14px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              backgroundColor: "#F3F2ED",
              borderRadius: "5px",
              padding: "8px 9px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "104px",
              color: "#111827",
              border: "1px solid #D5D3CA",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                {previewFlight}
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  margin: "2px 0 3px",
                }}
              >
                {previewDest}
              </div>
              <div
                style={{ fontSize: "10px", color: "#4B5563", fontWeight: 600 }}
              >
                {previewOrigin} → {previewDest}
              </div>
            </div>

            <div
              style={{
                marginTop: "6px",
                borderTop: "1px dashed #CBC8BC",
                paddingTop: "4px",
              }}
            >
              <div
                className="tabular-nums"
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#1F2937",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {previewBagNum}
              </div>
              {previewBanner && (
                <div
                  style={{
                    fontSize: "8.5px",
                    fontWeight: 700,
                    color: "#004B4A",
                    marginTop: "2px",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {previewBanner}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry Column */}
        <div
          style={{
            flex: 1,
            minWidth: "190px",
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
                padding: "3px 9px",
                borderRadius: "999px",
                backgroundColor:
                  payloadStatus === "available" ? "#EBF4F1" : "#FAF9F5",
                border: `1px solid ${payloadStatus === "available" ? "#B8DAD6" : "#E5E2DA"}`,
                color: payloadStatus === "available" ? "#004B4A" : "#4C5755",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {statusBadgeText}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "98px 1fr",
              rowGap: "5px",
              columnGap: "8px",
              fontSize: "12px",
              marginTop: "4px",
            }}
          >
            <span style={{ color: "#6B7280" }}>Tag UID</span>
            <span
              className="tabular-nums"
              style={{
                fontWeight: 600,
                color: "#141918",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "11.5px",
              }}
            >
              {bag.tag_code}
            </span>

            <span style={{ color: "#6B7280" }}>Record updated</span>
            <span
              className="tabular-nums"
              style={{ fontWeight: 600, color: "#141918" }}
            >
              {recordUpdatedTime}
            </span>

            <span style={{ color: "#6B7280" }}>Latest scan</span>
            <span
              className="tabular-nums"
              style={{ fontWeight: 600, color: "#141918" }}
            >
              {latestScanTime}
            </span>

            <span style={{ color: "#6B7280" }}>Telemetry</span>
            <span
              style={{ fontWeight: 500, color: "#76827F", fontSize: "11.5px" }}
            >
              Hardware confirmation unavailable
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
            color: "#374151",
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
