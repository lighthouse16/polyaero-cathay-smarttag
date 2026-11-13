"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { formatStatusLabel } from "../../lib/utils";

export interface PendingStaffAction {
  targetStatus: string;
  title: string;
  description: string;
  ctaLabel: string;
  tone: "jade" | "danger" | "neutral";
}

interface ActionConfirmationModalProps {
  bag: LiveBag;
  pendingAction: PendingStaffAction | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (notes: string) => void | Promise<unknown>;
}

export function ActionConfirmationModal({
  bag,
  pendingAction,
  isSubmitting,
  onCancel,
  onConfirm,
}: ActionConfirmationModalProps) {
  const [notes, setNotes] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const notesInputId = useId();
  const titleId = useId();

  useEffect(() => {
    setNotes("");
  }, [pendingAction]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (pendingAction) {
      if (!dialog.open) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [pendingAction]);

  const normalized = pendingAction ? pendingAction : null;
  const confirmBg = normalized?.tone === "danger" ? "#87323A" : "#004B4A";

  const handleDialogCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (!isSubmitting) {
      onCancel();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={handleDialogCancel}
    >
      {normalized && (
        <div
          onClick={handleBackdropClick}
          style={{
            width: "100vw",
            minHeight: "100dvh",
            overflowY: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E2E1DB",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.18)",
              padding: "22px",
            }}
          >
            <h3
              id={titleId}
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "#141918",
              }}
            >
              {normalized.title}
            </h3>
            <p
              style={{
                margin: "8px 0 14px",
                fontSize: "13px",
                color: "#4C5755",
                lineHeight: 1.5,
              }}
            >
              {normalized.description}
            </p>

            <div
              style={{
                backgroundColor: "#FAF9F5",
                border: "1px solid #E8E5DE",
                borderRadius: "9px",
                padding: "10px 12px",
                fontSize: "12px",
                color: "#374151",
                marginBottom: "14px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <div>
                <span style={{ color: "#6B7280" }}>Bag Tag: </span>
                <strong className="tabular-nums">{bag.tag_number}</strong>
              </div>
              <div>
                <span style={{ color: "#6B7280" }}>Flight: </span>
                <strong>
                  {bag.flight_number} ({bag.departure_airport}→
                  {bag.arrival_airport})
                </strong>
              </div>
              <div>
                <span style={{ color: "#6B7280" }}>Current Status: </span>
                <strong>{formatStatusLabel(bag.status)}</strong>
              </div>
              <div>
                <span style={{ color: "#6B7280" }}>Proposed Status: </span>
                <strong style={{ color: confirmBg }}>
                  {formatStatusLabel(normalized.targetStatus)}
                </strong>
              </div>
              <div>
                <span style={{ color: "#6B7280" }}>Passenger: </span>
                <strong>{bag.passenger_name}</strong>
              </div>
              <div>
                <span style={{ color: "#6B7280" }}>Reported Scanner: </span>
                <strong>MANUAL_OVERRIDE</strong>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor={notesInputId}
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "5px",
                }}
              >
                Operator log note (optional)
              </label>
              <input
                id={notesInputId}
                type="text"
                value={notes}
                disabled={isSubmitting}
                maxLength={1000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Operator entry at HKG Transfer Desk"
                className="focus-ring"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 10px",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  fontSize: "13px",
                  color: "#141918",
                  backgroundColor: isSubmitting ? "#F2F1ED" : "#FFFFFF",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="focus-ring touch-target"
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #D6D1C6",
                  backgroundColor: "#FFFFFF",
                  color: "#374151",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm(notes)}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="focus-ring touch-target"
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: confirmBg,
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isSubmitting ? "wait" : "pointer",
                }}
              >
                {isSubmitting ? "Recording..." : normalized.ctaLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
