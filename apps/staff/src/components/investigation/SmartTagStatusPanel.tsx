"use client";

import React, { useState } from "react";
import type { LiveBag } from "../../lib/types";
import { CheckIcon, CopyIcon } from "../icons/DashboardIcons";
import { copyToClipboard } from "../ui/clipboard";
import styles from "./BaggageInvestigationPanel.module.css";

interface SmartTagStatusPanelProps {
  bag: LiveBag;
}

export function SmartTagStatusPanel({ bag }: SmartTagStatusPanelProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  async function copyTagCode() {
    if (!bag.tag_code) return;
    if (await copyToClipboard(bag.tag_code)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  }

  const routeLabel =
    bag.departure_airport && bag.arrival_airport
      ? `${bag.departure_airport} → ${bag.arrival_airport}`
      : "Unavailable";

  return (
    <section className={styles.smartTag} aria-label="SmartTag database record">
      <h4>SmartTag (E-paper)</h4>
      <p className={styles.supporting}>
        Database record preview · Source-reported fields, not physical display confirmation.
      </p>

      <div className={styles.epaperMock} aria-hidden="true">
        <div className={styles.epaperHeader}>
          <span className={styles.epaperBanner}>{bag.eink_banner || "STANDARD"}</span>
          <span className={styles.epaperInterface}>{bag.tag_interface || "UID RECORD"}</span>
        </div>
        <div className={styles.epaperRoute}>{routeLabel}</div>
        <div className={styles.epaperMeta}>
          <span>{bag.flight_number || "—"}</span>
          <span>{bag.tag_number || "—"}</span>
        </div>
      </div>

      <dl className={styles.record}>
        <div>
          <dt>Bag tag</dt>
          <dd>{bag.tag_number || "Unavailable"}</dd>
        </div>
        <div>
          <dt>Reported tag code</dt>
          <dd className={styles.copyDd}>
            <span>{bag.tag_code || "Unavailable"}</span>
            {bag.tag_code && (
              <button
                type="button"
                className={styles.inlineCopyBtn}
                onClick={copyTagCode}
                aria-label="Copy reported tag code"
              >
                {copiedCode ? <CheckIcon size={12} color="#163230" /> : <CopyIcon size={12} />}
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt>Reported interface</dt>
          <dd>{bag.tag_interface || "Unavailable"}</dd>
        </div>
        <div>
          <dt>Recorded flight</dt>
          <dd>{bag.flight_number || "Unavailable"}</dd>
        </div>
        <div>
          <dt>Recorded route</dt>
          <dd>{routeLabel}</dd>
        </div>
        <div>
          <dt>Recorded E-Ink banner</dt>
          <dd>{bag.eink_banner || "Unavailable"}</dd>
        </div>
      </dl>
      <p className={styles.unavailable}>Hardware confirmation unavailable</p>
    </section>
  );
}
