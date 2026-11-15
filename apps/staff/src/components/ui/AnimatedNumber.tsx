"use client";

import React, { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number | null | undefined;
  decimals?: number;
  suffix?: string;
  locale?: string;
  fallback?: string;
  durationMs?: number;
}

function formatNumeric(
  num: number,
  decimals: number,
  suffix: string,
  locale: string,
): string {
  const formatted =
    decimals > 0
      ? num.toFixed(decimals)
      : Math.round(num).toLocaleString(locale);
  return `${formatted}${suffix}`;
}

/**
 * Animates numeric KPI transitions smoothly on the client while keeping
 * SSR and initial paint deterministic for automated rendering checks.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  locale = "en-GB",
  fallback = "—",
  durationMs = 520,
}: AnimatedNumberProps) {
  const valid = value !== null && value !== undefined && Number.isFinite(value);
  const [rendered, setRendered] = useState<number | null>(valid ? value! : null);
  const currentRef = useRef<number>(valid ? value! : 0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!valid || value === null || value === undefined) {
      setRendered(null);
      currentRef.current = 0;
      mountedRef.current = true;
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = mountedRef.current ? currentRef.current : 0;
    const to = value;
    mountedRef.current = true;

    if (reducedMotion || Math.abs(to - from) < 0.001) {
      currentRef.current = to;
      setRendered(to);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      currentRef.current = next;
      setRendered(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        currentRef.current = to;
        setRendered(to);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, valid, durationMs]);

  if (!valid || rendered === null) {
    return <>{fallback}</>;
  }

  return <>{formatNumeric(rendered, decimals, suffix, locale)}</>;
}
