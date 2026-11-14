import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as copilotPost } from "../src/app/api/v1/copilot/chat/route";
import { CopilotMessageBody } from "../src/components/copilot/CopilotMessageBody";
import { OperationsCopilotDrawer } from "../src/components/copilot/OperationsCopilotDrawer";
import { ThoughtLine } from "../src/components/copilot/ThoughtLine";
import {
  buildSanitizedCopilotContext,
  streamCopilotResponse,
  type CopilotStreamEvent,
} from "../src/lib/copilot";
import type { TransferControlSnapshot } from "../src/lib/types";

function makeTestSnapshot(now: Date): TransferControlSnapshot {
  const nowMs = now.getTime();
  const observedAt = new Date(nowMs - 120_000).toISOString();
  const validUntil = new Date(nowMs + 10 * 60_000).toISOString();
  const prov = (recordId: string) => ({
    system: "test-manifest",
    recordId,
    observedAt,
    validUntil,
  });

  return {
    availability: "available",
    generatedAt: new Date(nowMs - 30_000).toISOString(),
    validUntil,
    source: "test-transfer-feed",
    missingInputs: [],
    bags: [
      {
        id: "bag-1",
        tag_number: "0160892014",
        tag_code: "TAG-0160892014",
        flight_number: "CX255",
        departure_airport: "HKG",
        arrival_airport: "LHR",
        booking_reference: "PNR999",
        passenger_name: "SENSITIVE/PASSENGER",
        tier_status: "Diamond",
        cabin_class: "Business",
        seat_number: "12A",
        weight_kg: 21,
        status: "IN_TRANSFER",
        last_known_location: "T1-BHS-04",
        carousel_assigned: "",
        is_rush_bag: true,
        risk_score: 0.88,
        risk_level: "HIGH",
        recommended_action: "",
        eink_banner: "",
        updated_at: new Date(nowMs - 60_000).toISOString(),
        events: [
          {
            id: "ev-1",
            event_type: "TRANSFER_SORT",
            timestamp: new Date(nowMs - 90_000).toISOString(),
            location_code: "T1-BHS-04",
            station_name: "HKG T1",
            scanner_type: "BHS",
            provenance: prov("ev-1"),
          },
        ],
      },
      {
        id: "bag-2",
        tag_number: "0160892099",
        tag_code: "TAG-0160892099",
        flight_number: "CX777",
        departure_airport: "HKG",
        arrival_airport: "CGK",
        booking_reference: "PNR777",
        passenger_name: "OTHER/PERSON",
        tier_status: "Green",
        cabin_class: "Economy",
        seat_number: "44C",
        weight_kg: 18,
        status: "LOADED",
        last_known_location: "GATE-24",
        carousel_assigned: "",
        is_rush_bag: false,
        risk_score: 0.14,
        risk_level: "LOW",
        recommended_action: "",
        eink_banner: "",
        updated_at: new Date(nowMs - 60_000).toISOString(),
        events: [],
      },
    ],
    legs: [
      {
        id: "leg-in-1",
        flightNumber: "CX505",
        operatingDate: "2026-11-15",
        origin: "NRT",
        destination: "HKG",
        scheduledDepartureAt: new Date(nowMs - 4 * 3600_000).toISOString(),
        scheduledArrivalAt: new Date(nowMs - 15 * 60_000).toISOString(),
        estimatedDepartureAt: null,
        estimatedArrivalAt: null,
        actualArrivalAt: new Date(nowMs - 5 * 60_000).toISOString(),
        provenance: prov("leg-in-1"),
      },
      {
        id: "leg-cx255",
        flightNumber: "CX255",
        operatingDate: "2026-11-15",
        origin: "HKG",
        destination: "LHR",
        scheduledDepartureAt: new Date(nowMs + 45 * 60_000).toISOString(),
        scheduledArrivalAt: new Date(nowMs + 12 * 3600_000).toISOString(),
        estimatedDepartureAt: null,
        estimatedArrivalAt: null,
        actualArrivalAt: null,
        provenance: prov("leg-cx255"),
      },
      {
        id: "leg-cx777",
        flightNumber: "CX777",
        operatingDate: "2026-11-15",
        origin: "HKG",
        destination: "CGK",
        scheduledDepartureAt: new Date(nowMs + 110 * 60_000).toISOString(),
        scheduledArrivalAt: new Date(nowMs + 6 * 3600_000).toISOString(),
        estimatedDepartureAt: null,
        estimatedArrivalAt: null,
        actualArrivalAt: null,
        provenance: prov("leg-cx777"),
      },
    ],
    connections: [
      {
        id: "conn-1",
        bagTag: "0160892014",
        inboundLegId: "leg-in-1",
        outboundLegId: "leg-cx255",
        status: "pending",
        attention: "action_required",
        deadline: {
          at: new Date(nowMs + 20 * 60_000).toISOString(),
          kind: "latest_intervention",
          provenance: prov("dl-1"),
        },
        provenance: prov("conn-1"),
      },
      {
        id: "conn-2",
        bagTag: "0160892099",
        inboundLegId: "leg-in-1",
        outboundLegId: "leg-cx777",
        status: "pending",
        attention: "on_track",
        deadline: {
          at: new Date(nowMs + 85 * 60_000).toISOString(),
          kind: "latest_intervention",
          provenance: prov("dl-2"),
        },
        provenance: prov("conn-2"),
      },
    ],
    flightRisks: [
      {
        flightLegId: "leg-cx255",
        status: "assessed",
        score: 86,
        modelVersion: "xgb-transfer-v2",
        assessedAt: observedAt,
        validUntil,
        evidence: [prov("fr-1")],
        missingInputs: [],
      },
      {
        flightLegId: "leg-cx777",
        status: "assessed",
        score: 18,
        modelVersion: "xgb-transfer-v2",
        assessedAt: observedAt,
        validUntil,
        evidence: [prov("fr-2")],
        missingInputs: [],
      },
    ],
    bagRisks: [],
    transferSuccess: {
      successful: 94,
      eligible: 100,
      windowStart: new Date(nowMs - 6 * 3600_000).toISOString(),
      windowEnd: new Date(nowMs - 60_000).toISOString(),
      provenance: prov("ts-1"),
    },
  };
}

describe("ThoughtLine", () => {
  it("renders working streaming state with live trace and timer", () => {
    const html = renderToStaticMarkup(
      <ThoughtLine
        working
        steps={["Reading the question", "Drafting an answer"]}
        label="Thinking…"
        doneLabel="Thought for"
      />,
    );
    expect(html).toContain("Thinking…");
    expect(html).toContain("0.0s");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Reading the question");
    expect(html).toContain("Drafting an answer");
    expect(html).toContain("thought-line__pulse");
    expect(html).toContain('role="status"');
  });

  it("folds reasoning steps on settle and shows elapsed duration", () => {
    const html = renderToStaticMarkup(
      <ThoughtLine
        working={false}
        elapsed={2.4}
        steps={["Step one", "Step two"]}
        doneLabel="Thought for"
        collapseOnSettle
      />,
    );
    expect(html).toContain("Thought for");
    expect(html).toContain("2.4s");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Thought for 2.4 seconds");
    expect(html).not.toContain("thought-line__pulse");
  });

  it("supports showTimer={false} and collapsible={false}", () => {
    const html = renderToStaticMarkup(
      <ThoughtLine
        working={false}
        showTimer={false}
        collapsible={false}
        steps={["Checked metrics"]}
      />,
    );
    expect(html).toContain("Done thinking");
    expect(html).not.toContain("thought-line__timer");
    expect(html).not.toContain("<button");
  });
});

describe("OperationsCopilotDrawer", () => {
  it("renders welcome state aligned with Cathay design and starter prompts", () => {
    const now = new Date("2026-11-15T01:00:00Z");
    const html = renderToStaticMarkup(
      <OperationsCopilotDrawer
        open
        onOpenChange={() => {}}
        snapshot={makeTestSnapshot(now)}
        now={now}
        activeView="transfer-control"
      />,
    );
    expect(html).toContain("Operations Copilot");
    expect(html).not.toContain("Beta");
    expect(html).toContain("AI assistant for baggage transfer");
    expect(html).toContain("Hi Dang, how can I help you with transfer operations?");
    expect(html).toContain("Try asking");
    expect(html).toContain("Why is CX255 at higher risk than CX777?");
    expect(html).toContain("Which bags should we prioritise now?");
    expect(html).toContain("Summarise today&#x27;s recovery performance.");
    expect(html).toContain("Any upcoming transfer risks in the next hour?");
    expect(html).toContain("Ask anything");
    expect(html).not.toContain("API Ready · Preview");
    expect(html).not.toContain("Enter to send");
    // Send button hidden when draft is empty
    expect(html).not.toContain('aria-label="Send message"');
    // Plus and mic buttons present
    expect(html).toContain('aria-label="Add context"');
    expect(html).toContain('aria-label="Voice input"');
  });

  it("renders interactive flight and bag entity buttons inside assistant messages", () => {
    const html = renderToStaticMarkup(
      <CopilotMessageBody
        content="- Prioritize bag **0160892014** connecting onto **CX255**."
        knownBagTags={new Set(["0160892014"])}
        knownFlightLegByNumber={new Map([["CX255", "leg-cx255"]])}
        onSelectBag={() => {}}
        onSelectFlight={() => {}}
      />,
    );
    expect(html).toContain('title="Inspect bag 0160892014"');
    expect(html).toContain('title="Inspect flight CX255"');
  });

  it("keeps copilot stylesheets free of forbidden pastel/glassmorphism styles", () => {
    const css =
      readFileSync(
        path.resolve(__dirname, "../src/components/copilot/ThoughtLine.css"),
        "utf8",
      ) +
      readFileSync(
        path.resolve(
          __dirname,
          "../src/components/copilot/OperationsCopilot.module.css",
        ),
        "utf8",
      );
    for (const forbidden of [
      "#005D63",
      "#F3F1EC",
      "#EFEEE9",
      "glassmorphism",
      "radial-gradient",
      "backdrop-filter",
    ]) {
      expect(css).not.toContain(forbidden);
    }
  });
});

describe("Copilot Context & API Route", () => {
  beforeEach(() => {
    for (const name of ["COPILOT_API_URL", "OLLAMA_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "LLM_API_KEY"]) {
      vi.stubEnv(name, "");
    }
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects malformed operational context before streaming or provider calls", async () => {
    const context = buildSanitizedCopilotContext({ snapshot: null, now: new Date(), activeView: "transfer-control" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const invalid of [
      { snapshotAvailable: true },
      { ...context, metrics: null },
      { ...context, priorityBags: [{}] },
      { ...context, flights: "not an array" },
      { ...context, snapshotFresh: "true" },
      { ...context, station: "X".repeat(257) },
      { ...context, missingInputs: [42] },
    ]) {
      const response = await copilotPost(new Request("http://localhost/api/v1/copilot/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "Status?" }], context: invalid }),
      }));
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allowlists context fields server-side and keeps context out of system instructions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const context = buildSanitizedCopilotContext({
      snapshot: makeTestSnapshot(new Date("2026-11-15T01:00:00Z")),
      now: new Date("2026-11-15T01:00:00Z"),
      activeView: "transfer-control",
    });
    const contaminated = {
      ...context,
      passenger_name: "SENSITIVE/PASSENGER",
      metrics: { ...context.metrics, booking_reference: "SECRET-PNR" },
      flights: context.flights.map(f => ({ ...f, seat_number: "SECRET-SEAT" })),
      priorityBags: context.priorityBags.map(b => ({ ...b, passenger_name: "SECRET-NAME" })),
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', {
      headers: { "Content-Type": "text/event-stream" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await copilotPost(new Request("http://localhost/api/v1/copilot/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Status?" }], context: contaminated }),
    }));
    await response.text();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const serialized = JSON.stringify(sent);
    for (const secret of ["SENSITIVE/PASSENGER", "SECRET-PNR", "SECRET-SEAT", "SECRET-NAME"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(sent.messages.filter((m: { role: string }) => m.role === "system")).toHaveLength(1);
    expect(sent.messages.find((m: { content: string }) => m.content.includes("Operational HKG Transfer Context")).role).toBe("user");
    expect(serialized).toContain("CX255");
  });

  it("strips passenger PII and booking references from LLM context payloads", () => {
    const now = new Date("2026-11-15T01:00:00Z");
    const ctx = buildSanitizedCopilotContext({
      snapshot: makeTestSnapshot(now),
      now,
      activeView: "transfer-control",
    });
    const serialized = JSON.stringify(ctx);
    expect(serialized).toContain("CX255");
    expect(serialized).toContain("0160892014");
    expect(serialized).not.toContain("SENSITIVE/PASSENGER");
    expect(serialized).not.toContain("OTHER/PERSON");
    expect(serialized).not.toContain("PNR999");
    expect(serialized).not.toContain("PNR777");
    expect(serialized).not.toContain("12A");
    expect(serialized).not.toContain("44C");
  });

  it("validates chat payloads and streams grounded NDJSON thought + answer events", async () => {
    const badReq = new Request("http://localhost/api/v1/copilot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    const badRes = await copilotPost(badReq);
    expect(badRes.status).toBe(400);

    const now = new Date("2026-11-15T01:00:00Z");
    const context = buildSanitizedCopilotContext({
      snapshot: makeTestSnapshot(now),
      now,
      activeView: "transfer-control",
    });

    const okReq = new Request("http://localhost/api/v1/copilot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Why is CX255 at higher risk than CX777?",
          },
        ],
        context,
      }),
    });

    const prevCopilotUrl = process.env.COPILOT_API_URL;
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevOpenAi = process.env.OPENAI_API_KEY;
    const prevLlmKey = process.env.LLM_API_KEY;
    delete process.env.COPILOT_API_URL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;

    try {
      const okRes = await copilotPost(okReq);
      expect(okRes.status).toBe(200);
      const raw = await okRes.text();
      const lines = raw
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as CopilotStreamEvent);
      expect(lines.some((e) => e.type === "meta")).toBe(true);
      expect(lines.some((e) => e.type === "thought_step")).toBe(true);
      expect(lines.some((e) => e.type === "text_delta")).toBe(true);
      expect(lines[lines.length - 1]?.type).toBe("done");
      const fullText = lines
        .filter((e): e is Extract<CopilotStreamEvent, { type: "text_delta" }> => e.type === "text_delta")
        .map((e) => e.delta)
        .join("");
      expect(fullText).toContain("CX255");
      expect(fullText).toContain("CX777");
      expect(fullText).toContain("0160892014");
    } finally {
      if (prevCopilotUrl !== undefined) process.env.COPILOT_API_URL = prevCopilotUrl;
      if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
      if (prevOpenAi !== undefined) process.env.OPENAI_API_KEY = prevOpenAi;
      if (prevLlmKey !== undefined) process.env.LLM_API_KEY = prevLlmKey;
    }
  });

  it("parses OpenAI-compatible SSE streams in streamCopilotResponse", async () => {
    const encoder = new TextEncoder();
    const mockFetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"reasoning_content":"Checking flight buffers"}}]}\n\n',
              ),
            );
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"Focus on CX255 first."}}]}\n\n',
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;
    try {
      const events: CopilotStreamEvent[] = [];
      await streamCopilotResponse({
        messages: [{ role: "user", content: "Status?" }],
        context: buildSanitizedCopilotContext({
          snapshot: null,
          now: new Date(),
          activeView: "transfer-control",
        }),
        onEvent: (ev) => events.push(ev),
      });
      expect(events).toEqual([
        { type: "thought_step", step: "Checking flight buffers" },
        { type: "text_delta", delta: "Focus on CX255 first." },
        { type: "done" },
      ]);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
