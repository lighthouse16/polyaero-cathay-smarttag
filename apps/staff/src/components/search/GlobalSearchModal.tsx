"use client";
import React, { useEffect, useRef, useState } from "react";
import type { LiveBag } from "../../lib/types";
import { CloseIcon } from "../icons/DashboardIcons";
import { formatStatusLabel } from "../../lib/utils";
export function GlobalSearchModal({ open, bags, onClose, onSelectBag }: { open: boolean; bags: LiveBag[]; onClose: () => void; onSelectBag: (tag: string) => void }) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const matches = bags.filter(b => `${b.tag_number} ${b.flight_number} ${b.departure_airport} ${b.arrival_airport}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) { previousFocus.current = document.activeElement as HTMLElement; dialog.showModal(); }
    if (!open && dialog.open) { dialog.close(); previousFocus.current?.focus(); setQuery(""); }
  }, [open]);
  function choose(tag: string) {
    // Close search before opening transfer dialog; never stack native dialogs.
    dialogRef.current?.close();
    onClose();
    onSelectBag(tag);
  }
  return <dialog className="global-search-dialog" ref={dialogRef} aria-labelledby="global-search-title" onCancel={e => { e.preventDefault(); onClose(); }}><div className="search-heading"><h2 id="global-search-title">Baggage search</h2><button className="icon-button" onClick={onClose} aria-label="Close baggage search"><CloseIcon color="#2D2D2D" size={18} /></button></div><input autoFocus type="search" aria-label="Search full bag tag or flight" placeholder="Search full bag tag or flight" value={query} onChange={e => setQuery(e.target.value)} /><div className="search-results">{matches.map(b => <button key={b.tag_number} onClick={() => choose(b.tag_number)}><strong>{b.tag_number}</strong><span>{b.flight_number} · {b.departure_airport} → {b.arrival_airport}</span><span>{formatStatusLabel(b.status)}</span></button>)}{!matches.length && <p className="table-empty" role="status">No authorized matching baggage records.</p>}</div></dialog>;
}
