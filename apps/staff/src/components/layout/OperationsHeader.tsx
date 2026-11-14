"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { SidebarView } from "../../lib/types";
import { formatHongKongClock } from "../../lib/utils";
import {
  BarChartIcon,
  BellIcon,
  LayersIcon,
  LuggageIcon,
  SearchIcon,
} from "../icons/DashboardIcons";
import styles from "./OperationsHeader.module.css";

interface OperationsHeaderProps {
  station: string;
  activeView: SidebarView;
  onSelectView: (view: SidebarView) => void;
  onOpenSearch: () => void;
  actionRequiredCount: number | null;
  onOpenAlerts: () => void;
}

const NAV_ITEMS = [
  { id: "transfer-control", label: "Transfer Control", Icon: LayersIcon },
  { id: "baggage-trace", label: "Baggage Trace", Icon: LuggageIcon },
  { id: "performance", label: "Performance", Icon: BarChartIcon },
] as const;

export function OperationsHeader({
  station,
  activeView,
  onSelectView,
  onOpenSearch,
  actionRequiredCount,
  onOpenAlerts,
}: OperationsHeaderProps) {
  const [clock, setClock] = useState<ReturnType<typeof formatHongKongClock> | null>(null);

  useEffect(() => {
    const updateClock = () => setClock(formatHongKongClock(new Date()));
    updateClock();
    const timer = setInterval(updateClock, 15_000);
    return () => clearInterval(timer);
  }, []);

  const countKnown = actionRequiredCount !== null &&
    Number.isSafeInteger(actionRequiredCount) && actionRequiredCount >= 0;
  const clockLabel = clock ? `${clock.dateLine}, ${clock.tzLine}` : "Station clock loading";

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Image
          src="/cathay/cathay-en.svg"
          alt="Cathay Pacific"
          width={496}
          height={120}
          className={styles.logo}
          priority
        />
        <span className={styles.title}>Ground Operations</span>
      </div>

      <nav className={styles.navigation} aria-label="Ground Operations">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={styles.navButton}
            aria-current={activeView === id ? "page" : undefined}
            onClick={() => onSelectView(id)}
          >
            <Icon size={16} color="#2D2D2D" />
            {label}
          </button>
        ))}
      </nav>

      <div className={styles.tools}>
        <button
          type="button"
          className={styles.search}
          onClick={onOpenSearch}
          aria-label="Search baggage by bag tag or flight"
          aria-keyshortcuts="Control+K Meta+K"
          title="Search baggage (Ctrl/Cmd+K)"
        >
          <SearchIcon size={16} color="#2D2D2D" />
          <span className={styles.searchLabel}>Search bag or flight</span>
          <kbd className={styles.shortcut}>Ctrl/⌘ K</kbd>
        </button>
        <div className={styles.station}>
          <span>{station}</span>
          <span className={styles.mobileClock} aria-label={clockLabel}>
            {clock ? clock.dateLine.slice(-5) : "—"}
          </span>
        </div>
        <div className={styles.clock} aria-label={clockLabel}>
          <span>{clock?.dateLine ?? "—"}</span>
          <span className={styles.timezone}>{clock?.tzLine ?? "HKG station clock"}</span>
        </div>
        {countKnown && (
          <button
            type="button"
            className={styles.alerts}
            onClick={onOpenAlerts}
            aria-label={`Filter ${actionRequiredCount} bags requiring action`}
            title="Show bags requiring action"
          >
            <BellIcon size={18} color="#2D2D2D" />
            <span className={styles.alertCount}>{actionRequiredCount}</span>
          </button>
        )}
      </div>
    </header>
  );
}
