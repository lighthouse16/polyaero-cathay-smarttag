"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface SlidingIndicatorStyle {
  left: number;
  width: number;
  ready: boolean;
}

/**
 * Tracks the active item inside a horizontal navigation or tab container
 * so an underline indicator can glide cleanly across tabs and resize events.
 */
export function useSlidingIndicator(
  activeKey: string,
  containerRef: React.RefObject<HTMLElement | null>,
  itemSelector: string,
): SlidingIndicatorStyle {
  const [indicator, setIndicator] = useState<SlidingIndicatorStyle>({
    left: 0,
    width: 0,
    ready: false,
  });
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const escaped = CSS.escape(activeKeyRef.current);
    const active = container.querySelector<HTMLElement>(
      `${itemSelector}[data-tab-key="${escaped}"]`,
    );
    if (!active) {
      setIndicator((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const nextLeft = Math.round((activeRect.left - containerRect.left + container.scrollLeft) * 10) / 10;
    const nextWidth = Math.round(activeRect.width * 10) / 10;

    setIndicator((prev) =>
      prev.ready && Math.abs(prev.left - nextLeft) < 0.5 && Math.abs(prev.width - nextWidth) < 0.5
        ? prev
        : { left: nextLeft, width: nextWidth, ready: nextWidth > 0 },
    );
  }, [containerRef, itemSelector]);

  useLayoutEffect(() => {
    measure();
  }, [activeKey, measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(container);
    container.querySelectorAll<HTMLElement>(itemSelector).forEach((el) => {
      observer?.observe(el);
    });
    window.addEventListener("resize", schedule, { passive: true });
    document.fonts?.ready.then(schedule).catch(() => {});

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, itemSelector, measure]);

  return indicator;
}
