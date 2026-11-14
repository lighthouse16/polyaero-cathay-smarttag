"use client";

import React from "react";
import type { LiveBag } from "../../lib/types";
import styles from "./BaggageInvestigationPanel.module.css";

interface SmartTagStatusPanelProps {
  bag: LiveBag;
}

export function SmartTagStatusPanel({ bag }: SmartTagStatusPanelProps) {
  return (
    <section className={styles.smartTag} aria-label="SmartTag database record">
      <h4>SmartTag (E-paper)</h4>
      <p className={styles.supporting}>Database record preview · Source-reported fields, not physical display confirmation.</p>
      <dl className={styles.record}>
        <div><dt>Bag tag</dt><dd>{bag.tag_number || "Unavailable"}</dd></div>
        <div><dt>Reported tag code</dt><dd>{bag.tag_code || "Unavailable"}</dd></div>
        <div><dt>Reported interface</dt><dd>{bag.tag_interface || "Unavailable"}</dd></div>
        <div><dt>Recorded flight</dt><dd>{bag.flight_number || "Unavailable"}</dd></div>
        <div><dt>Recorded route</dt><dd>{bag.departure_airport && bag.arrival_airport ? `${bag.departure_airport} → ${bag.arrival_airport}` : "Unavailable"}</dd></div>
        <div><dt>Recorded E-Ink banner</dt><dd>{bag.eink_banner || "Unavailable"}</dd></div>
      </dl>
      <p className={styles.unavailable}>Hardware confirmation unavailable</p>
    </section>
  );
}
