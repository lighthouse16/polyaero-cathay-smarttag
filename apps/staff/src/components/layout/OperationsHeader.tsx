"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SidebarView } from "../../lib/types";
import { formatHongKongClock } from "../../lib/utils";
import { useSlidingIndicator } from "../ui/useSlidingIndicator";
import {
  BarChartIcon,
  BellIcon,
  LayersIcon,
  LuggageIcon,
  SearchIcon,
  UserCircleIcon,
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
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const navKey = activeView === "exceptions" ? "transfer-control" : activeView;
  const indicator = useSlidingIndicator(navKey, navRef, `.${styles.navButton}`);

  useEffect(() => {
    const updateClock = () => setClock(formatHongKongClock(new Date()));
    updateClock();
    const timer = setInterval(updateClock, 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 6;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const countKnown = actionRequiredCount !== null &&
    Number.isSafeInteger(actionRequiredCount) && actionRequiredCount >= 0;
  const clockLabel = clock ? `${clock.dateLine}, ${clock.tzLine}` : "Station clock loading";

  return (
    <header className={styles.header} data-scrolled={scrolled ? "true" : undefined}>
      <div className={styles.brand}>
        <Image
          src="/cathay/cathay-en.svg"
          alt="Cathay Pacific"
          width={496}
          height={120}
          className={styles.logo}
          priority
        />
      </div>

      <nav
        ref={navRef}
        className={styles.navigation}
        data-indicator-ready={indicator.ready ? "true" : undefined}
        aria-label="Ground Operations"
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            data-tab-key={id}
            className={styles.navButton}
            aria-current={activeView === id ? "page" : undefined}
            onClick={() => onSelectView(id)}
          >
            <Icon size={16} color="currentColor" />
            {label}
          </button>
        ))}
        {indicator.ready && (
          <span
            aria-hidden="true"
            className={styles.navInkBar}
            style={{
              width: `${indicator.width}px`,
              transform: `translate3d(${indicator.left}px, 0, 0)`,
            }}
          />
        )}
      </nav>

      <div className={styles.tools}>
        <button
          type="button"
          className={styles.search}
          onClick={onOpenSearch}
          aria-label="Search baggage by bag tag or flight"
          aria-keyshortcuts="Control+K Meta+K"
          title="Search baggage"
        >
          <SearchIcon size={16} color="currentColor" />
          <span className={styles.searchLabel}>Search bag or flight</span>
        </button>
        {station ? (
          <div className={styles.station}>
            <span>{station}</span>
            <span className={styles.mobileClock} aria-label={clockLabel}>
              {clock ? clock.dateLine.slice(-8) : "—"}
            </span>
          </div>
        ) : null}
        <div className={styles.clock} aria-label={clockLabel}>
          <span>{clock?.dateLine ?? "—"}</span>
          <span className={styles.timezone}>{clock?.tzLine ?? "HKG station clock"}</span>
        </div>
        <div className={styles.userActions}>
          <button
            type="button"
            className={styles.alerts}
            data-has-alerts={countKnown && actionRequiredCount! > 0 ? "true" : undefined}
            onClick={onOpenAlerts}
            aria-label={
              countKnown && actionRequiredCount! > 0
                ? `Filter ${actionRequiredCount} bags requiring action`
                : "Notifications"
            }
            title="Notifications"
          >
            <BellIcon size={20} color="currentColor" />
          </button>
          <button
            type="button"
            className={styles.profile}
            aria-label="Staff profile"
            title="Staff profile"
          >
            <UserCircleIcon size={22} color="currentColor" />
          </button>
        </div>
      </div>
    </header>
  );
}
