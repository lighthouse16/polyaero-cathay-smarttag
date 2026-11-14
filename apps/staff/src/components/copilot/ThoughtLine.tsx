"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  SparkleAiIcon,
} from "../icons/DashboardIcons";
import "./ThoughtLine.css";

const EASE_OUT_BEZIER = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT_BEZIER = "cubic-bezier(0.77, 0, 0.175, 1)";
const GLYPH_DONE = 0.55;
const EMPTY_STEPS: readonly string[] = [];

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const formatDeciseconds = (ds: number): string =>
  ds < 600
    ? `${(ds / 10).toFixed(1)}s`
    : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`;

const formatSpoken = (ds: number): string =>
  ds < 600
    ? `${(ds / 10).toFixed(1)} seconds`
    : `${Math.floor(ds / 600)} minutes ${((ds % 600) / 10).toFixed(1)} seconds`;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export interface ThoughtLineProps {
  label?: string;
  doneLabel?: string;
  renderLabel?: (text: string, working: boolean) => ReactNode;
  glyph?: "sparkle" | "dot" | "none" | ReactNode;
  steps?: readonly string[];
  collapsible?: boolean;
  collapseOnSettle?: boolean;
  color?: string;
  glyphColor?: string;
  fontSize?: number;
  breathPeriod?: number;
  breathDepth?: number;
  shimmer?: boolean;
  shimmerDuration?: number;
  settleDuration?: number;
  settleBlur?: number;
  working?: boolean;
  settleAfter?: number;
  elapsed?: number;
  showTimer?: boolean;
  onSettle?: (seconds: number) => void;
  className?: string;
  style?: CSSProperties;
}

export function ThoughtLine({
  label = "Thinking…",
  doneLabel = "",
  renderLabel,
  glyph = "sparkle",
  steps = EMPTY_STEPS,
  collapsible = true,
  collapseOnSettle = true,
  color = "currentColor",
  glyphColor = "",
  fontSize = 14,
  breathPeriod = 1.6,
  breathDepth = 0.45,
  shimmer = true,
  shimmerDuration = 1.8,
  settleDuration = 350,
  settleBlur = 2,
  working = true,
  settleAfter = 0,
  elapsed,
  showTimer = true,
  onSettle,
  className = "",
  style,
}: ThoughtLineProps) {
  const reduce = usePrefersReducedMotion();
  const [autoSettled, setAutoSettled] = useState(false);
  const [open, setOpen] = useState(() => (working ? true : !collapseOnSettle));

  const isWorking = working && !autoSettled;
  const doneText = doneLabel || (showTimer ? "Thought for" : "Done thinking");
  const hasTrace = steps.length > 0;
  const depth = reduce ? Math.min(breathDepth, 0.2) : breathDepth;
  const period = reduce ? breathPeriod * 1.5 : breathPeriod;
  const trough = Math.max(0, 1 - depth);
  const sheen = shimmer && !reduce;

  const glyphRef = useRef<HTMLSpanElement>(null);
  const breathRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const stackRef = useRef<HTMLSpanElement>(null);
  const workRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef<HTMLSpanElement>(null);

  const initialDs = elapsed != null ? Math.max(0, Math.round(elapsed * 10)) : 0;
  const dsRef = useRef<number>(initialDs);
  const prevWorking = useRef<boolean>(isWorking);
  const latest = useRef<{ onSettle?: (seconds: number) => void }>({});
  latest.current = { onSettle };

  const [announce, setAnnounce] = useState(() =>
    isWorking
      ? label
      : showTimer
        ? `${doneText} ${formatSpoken(initialDs)}`
        : doneText,
  );

  useEffect(() => {
    if (working) {
      setAutoSettled(false);
    }
  }, [working]);

  useEffect(() => {
    if (isWorking) {
      setOpen(true);
    } else if (collapseOnSettle) {
      setOpen(false);
    }
  }, [isWorking, collapseOnSettle]);

  // Breathing & settle opacity orchestration via Web Animations API
  useEffect(() => {
    const glyphEl = glyphRef.current;
    const breathEl = breathRef.current;
    if (!breathEl || typeof breathEl.animate !== "function") return undefined;

    const settleMs = Math.max(0, settleDuration);
    const periodMs = Math.max(200, period * 1000);
    const animations: Animation[] = [];
    let cancelled = false;

    const loopOpacity = (el: HTMLElement, delayMs: number): Animation =>
      el.animate([{ opacity: trough }, { opacity: 1 }, { opacity: trough }], {
        duration: periodMs,
        easing: EASE_IN_OUT_BEZIER,
        iterations: Infinity,
        delay: delayMs,
        fill: "both",
      });

    if (isWorking) {
      if (depth > 0) {
        if (sheen) {
          animations.push(
            breathEl.animate([{ opacity: 1 }], {
              duration: 200,
              easing: EASE_OUT_BEZIER,
              fill: "forwards",
            }),
          );
        }
        if (glyphEl && typeof glyphEl.animate === "function") {
          const lead = glyphEl.animate([{ opacity: trough }], {
            duration: 200,
            easing: EASE_OUT_BEZIER,
            fill: "forwards",
          });
          animations.push(lead);
          void lead.finished
            .then(() => {
              if (cancelled) return;
              animations.push(loopOpacity(glyphEl, 0));
              if (!sheen) animations.push(loopOpacity(breathEl, 140));
            })
            .catch(() => {
              /* animation cancelled cleanly on unmount or state change */
            });
        } else if (!sheen) {
          animations.push(loopOpacity(breathEl, 140));
        }
      } else {
        if (glyphEl && typeof glyphEl.animate === "function") {
          animations.push(
            glyphEl.animate([{ opacity: 1 }], {
              duration: 200,
              easing: EASE_OUT_BEZIER,
              fill: "forwards",
            }),
          );
        }
        animations.push(
          breathEl.animate([{ opacity: 1 }], {
            duration: 200,
            easing: EASE_OUT_BEZIER,
            fill: "forwards",
          }),
        );
      }
    } else {
      if (glyphEl && typeof glyphEl.animate === "function") {
        animations.push(
          glyphEl.animate([{ opacity: GLYPH_DONE }], {
            duration: settleMs,
            easing: EASE_OUT_BEZIER,
            fill: "forwards",
          }),
        );
      }
      animations.push(
        breathEl.animate([{ opacity: 1 }], {
          duration: settleMs,
          easing: EASE_OUT_BEZIER,
          fill: "forwards",
        }),
      );
    }

    return () => {
      cancelled = true;
      for (const anim of animations) {
        anim.cancel();
      }
    };
  }, [isWorking, period, depth, trough, settleDuration, glyph, sheen]);

  // Live decisecond timer + controlled `elapsed` + optional `settleAfter`
  useIsomorphicLayoutEffect(() => {
    const paint = (ds: number) => {
      dsRef.current = ds;
      if (timerRef.current) {
        timerRef.current.textContent = formatDeciseconds(ds);
      }
    };

    if (elapsed != null) {
      paint(Math.max(0, Math.round(elapsed * 10)));
      return undefined;
    }

    if (!isWorking) return undefined;

    const startedAt = performance.now();
    paint(0);
    const id = window.setInterval(() => {
      const ds = Math.floor((performance.now() - startedAt) / 100);
      paint(ds);
      if (settleAfter > 0 && ds >= Math.round(settleAfter * 10)) {
        setAutoSettled(true);
      }
    }, 100);

    return () => window.clearInterval(id);
  }, [isWorking, elapsed, settleAfter]);

  // Glide the timer smoothly to track active label width without layout shift
  useIsomorphicLayoutEffect(() => {
    const t = timerRef.current;
    const stack = stackRef.current;
    if (!t || !stack) return undefined;

    const place = (glide: boolean) => {
      const active = isWorking ? workRef.current : doneRef.current;
      if (!active) return;
      const shift = active.offsetWidth - stack.offsetWidth;
      if (!glide) t.style.transition = "none";
      t.style.transform = `translateX(${shift}px)`;
      if (!glide) {
        void t.offsetWidth;
        t.style.transition = "";
      }
    };

    place(prevWorking.current !== isWorking);
    prevWorking.current = isWorking;

    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => place(false));
    if (workRef.current) ro.observe(workRef.current);
    if (doneRef.current) ro.observe(doneRef.current);
    return () => ro.disconnect();
  }, [isWorking, label, doneText, fontSize, showTimer]);

  // Screen reader status announcement + settle callback
  useEffect(() => {
    if (isWorking) {
      setAnnounce(label);
      return;
    }
    setAnnounce(
      showTimer
        ? `${doneText} ${formatSpoken(dsRef.current)}`
        : doneText,
    );
    latest.current.onSettle?.(dsRef.current / 10);
  }, [isWorking, label, doneText, showTimer]);

  const toggle = hasTrace && collapsible;

  const headContent = (
    <>
      {glyph !== "none" ? (
        <span ref={glyphRef} className="thought-line__glyph" aria-hidden="true">
          {glyph === "sparkle" ? (
            <SparkleAiIcon size={16} color="currentColor" />
          ) : glyph === "dot" ? (
            <span className="thought-line__dot" />
          ) : (
            glyph
          )}
        </span>
      ) : null}

      <span ref={stackRef} className="thought-line__label" aria-hidden="true">
        <span
          ref={workRef}
          className="thought-line__text"
          data-active={isWorking ? "" : undefined}
        >
          <span
            ref={breathRef}
            className="thought-line__breath"
            data-shimmer={sheen ? "" : undefined}
          >
            {renderLabel ? renderLabel(label, true) : label}
          </span>
        </span>
        <span
          ref={doneRef}
          className="thought-line__text thought-line__text--done"
          data-active={isWorking ? undefined : ""}
        >
          {renderLabel ? renderLabel(doneText, false) : doneText}
        </span>
      </span>

      {showTimer ? (
        <span
          ref={timerRef}
          className="thought-line__timer"
          data-done={isWorking ? undefined : ""}
          aria-hidden="true"
        >
          {formatDeciseconds(dsRef.current)}
        </span>
      ) : null}

      {collapsible ? (
        <span
          className="thought-line__chevron"
          data-on={hasTrace ? "" : undefined}
          aria-hidden="true"
        >
          <ChevronDownIcon size={14} color="currentColor" />
        </span>
      ) : null}

      <span className="thought-line__sr" role="status">
        {announce}
      </span>
    </>
  );

  const inlineVars = {
    "--tl-font": `${fontSize}px`,
    "--tl-color": color,
    "--tl-glyph": glyphColor || color,
    "--tl-settle": `${settleDuration}ms`,
    "--tl-blur": `${settleBlur}px`,
    "--tl-shimmer": `${shimmerDuration}s`,
    ...style,
  } as CSSProperties;

  return (
    <div
      className={`thought-line${className ? ` ${className}` : ""}`}
      data-working={isWorking ? "" : undefined}
      data-open={open && hasTrace ? "" : undefined}
      style={inlineVars}
    >
      {collapsible ? (
        <button
          type="button"
          className="thought-line__head"
          data-toggle={toggle ? "" : undefined}
          aria-expanded={toggle ? open : undefined}
          tabIndex={toggle ? 0 : -1}
          onClick={() => {
            if (toggle) setOpen((prev) => !prev);
          }}
        >
          {headContent}
        </button>
      ) : (
        <div className="thought-line__head">{headContent}</div>
      )}

      {hasTrace ? (
        <div
          className="thought-line__trace"
          data-open={open ? "" : undefined}
          aria-hidden={!open}
        >
          <div className="thought-line__fold">
            <div className="thought-line__steps">
              {steps.map((text, idx) => {
                const done = !isWorking || idx < steps.length - 1;
                return (
                  <div
                    key={`${idx}-${text}`}
                    className="thought-line__step"
                    data-done={done ? "" : undefined}
                  >
                    <span className="thought-line__mark" aria-hidden="true">
                      {done ? (
                        <CheckIcon size={12} color="currentColor" />
                      ) : (
                        <i className="thought-line__pulse" />
                      )}
                    </span>
                    <span className="thought-line__step-text">{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
