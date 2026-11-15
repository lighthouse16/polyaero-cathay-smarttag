"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { formatStatusLabel } from "../../lib/utils";
import { ChevronRightIcon, CloseIcon, SearchIcon } from "../icons/DashboardIcons";
import { HighlightMatch } from "../ui/HighlightMatch";

function statusTone(status: string): "action" | "risk" | "track" {
  const s = (status || "").toUpperCase();
  if (s === "MISROUTED" || s === "MISSING" || s === "RECOVERY_IN_PROGRESS") return "action";
  if (s === "AWAITING_SYNC") return "risk";
  return "track";
}

export function GlobalSearchModal({
  open,
  bags,
  onClose,
  onSelectBag,
}: {
  open: boolean;
  bags: LiveBag[];
  onClose: () => void;
  onSelectBag: (tag: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();

  const matches = bags.filter((b) =>
    `${b.tag_number} ${b.flight_number} ${b.departure_airport} ${b.arrival_airport}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.showModal();
      setActiveIndex(0);
    }
    if (!open && dialog.open) {
      dialog.close();
      previousFocus.current?.focus();
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || matches.length === 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, matches.length]);

  function choose(tag: string) {
    // Close search before opening transfer dialog; never stack native dialogs.
    dialogRef.current?.close();
    onClose();
    onSelectBag(tag);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(matches.length - 1);
    } else if (event.key === "Enter") {
      const selected = matches[activeIndex];
      if (selected) {
        event.preventDefault();
        choose(selected.tag_number);
      }
    }
  }

  const clampedIndex = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : -1;
  const activeOptionId = clampedIndex >= 0 ? `${listId}-opt-${clampedIndex}` : undefined;

  return (
    <dialog
      className="global-search-dialog"
      ref={dialogRef}
      aria-labelledby="global-search-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="search-heading">
        <div>
          <h2 id="global-search-title">Baggage search</h2>
          {bags.length > 0 && (
            <p className="search-subtitle">
              {query.trim()
                ? `${matches.length} of ${bags.length} matching records`
                : `${bags.length} authorized records in snapshot`}
            </p>
          )}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close baggage search">
          <CloseIcon color="#2D2D2D" size={18} />
        </button>
      </div>
      <div className="modal-search-box">
        <SearchIcon size={16} color="#66686A" />
        <input
          ref={inputRef}
          id={`${listId}-search-input`}
          name="global-baggage-search"
          autoFocus
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-label="Search full bag tag or flight"
          placeholder="Search full bag tag or flight"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="clear-field-btn"
            aria-label="Clear search query"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <CloseIcon size={13} color="#66686A" />
          </button>
        )}
      </div>
      <div id={listId} role="listbox" aria-label="Matching baggage records" className="search-results">
        {matches.map((b, idx) => {
          const active = idx === clampedIndex;
          return (
            <button
              key={b.tag_number}
              id={`${listId}-opt-${idx}`}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              role="option"
              aria-selected={active}
              data-active={active ? "true" : undefined}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => choose(b.tag_number)}
            >
              <span className="search-result-main">
                <strong>
                  <HighlightMatch text={b.tag_number} query={query} />
                </strong>
                <span>
                  <HighlightMatch text={b.flight_number} query={query} /> ·{" "}
                  <HighlightMatch text={`${b.departure_airport} → ${b.arrival_airport}`} query={query} />
                </span>
              </span>
              <span className="search-result-meta">
                <span className="status-pill" data-tone={statusTone(b.status)}>
                  {formatStatusLabel(b.status)}
                </span>
                <ChevronRightIcon size={14} className="row-chevron" />
              </span>
            </button>
          );
        })}
        {!matches.length && (
          <p className="table-empty" role="status">
            No authorized matching baggage records.
          </p>
        )}
      </div>
      <div className="search-footer-hint" aria-hidden="true">
        <span>↑↓ Navigate</span>
        <span>↵ Open workbench</span>
        <span>Esc Close</span>
      </div>
    </dialog>
  );
}
