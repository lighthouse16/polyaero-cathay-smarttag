"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  buildSanitizedCopilotContext,
  DEFAULT_COPILOT_PROMPTS,
  streamCopilotResponse,
  type CopilotMessage,
  type CopilotStarterPrompt,
} from "../../lib/copilot";
import { aggregateOutboundFlights } from "../../lib/transferControl";
import type { SidebarView, TransferControlSnapshot } from "../../lib/types";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CompareBarsIcon,
  CopyIcon,
  DocumentLinesIcon,
  GripDotsIcon,
  MicrophoneIcon,
  PlusIcon,
  RotateCcwIcon,
  SparkleAiIcon,
  StopSquareIcon,
  SwitchArrowsIcon,
  TrendChartIcon,
} from "../icons/DashboardIcons";
import { CopilotMessageBody } from "./CopilotMessageBody";
import { ThoughtLine } from "./ThoughtLine";
import styles from "./OperationsCopilot.module.css";

interface SpeechRecognitionClient {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionClient;
  webkitSpeechRecognition?: new () => SpeechRecognitionClient;
};

interface InternalTurnState extends CopilotMessage {
  /** Tracks active ThoughtLine reasoning phase independently of text answer streaming */
  thinking: boolean;
}

export interface OperationsCopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: TransferControlSnapshot | null;
  now: Date;
  activeView: SidebarView;
  operatorName?: string;
  station?: string;
  endpoint?: string;
  hideLauncher?: boolean;
  onLocateBag?: (bagTag: string) => void;
  onSelectOutboundFlight?: (legId: string) => void;
}

function PromptCardIcon({ icon }: { icon: CopilotStarterPrompt["icon"] }) {
  switch (icon) {
    case "compare":
      return <CompareBarsIcon size={17} color="currentColor" />;
    case "arrows":
      return <SwitchArrowsIcon size={17} color="currentColor" />;
    case "trend":
      return <TrendChartIcon size={17} color="currentColor" />;
    case "document":
      return <DocumentLinesIcon size={17} color="currentColor" />;
  }
}

function makeMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface Position {
  x: number;
  y: number;
}

function clampPosition(x: number, y: number, width: number, height: number): Position {
  if (typeof window === "undefined") return { x, y };
  const pad = 12;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad);
  return {
    x: Math.max(pad, Math.min(maxX, x)),
    y: Math.max(pad, Math.min(maxY, y)),
  };
}

export function OperationsCopilotDrawer({
  open,
  onOpenChange,
  snapshot,
  now,
  activeView,
  operatorName = "Dang",
  station = "HKG · T1",
  endpoint,
  hideLauncher = false,
  onLocateBag,
  onSelectOutboundFlight,
}: OperationsCopilotDrawerProps) {
  const [messages, setMessages] = useState<InternalTurnState[]>([]);
  const [draft, setDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Grammarly-style draggable positions
  const [launcherPos, setLauncherPos] = useState<Position | null>(null);
  const [drawerPos, setDrawerPos] = useState<Position | null>(null);
  const [isDraggingLauncher, setIsDraggingLauncher] = useState(false);
  const [isDraggingDrawer, setIsDraggingDrawer] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const suppressClickRef = useRef(false);
  const launcherDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    currentPos: Position | null;
  } | null>(null);
  const drawerDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    currentPos: Position | null;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionClient | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pinnedBottomRef = useRef(true);

  // Restore cached coordinates from localStorage
  useEffect(() => {
    try {
      const savedLauncher = localStorage.getItem("copilot_launcher_pos");
      if (savedLauncher) {
        const parsed = JSON.parse(savedLauncher) as Position;
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setLauncherPos(parsed);
        }
      }
      const savedDrawer = localStorage.getItem("copilot_drawer_pos");
      if (savedDrawer) {
        const parsed = JSON.parse(savedDrawer) as Position;
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setDrawerPos(parsed);
        }
      }
    } catch {
      /* ignore storage access errors */
    }
  }, []);

  // Re-clamp on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      setLauncherPos((prev) => {
        if (!prev || !launcherRef.current) return prev;
        const rect = launcherRef.current.getBoundingClientRect();
        return clampPosition(prev.x, prev.y, rect.width, rect.height);
      });
      setDrawerPos((prev) => {
        if (!prev || !drawerRef.current) return prev;
        const rect = drawerRef.current.getBoundingClientRect();
        return clampPosition(prev.x, prev.y, rect.width, rect.height);
      });
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  const isStreaming = messages.some((m) => m.status === "streaming");

  const knownBagTags = useMemo(
    () => new Set(snapshot?.bags.map((b) => b.tag_number) ?? []),
    [snapshot],
  );

  const knownFlightLegByNumber = useMemo(() => {
    const map = new Map<string, string>();
    if (!snapshot) return map;
    for (const summary of aggregateOutboundFlights(snapshot, now)) {
      map.set(summary.leg.flightNumber, summary.leg.id);
    }
    return map;
  }, [snapshot, now]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = viewportRef.current;
    if (!el) return;
    pinnedBottomRef.current = true;
    setShowScrollBottom(false);
    if (typeof el.scrollTo === "function") {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleViewportScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 72;
    pinnedBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom && messages.length > 0);
  }, [messages.length]);

  useEffect(() => {
    if (open && pinnedBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages, open, scrollToBottom]);

  useEffect(() => {
    if (!open) return;
    const focusId = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 60);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const adjustTextareaHeight = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages((prev) =>
      prev.map((m) =>
        m.status === "streaming"
          ? {
              ...m,
              status: "stopped",
              thinking: false,
            }
          : m,
      ),
    );
  }, []);

  const runPrompt = useCallback(
    async (
      rawText: string,
      baseHistory?: InternalTurnState[],
    ) => {
      const prompt = rawText.trim();
      if (!prompt) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userId = makeMessageId();
      const assistantId = makeMessageId();
      const createdAt = new Date().toISOString();

      const priorHistory = baseHistory ?? messages;
      const cleanHistory = priorHistory
        .filter((m) => m.content.trim().length > 0 && m.status !== "error")
        .map((m) => ({ role: m.role, content: m.content }));

      const userMessage: InternalTurnState = {
        id: userId,
        role: "user",
        content: prompt,
        status: "complete",
        steps: [],
        thinking: false,
        createdAt,
      };

      const assistantPlaceholder: InternalTurnState = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
        steps: [],
        thinking: true,
        createdAt,
      };

      pinnedBottomRef.current = true;
      setMessages([...priorHistory, userMessage, assistantPlaceholder]);

      const context = buildSanitizedCopilotContext({
        snapshot,
        now,
        activeView,
        station,
      });

      try {
        await streamCopilotResponse({
          messages: [...cleanHistory, { role: "user", content: prompt }],
          context,
          endpoint,
          signal: controller.signal,
          onEvent: (event) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                switch (event.type) {
                  case "meta":
                    return {
                      ...m,
                      mode: event.mode,
                      provider: event.provider,
                    };
                  case "thought_step":
                    return {
                      ...m,
                      steps: m.steps.includes(event.step)
                        ? m.steps
                        : [...m.steps, event.step],
                      thoughtLabel: event.label ?? m.thoughtLabel,
                    };
                  case "text_delta":
                    return {
                      ...m,
                      thinking: false,
                      content: m.content + event.delta,
                    };
                  case "done":
                    return {
                      ...m,
                      thinking: false,
                      status: m.status === "error" ? "error" : "complete",
                      thoughtSeconds:
                        event.elapsedSeconds ?? m.thoughtSeconds,
                    };
                  case "error":
                    return {
                      ...m,
                      thinking: false,
                      status: "error",
                      error: event.message,
                    };
                }
              }),
            );
          },
        });
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to reach Copilot service";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  thinking: false,
                  status: "error",
                  error: message,
                }
              : m,
          ),
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [messages, snapshot, now, activeView, station, endpoint],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isStreaming || !draft.trim()) return;
    const text = draft;
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    void runPrompt(text);
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isStreaming && draft.trim()) {
        const text = draft;
        setDraft("");
        event.currentTarget.style.height = "auto";
        void runPrompt(text);
      }
    }
  };

  const handlePlusClick = () => {
    // Insert starter prompt or focus input
    textareaRef.current?.focus();
    if (!draft.trim()) {
      setDraft("Kiểm tra rủi ro kết nối các chuyến bay trễ HKG");
      adjustTextareaHeight(textareaRef.current);
    }
  };

  const handleMicClick = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (!draft.trim()) {
        setDraft("Báo cáo trạng thái hành lý chuyển tiếp");
        adjustTextareaHeight(textareaRef.current);
      }
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const text = event.results?.[0]?.[0]?.transcript;
        if (text) {
          setDraft((prev) => (prev ? `${prev} ${text}` : text));
          adjustTextareaHeight(textareaRef.current);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [isListening, draft, adjustTextareaHeight]);

  const handleStarterClick = (promptText: string) => {
    if (isStreaming) return;
    void runPrompt(promptText);
  };

  const handleResetChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setDraft("");
    setShowScrollBottom(false);
    textareaRef.current?.focus();
  };

  const handleRegenerate = (assistantIdx: number) => {
    if (isStreaming) return;
    // Find the user prompt immediately preceding this assistant message
    for (let i = assistantIdx - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        const promptText = messages[i].content;
        const base = messages.slice(0, i);
        void runPrompt(promptText, base);
        return;
      }
    }
  };

  const handleCopy = async (id: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1600);
    } catch {
      /* ignore clipboard denial */
    }
  };

  // Launcher pointer drag
  const handleLauncherPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const el = launcherRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    launcherDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      moved: false,
      currentPos: null,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore invalid pointer id in synthetic or unsupported environments */
    }
  };

  const handleLauncherPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current;
    if (!drag || !launcherRef.current) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 4) {
      drag.moved = true;
      setIsDraggingLauncher(true);
    }
    if (drag.moved) {
      const el = launcherRef.current;
      const rect = el.getBoundingClientRect();
      const clamped = clampPosition(drag.origX + dx, drag.origY + dy, rect.width, rect.height);
      drag.currentPos = clamped;
      el.style.left = `${clamped.x}px`;
      el.style.top = `${clamped.y}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      setLauncherPos(clamped);
    }
  };

  const handleLauncherPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current;
    if (!drag) return;
    const wasMoved = drag.moved;
    const finalPos = drag.currentPos;
    launcherDragRef.current = null;
    setIsDraggingLauncher(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (wasMoved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 100);
      if (finalPos) {
        try {
          localStorage.setItem("copilot_launcher_pos", JSON.stringify(finalPos));
        } catch {
          /* ignore */
        }
      }
    }
  };

  const handleLauncherClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpenChange(true);
  };

  // Drawer header pointer drag
  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    const drawer = drawerRef.current;
    if (!drawer) return;
    const rect = drawer.getBoundingClientRect();
    drawerDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      moved: false,
      currentPos: null,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setIsDraggingDrawer(true);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = drawerDragRef.current;
    if (!drag || !drawerRef.current) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    drag.moved = true;
    const drawer = drawerRef.current;
    const rect = drawer.getBoundingClientRect();
    const clamped = clampPosition(drag.origX + dx, drag.origY + dy, rect.width, rect.height);
    drag.currentPos = clamped;
    drawer.style.left = `${clamped.x}px`;
    drawer.style.top = `${clamped.y}px`;
    drawer.style.right = "auto";
    drawer.style.bottom = "auto";
    setDrawerPos(clamped);
  };

  const handleHeaderPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const drag = drawerDragRef.current;
    if (!drag) return;
    const wasMoved = drag.moved;
    const finalPos = drag.currentPos;
    drawerDragRef.current = null;
    setIsDraggingDrawer(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (wasMoved && finalPos) {
      try {
        localStorage.setItem("copilot_drawer_pos", JSON.stringify(finalPos));
      } catch {
        /* ignore */
      }
    }
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;
    if (drawerRef.current) {
      drawerRef.current.style.left = "";
      drawerRef.current.style.top = "";
      drawerRef.current.style.right = "";
      drawerRef.current.style.bottom = "";
    }
    setDrawerPos(null);
    try {
      localStorage.removeItem("copilot_drawer_pos");
    } catch {
      /* ignore */
    }
  };

  const handleLauncherDoubleClick = () => {
    if (launcherRef.current) {
      launcherRef.current.style.left = "";
      launcherRef.current.style.top = "";
      launcherRef.current.style.right = "";
      launcherRef.current.style.bottom = "";
    }
    setLauncherPos(null);
    try {
      localStorage.removeItem("copilot_launcher_pos");
    } catch {
      /* ignore */
    }
  };

  if (!open) {
    if (hideLauncher) return null;
    return (
      <button
        ref={launcherRef}
        type="button"
        className={`${styles.launcherFab} ${isDraggingLauncher ? styles.isDragging : ""}`}
        onClick={handleLauncherClick}
        onDoubleClick={handleLauncherDoubleClick}
        onPointerDown={handleLauncherPointerDown}
        onPointerMove={handleLauncherPointerMove}
        onPointerUp={handleLauncherPointerUp}
        onPointerCancel={handleLauncherPointerUp}
        style={
          launcherPos
            ? {
                left: `${launcherPos.x}px`,
                top: `${launcherPos.y}px`,
                right: "auto",
                bottom: "auto",
              }
            : undefined
        }
        aria-label="Open Baggage Recovery Copilot (Drag to reposition)"
        title="Baggage Recovery Copilot (Drag to reposition)"
      >
        <span className={styles.launcherGrip} aria-hidden="true">
          <GripDotsIcon size={12} color="currentColor" />
        </span>
        <SparkleAiIcon size={18} color="currentColor" />
        <span>Baggage Recovery Copilot</span>
      </button>
    );
  }

  return (
    <aside
      ref={drawerRef}
      className={`${styles.drawer} ${isDraggingDrawer ? styles.isDragging : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label="Baggage Recovery Copilot"
      style={
        drawerPos
          ? {
              left: `${drawerPos.x}px`,
              top: `${drawerPos.y}px`,
              right: "auto",
              bottom: "auto",
            }
          : undefined
      }
    >
      <header
        className={`${styles.header} ${isDraggingDrawer ? styles.isHeaderDragging : ""}`}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        onDoubleClick={handleHeaderDoubleClick}
        title="Drag header to move · Double-click to dock"
      >
        <div className={styles.dragHandleBar} aria-hidden="true" />
        <div className={styles.headerIdentity}>
          <span className={styles.headerGlyph}>
            <SparkleAiIcon size={22} color="currentColor" />
          </span>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>Baggage Recovery Copilot</h2>
            </div>
            <p className={styles.subtitle}>AI assistant for baggage transfer</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {messages.length > 0 && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleResetChat}
              aria-label="New conversation"
              title="New conversation"
            >
              <RotateCcwIcon size={15} color="currentColor" />
              <span>New</span>
            </button>
          )}
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onOpenChange(false)}
            aria-label="Close Baggage Recovery Copilot"
            title="Close"
          >
            <CloseIcon size={18} color="currentColor" />
          </button>
        </div>
      </header>

      <div className={styles.viewportWrap}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          onScroll={handleViewportScroll}
        >
          {messages.length === 0 ? (
            <div className={styles.welcomeState}>
              <div className={styles.greetingRow}>
                <span className={styles.assistantAvatar} aria-hidden="true">
                  <SparkleAiIcon size={18} color="currentColor" />
                </span>
                <div className={styles.greetingBubble}>
                  Hi {operatorName}, how can I help you with transfer
                  operations?
                </div>
              </div>

              <h3 className={styles.tryAskingHeading}>Try asking</h3>

              <div className={styles.promptGrid}>
                {DEFAULT_COPILOT_PROMPTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.promptCard}
                    onClick={() => handleStarterClick(item.label)}
                  >
                    <span className={styles.promptLeft}>
                      <span className={styles.promptIcon} aria-hidden="true">
                        <PromptCardIcon icon={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </span>
                    <span className={styles.promptChevron} aria-hidden="true">
                      <ChevronRightIcon size={16} color="currentColor" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.thread} aria-live="polite">
              {messages.map((msg, idx) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className={styles.turnUser}>
                      <div className={styles.userBubble}>{msg.content}</div>
                    </div>
                  );
                }

                const showAnswerStreaming =
                  msg.status === "streaming" && !msg.thinking;
                const isLastAssistant = idx === messages.length - 1;

                return (
                  <div key={msg.id} className={styles.turnAssistant}>
                    <div className={styles.thoughtWrap}>
                      <ThoughtLine
                        working={msg.thinking}
                        steps={msg.steps}
                        label={msg.thoughtLabel || "Thinking…"}
                        doneLabel="Thought for"
                        glyph="sparkle"
                        color="#2D2D2D"
                        glyphColor="#163230"
                        fontSize={14}
                        breathPeriod={1.6}
                        breathDepth={0.45}
                        settleDuration={350}
                        settleBlur={2}
                        collapsible
                        collapseOnSettle
                        showTimer
                        elapsed={msg.thoughtSeconds}
                        onSettle={(seconds) => {
                          setMessages((prev) =>
                            prev.map((item) =>
                              item.id === msg.id && item.thoughtSeconds == null
                                ? { ...item, thoughtSeconds: seconds }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>

                    <CopilotMessageBody
                      content={msg.content}
                      streaming={showAnswerStreaming}
                      knownBagTags={knownBagTags}
                      knownFlightLegByNumber={knownFlightLegByNumber}
                      onSelectBag={onLocateBag}
                      onSelectFlight={onSelectOutboundFlight}
                    />

                    {msg.status === "stopped" && (
                      <div className={styles.stoppedNote}>
                        Response stopped
                      </div>
                    )}

                    {msg.status === "error" && (
                      <div className={styles.errorBox} role="alert">
                        <span>{msg.error || "Unable to generate response"}</span>
                        <button
                          type="button"
                          className={styles.retryBtn}
                          onClick={() => handleRegenerate(idx)}
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {msg.status !== "streaming" && msg.content.trim() && (
                      <div className={styles.messageActions}>
                        <button
                          type="button"
                          className={styles.actionPill}
                          onClick={() => void handleCopy(msg.id, msg.content)}
                          aria-label="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <CheckIcon size={13} color="#163230" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon size={13} color="currentColor" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        {isLastAssistant && (
                          <button
                            type="button"
                            className={styles.actionPill}
                            onClick={() => handleRegenerate(idx)}
                            aria-label="Regenerate response"
                          >
                            <RotateCcwIcon size={13} color="currentColor" />
                            <span>Regenerate</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showScrollBottom && (
          <button
            type="button"
            className={styles.scrollBottomBtn}
            onClick={() => scrollToBottom(true)}
          >
            Jump to latest ↓
          </button>
        )}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <div className={styles.composerCapsule}>
          <textarea
            ref={textareaRef}
            id="copilot-prompt-input"
            name="copilotPrompt"
            rows={1}
            className={styles.textarea}
            value={draft}
            placeholder="Ask anything"
            aria-label="Ask Baggage Recovery Copilot a question"
            onChange={(e) => {
              setDraft(e.target.value);
              adjustTextareaHeight(e.currentTarget);
            }}
            onKeyDown={handleTextareaKeyDown}
          />
          <div className={styles.composerActionsRow}>
            <div className={styles.composerLeftActions}>
              <button
                type="button"
                className={styles.plusBtn}
                onClick={handlePlusClick}
                aria-label="Add context"
                title="Add context or prompt"
              >
                <PlusIcon size={16} color="currentColor" />
              </button>
            </div>
            <div className={styles.composerRightActions}>
              <button
                type="button"
                className={styles.micBtn}
                data-listening={isListening ? "true" : undefined}
                onClick={handleMicClick}
                aria-label={isListening ? "Stop listening" : "Voice input"}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                <MicrophoneIcon size={18} color="currentColor" />
              </button>
              {(isStreaming || draft.trim().length > 0) && (
                isStreaming ? (
                  <button
                    type="button"
                    className={`${styles.sendBtn} ${styles.stopBtn}`}
                    onClick={stopGeneration}
                    aria-label="Stop response"
                    title="Stop generating"
                  >
                    <StopSquareIcon size={15} color="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    aria-label="Send message"
                    title="Send message"
                  >
                    <ArrowUpIcon size={18} color="currentColor" />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </form>
    </aside>
  );
}
