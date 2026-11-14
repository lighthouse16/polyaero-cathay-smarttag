import type { LiveBag, BaggageEventItem } from "./types";

export function formatTimeHHMM(isoString?: string | null): string {
  if (!isoString || !Number.isFinite(Date.parse(isoString))) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(isoString));
}

export function formatHongKongClock(date: Date): {
  dateLine: string;
  tzLine: string;
} {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Hong_Kong",
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
    return {
      dateLine: formatted.replace(/, (\d{2}:\d{2}:\d{2})$/, " $1"),
      tzLine: "UTC+8 · HKG",
    };
  } catch {
    return {
      dateLine: date.toISOString().slice(0, 19).replace("T", " "),
      tzLine: "UTC",
    };
  }
}

export function formatStatusLabel(status: string): string {
  const s = (status || "").toUpperCase();
  const map: Record<string, string> = {
    MISROUTED: "Misrouted",
    MISSING: "Missing",
    RECOVERY_IN_PROGRESS: "Recovery",
    IN_TRANSFER: "In transfer",
    LOADED: "Loaded",
    CHECKED_IN: "Checked in",
    TAGGED: "Tag synced",
    ARRIVED: "Arrived",
    ON_CAROUSEL: "On carousel",
    COLLECTED: "Collected",
    CLAIMED: "Collected",
    AWAITING_SYNC: "Awaiting sync",
  };
  return (
    map[s] ??
    s
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function isExceptionBag(bag: LiveBag): boolean {
  const s = (bag.status || "").toUpperCase();
  return s === "MISROUTED" || s === "MISSING" || s === "RECOVERY_IN_PROGRESS";
}

export function isAtRiskBag(bag: LiveBag): boolean {
  return (
    bag.risk_score >= 35 ||
    isExceptionBag(bag) ||
    (bag.connection_minutes ?? 999) < 70
  );
}

export function getLatestEvent(bag: LiveBag): BaggageEventItem | null {
  if (!bag.events || bag.events.length === 0) return null;
  const sorted = [...bag.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return sorted[0];
}

export function formatLastEventSummary(bag: LiveBag): string {
  const evt = getLatestEvent(bag);
  if (!evt) return "No events yet";
  const rawNotes = evt.notes?.trim() ?? "";
  if (/^\d{2}:\d{2}\s*·\s*.+$/.test(rawNotes) && rawNotes.length <= 40) {
    return rawNotes;
  }
  const time = formatTimeHHMM(evt.timestamp);
  const note = rawNotes.split("·")[0].trim();
  if (note && note.length <= 28) return `${time} · ${note}`;
  const labelMap: Record<string, string> = {
    MISROUTED: "Transfer exception",
    MISSING: "Exception trace",
    RECOVERY_IN_PROGRESS: "Recovery active",
    LOADED: "Loaded to ULD",
    CHECKED_IN: "Bag accepted",
    TAGGED: "SmartTag synced",
    ARRIVED: "Arrived carousel",
    COLLECTED: "Claimed",
  };
  const evtLabel =
    labelMap[evt.event_type.toUpperCase()] ?? formatStatusLabel(evt.event_type);
  return `${time} · ${evtLabel}`;
}

export interface ParsedRiskFactor {
  label: string;
  weightPct: number | null;
  severity: "high" | "medium" | "low";
}

export function parseRiskFactors(bag: LiveBag): ParsedRiskFactor[] {
  const raw = bag.risk_factors;
  if (raw && raw.length > 0) {
    return raw.map((item, idx) => {
      const match = item.match(/^(.*?)\s*\[(\d+(?:\.\d+)?)%\]\s*$/);
      if (match) {
        const weightPct = Math.round(Number(match[2]));
        return {
          label: match[1].trim(),
          weightPct,
          severity:
            weightPct >= 45
              ? "high"
              : weightPct >= 20
                ? "medium"
                : "low",
        };
      }
      return {
        label: item,
        weightPct: null,
        severity:
          idx === 0 && bag.risk_score >= 65
            ? "high"
            : idx === 0
              ? "medium"
              : "low",
      };
    });
  }

  // Fallback qualitative factors derived strictly from actual bag fields (no fabricated weights)
  const items: ParsedRiskFactor[] = [];
  if (typeof bag.connection_minutes === "number") {
    items.push({
      label: `Connection buffer (${bag.connection_minutes} min)`,
      weightPct: null,
      severity:
        bag.connection_minutes < 45
          ? "high"
          : bag.connection_minutes < 70
            ? "medium"
            : "low",
    });
  }
  if (bag.last_known_location) {
    items.push({
      label: `Last scan (${bag.last_known_location})`,
      weightPct: null,
      severity: isExceptionBag(bag) ? "high" : "low",
    });
  }
  items.push({
    label: `Current status (${formatStatusLabel(bag.status)})`,
    weightPct: null,
    severity: isExceptionBag(bag) ? "high" : "low",
  });
  return items;
}

export function scannerBadgeLabel(scannerType: string): string {
  const map: Record<string, string> = {
    NFC_TAP: "Reported NFC event",
    RFID_GATE: "RFID Gate",
    OPTICAL_BARCODE: "Optical Scan",
    MANUAL_OVERRIDE: "Staff Override",
    APP: "Passenger App",
  };
  return map[scannerType] ?? scannerType;
}
