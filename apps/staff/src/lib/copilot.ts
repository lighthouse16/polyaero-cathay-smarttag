import {
  aggregateOutboundFlights,
  bagRiskScore,
  findBagConnection,
  isConnectionFresh,
  isTransferSnapshotFresh,
  timeToActMinutes,
  transferMetrics,
} from "./transferControl";
import type { SidebarView, TransferControlSnapshot } from "./types";

export type CopilotRole = "user" | "assistant";

export type CopilotMessageStatus =
  | "streaming"
  | "complete"
  | "stopped"
  | "error";

export type CopilotSourceMode =
  | "upstream-api"
  | "gemini-api"
  | "openai-api"
  | "snapshot-preview";

export interface CopilotMessage {
  id: string;
  role: CopilotRole;
  content: string;
  status: CopilotMessageStatus;
  steps: string[];
  thoughtLabel?: string;
  thoughtSeconds?: number;
  mode?: CopilotSourceMode;
  provider?: string;
  error?: string;
  createdAt: string;
}

export interface CopilotContextFlight {
  legId: string;
  flightNumber: string;
  destination: string;
  operatingDate: string;
  departureAt: string | null;
  transferBagCount: number;
  actionRequiredCount: number;
  atRiskCount: number;
  onTrackCount: number;
  unknownCount: number;
  riskScore: number | null;
  earliestActionAt: string | null;
  minutesToEarliestAction: number | null;
}

export interface CopilotContextBag {
  bagTag: string;
  inboundFlight: string | null;
  outboundFlight: string | null;
  outboundDestination: string | null;
  status: string;
  connectionStatus: "pending" | "transferred" | "missed" | null;
  attention: "action_required" | "at_risk" | "on_track" | "unknown";
  riskScore: number | null;
  lastKnownLocation: string;
  deadlineAt: string | null;
  minutesToAction: number | null;
  latestScanEventType: string | null;
  latestScanLocation: string | null;
  latestScanAt: string | null;
}

/**
 * PII-free, PNR-free operational transfer summary sent to the Copilot API.
 * Never includes passenger names, booking references, or seat numbers.
 */
export interface CopilotContextPayload {
  station: string;
  activeView: SidebarView;
  nowIso: string;
  snapshotAvailable: boolean;
  snapshotFresh: boolean;
  generatedAt: string | null;
  validUntil: string | null;
  source: string | null;
  missingInputs: string[];
  metrics: {
    total: number | null;
    actionRequired: number | null;
    atRisk: number | null;
    onTrack: number | null;
    unknown: number | null;
    successRatePct: number | null;
  };
  transferSuccess: {
    successful: number;
    eligible: number;
    windowStart: string;
    windowEnd: string;
  } | null;
  flights: CopilotContextFlight[];
  priorityBags: CopilotContextBag[];
}

export type CopilotStreamEvent =
  | { type: "meta"; mode: CopilotSourceMode; provider?: string }
  | { type: "thought_step"; step: string; label?: string }
  | { type: "text_delta"; delta: string }
  | { type: "done"; elapsedSeconds?: number }
  | { type: "error"; message: string };

export interface CopilotStarterPrompt {
  id: string;
  label: string;
  icon: "compare" | "arrows" | "trend" | "document";
}

export const DEFAULT_COPILOT_PROMPTS: readonly CopilotStarterPrompt[] = [
  {
    id: "flight-risk-compare",
    label: "Why is CX255 at higher risk than CX777?",
    icon: "compare",
  },
  {
    id: "prioritise-bags",
    label: "Which bags should we prioritise now?",
    icon: "arrows",
  },
  {
    id: "recovery-summary",
    label: "Summarise today's recovery performance.",
    icon: "trend",
  },
  {
    id: "upcoming-risks",
    label: "Any upcoming transfer risks in the next hour?",
    icon: "document",
  },
];

export function resolveCopilotEndpoint(): string {
  const configured = process.env.NEXT_PUBLIC_COPILOT_API_URL?.trim();
  if (configured) return configured;
  return "/api/v1/copilot/chat";
}

const ATTENTION_PRIORITY: Record<CopilotContextBag["attention"], number> = {
  action_required: 0,
  at_risk: 1,
  unknown: 2,
  on_track: 3,
};

export function buildSanitizedCopilotContext(input: {
  snapshot: TransferControlSnapshot | null;
  now: Date;
  activeView: SidebarView;
  station?: string;
}): CopilotContextPayload {
  const { snapshot, now, activeView, station = "HKG · T1" } = input;
  const nowIso = now.toISOString();

  if (!snapshot || snapshot.availability === "unavailable") {
    return {
      station,
      activeView,
      nowIso,
      snapshotAvailable: false,
      snapshotFresh: false,
      generatedAt: snapshot?.generatedAt ?? null,
      validUntil: snapshot?.validUntil ?? null,
      source: snapshot?.source ?? null,
      missingInputs: snapshot?.missingInputs ?? ["transfer_control_snapshot"],
      metrics: {
        total: null,
        actionRequired: null,
        atRisk: null,
        onTrack: null,
        unknown: null,
        successRatePct: null,
      },
      transferSuccess: null,
      flights: [],
      priorityBags: [],
    };
  }

  const snapshotFresh = isTransferSnapshotFresh(snapshot, now);
  const metrics = transferMetrics(snapshot, now);
  const legById = new Map(snapshot.legs.map((leg) => [leg.id, leg]));

  const flights: CopilotContextFlight[] = aggregateOutboundFlights(
    snapshot,
    now,
  )
    .map((item) => {
      const departureAt =
        item.leg.estimatedDepartureAt ?? item.leg.scheduledDepartureAt;
      const minutesToEarliestAction = item.earliestActionAt
        ? Math.round((Date.parse(item.earliestActionAt) - now.getTime()) / 60_000)
        : null;
      return {
        legId: item.leg.id,
        flightNumber: item.leg.flightNumber,
        destination: item.leg.destination,
        operatingDate: item.leg.operatingDate,
        departureAt,
        transferBagCount: item.transferBagCount,
        actionRequiredCount: item.actionRequiredCount,
        atRiskCount: item.atRiskCount,
        onTrackCount: item.onTrackCount,
        unknownCount: item.unknownCount,
        riskScore: item.riskScore,
        earliestActionAt: item.earliestActionAt,
        minutesToEarliestAction,
      };
    })
    .sort((a, b) => {
      if (b.actionRequiredCount !== a.actionRequiredCount) {
        return b.actionRequiredCount - a.actionRequiredCount;
      }
      if ((b.riskScore ?? -1) !== (a.riskScore ?? -1)) {
        return (b.riskScore ?? -1) - (a.riskScore ?? -1);
      }
      return b.atRiskCount - a.atRiskCount;
    })
    .slice(0, 24);

  const priorityBags: CopilotContextBag[] = snapshot.bags
    .map((bag) => {
      const conn = findBagConnection(snapshot, bag.tag_number);
      const inbound = conn ? legById.get(conn.inboundLegId) : undefined;
      const outbound = conn ? legById.get(conn.outboundLegId) : undefined;
      const connFresh = conn ? isConnectionFresh(snapshot, conn, now) : false;
      const attention: CopilotContextBag["attention"] =
        conn && connFresh ? conn.attention : "unknown";
      const mins = conn ? timeToActMinutes(conn.deadline, now) : null;
      const latestEvent = bag.events.length
        ? bag.events[bag.events.length - 1]
        : null;
      return {
        bagTag: bag.tag_number,
        inboundFlight: inbound?.flightNumber ?? null,
        outboundFlight: outbound?.flightNumber ?? bag.flight_number ?? null,
        outboundDestination:
          outbound?.destination ?? bag.arrival_airport ?? null,
        status: bag.status,
        connectionStatus: conn?.status ?? null,
        attention,
        riskScore: bagRiskScore(snapshot, bag.tag_number, now),
        lastKnownLocation: bag.last_known_location,
        deadlineAt: conn?.deadline?.at ?? null,
        minutesToAction: mins !== null ? Math.round(mins) : null,
        latestScanEventType: latestEvent?.event_type ?? null,
        latestScanLocation: latestEvent?.location_code ?? null,
        latestScanAt: latestEvent?.timestamp ?? null,
      };
    })
    .sort((a, b) => {
      const pa = ATTENTION_PRIORITY[a.attention];
      const pb = ATTENTION_PRIORITY[b.attention];
      if (pa !== pb) return pa - pb;
      const ma = a.minutesToAction ?? Number.POSITIVE_INFINITY;
      const mb = b.minutesToAction ?? Number.POSITIVE_INFINITY;
      if (ma !== mb) return ma - mb;
      return (b.riskScore ?? -1) - (a.riskScore ?? -1);
    })
    .slice(0, 24);

  return {
    station,
    activeView,
    nowIso,
    snapshotAvailable: true,
    snapshotFresh,
    generatedAt: snapshot.generatedAt,
    validUntil: snapshot.validUntil,
    source: snapshot.source,
    missingInputs: snapshot.missingInputs,
    metrics: {
      total: metrics.total,
      actionRequired: metrics.actionRequired,
      atRisk: metrics.atRisk,
      onTrack: metrics.onTrack,
      unknown: metrics.unknown,
      successRatePct:
        metrics.success !== null ? Math.round(metrics.success * 10) / 10 : null,
    },
    transferSuccess: snapshot.transferSuccess
      ? {
          successful: snapshot.transferSuccess.successful,
          eligible: snapshot.transferSuccess.eligible,
          windowStart: snapshot.transferSuccess.windowStart,
          windowEnd: snapshot.transferSuccess.windowEnd,
        }
      : null,
    flights,
    priorityBags,
  };
}

export async function streamCopilotResponse(options: {
  messages: Array<{ role: CopilotRole; content: string }>;
  context: CopilotContextPayload;
  endpoint?: string;
  signal?: AbortSignal;
  onEvent: (event: CopilotStreamEvent) => void;
}): Promise<void> {
  const endpoint = options.endpoint ?? resolveCopilotEndpoint();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: options.messages.slice(-16),
      context: options.context,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    let detail = `Copilot request failed with HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as {
        detail?: string;
        error?: string;
      };
      if (errBody.detail) detail = errBody.detail;
      else if (errBody.error) detail = errBody.error;
    } catch {
      /* keep HTTP status fallback */
    }
    throw new Error(detail);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!response.body) {
    const json = (await response.json()) as {
      content?: string;
      steps?: string[];
    };
    if (Array.isArray(json.steps)) {
      for (const step of json.steps) {
        options.onEvent({ type: "thought_step", step });
      }
    }
    if (json.content) {
      options.onEvent({ type: "text_delta", delta: json.content });
    }
    options.onEvent({ type: "done" });
    return;
  }

  if (contentType.includes("application/json")) {
    const json = (await response.json()) as {
      content?: string;
      steps?: string[];
      mode?: CopilotSourceMode;
      provider?: string;
    };
    if (json.mode) {
      options.onEvent({
        type: "meta",
        mode: json.mode,
        provider: json.provider,
      });
    }
    if (Array.isArray(json.steps)) {
      for (const step of json.steps) {
        options.onEvent({ type: "thought_step", step });
      }
    }
    if (json.content) {
      options.onEvent({ type: "text_delta", delta: json.content });
    }
    options.onEvent({ type: "done" });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;
    const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
    if (!payload || payload === "[DONE]") {
      if (payload === "[DONE]" && !sawDone) {
        sawDone = true;
        options.onEvent({ type: "done" });
      }
      return;
    }
    try {
      const parsed = JSON.parse(payload) as Partial<CopilotStreamEvent>;
      if (
        parsed.type === "meta" ||
        parsed.type === "thought_step" ||
        parsed.type === "text_delta" ||
        parsed.type === "done" ||
        parsed.type === "error"
      ) {
        if (parsed.type === "done") sawDone = true;
        options.onEvent(parsed as CopilotStreamEvent);
        return;
      }
      // Support raw OpenAI-compatible SSE payloads if pointed directly at an LLM backend
      const openAiDelta = (
        parsed as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
          }>;
        }
      ).choices?.[0]?.delta;
      if (openAiDelta?.reasoning_content) {
        options.onEvent({
          type: "thought_step",
          step: openAiDelta.reasoning_content,
        });
      }
      if (openAiDelta?.content) {
        options.onEvent({ type: "text_delta", delta: openAiDelta.content });
      }
    } catch {
      options.onEvent({ type: "text_delta", delta: payload });
    }
  };

  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    buffer += decoder.decode(chunk.value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      processLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const tail = buffer + decoder.decode();
  if (tail.trim()) {
    processLine(tail);
  }
  if (!sawDone) {
    options.onEvent({ type: "done" });
  }
}
