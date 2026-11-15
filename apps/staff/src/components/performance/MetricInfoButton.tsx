"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { InfoIcon } from "../icons/DashboardIcons";
import styles from "./PerformanceView.module.css";

interface MetricInfoButtonProps {
  label: string;
  text: string;
}

export function MetricInfoButton({ label, text }: MetricInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span className={styles.infoWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.infoBtn}
        aria-label={`Methodology: ${label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <InfoIcon size={14} color="currentColor" />
      </button>
      {open && (
        <span id={panelId} role="tooltip" className={styles.infoPopover}>
          {text}
        </span>
      )}
    </span>
  );
}
