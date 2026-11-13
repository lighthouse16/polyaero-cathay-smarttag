"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { SearchIcon } from "../icons/DashboardIcons";
import { formatStatusLabel, isExceptionBag } from "../../lib/utils";

interface GlobalSearchModalProps {
  open: boolean;
  bags: LiveBag[];
  onClose: () => void;
  onSelectBag: (tagNumber: string) => void;
}

export function GlobalSearchModal({
  open,
  bags,
  onClose,
  onSelectBag,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const inputId = useId();
  const listboxId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bags;
    return bags.filter((b) =>
      `${b.tag_number} ${b.booking_reference} ${b.passenger_name} ${b.flight_number} ${b.arrival_airport}`
        .toLowerCase()
        .includes(q),
    );
  }, [bags, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, matches.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      setQuery("");
      if (dialog.open) {
        dialog.close();
        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
      }
    }
  }, [open]);

  const handleSelect = (bag: LiveBag) => {
    onSelectBag(bag.tag_number);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      const target = matches[selectedIndex];
      if (target) {
        e.preventDefault();
        handleSelect(target);
      }
    }
  };

  const activeBag = matches[selectedIndex];
  const activeOptionId = activeBag
    ? `${listboxId}-opt-${activeBag.tag_number}`
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Global Baggage Search"
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "88px",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%",
              maxWidth: "560px",
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E2E1DB",
              boxShadow: "0 22px 48px rgba(0, 0, 0, 0.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                borderBottom: "1px solid #ECEAE3",
              }}
            >
              <SearchIcon size={17} color="#006564" />
              <label htmlFor={inputId} className="sr-only">
                Search baggage by tag, PNR, flight number, or passenger name
              </label>
              <input
                ref={inputRef}
                id={inputId}
                type="search"
                role="combobox"
                aria-expanded={true}
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bag tag, PNR, flight number, or passenger name..."
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: "14px",
                  color: "#141918",
                  backgroundColor: "transparent",
                  minHeight: "32px",
                }}
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search dialog"
                className="focus-ring"
                style={{
                  fontSize: "11px",
                  color: "#4C5755",
                  backgroundColor: "#FAF9F5",
                  padding: "4px 8px",
                  borderRadius: "5px",
                  border: "1px solid #E5E2DA",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ESC
              </button>
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-label="Matching baggage records"
              style={{ maxHeight: "340px", overflowY: "auto", padding: "8px" }}
            >
              {matches.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "#6B7280",
                  }}
                >
                  No matching baggage tags found for &ldquo;{query}&rdquo;.
                </div>
              ) : (
                matches.map((bag, idx) => {
                  const exc = isExceptionBag(bag);
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={bag.tag_number}
                      id={`${listboxId}-opt-${bag.tag_number}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelect(bag)}
                      className="focus-ring"
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "9px",
                        border: isActive
                          ? "1px solid #C8D1CB"
                          : "1px solid transparent",
                        backgroundColor: isActive ? "#EFEEE9" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 700,
                              fontSize: "13px",
                              color: "#141918",
                            }}
                          >
                            {bag.tag_number}
                          </span>
                          <span
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            {bag.passenger_name}
                          </span>
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: "11.5px",
                            color: "#6B7280",
                            marginTop: "2px",
                          }}
                        >
                          {bag.flight_number} ({bag.departure_airport} →{" "}
                          {bag.arrival_airport}) · PNR {bag.booking_reference}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: exc ? "#F3F1EC" : "#FAF9F5",
                            border: `1px solid ${exc ? "#D8D3CB" : "#E5E2DA"}`,
                            color: exc ? "#762830" : "#004B4A",
                          }}
                        >
                          {formatStatusLabel(bag.status)}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{
                            fontWeight: 700,
                            fontSize: "12px",
                            color: bag.risk_score >= 65 ? "#762830" : "#374151",
                          }}
                        >
                          Risk {bag.risk_score}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
