import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IncomingFlightQueue, formatTimeToAct } from "../src/components/transfer/IncomingFlightQueue";
import { ConnectionBagTable } from "../src/components/transfer/ConnectionBagTable";
import type { TransferControlSnapshot } from "../src/lib/types";
import { transferFixture, fixtureNow } from "./fixtures/transferFixture";
import { aggregateInboundFlights, validateTransferSnapshot } from "../src/lib/transferControl";
const snapshot: TransferControlSnapshot = { availability: "unavailable", generatedAt: "2026-11-14T08:00:00Z", validUntil: null, source: "Unavailable", missingInputs: [], bags: [], legs: [], connections: [], flightRisks: [], bagRisks: [], transferSuccess: null };
describe("flight-first truthful UI", () => {
  it("failed poll masks last snapshot score/deadline and disables operational filters", () => {
    const flights = aggregateInboundFlights(transferFixture(), fixtureNow);
    const html = renderToStaticMarkup(<IncomingFlightQueue flights={flights} now={fixtureNow} onSelect={() => {}} unavailable={true} loading={false} actionOnly={true} />);
    expect(html).not.toContain('class="score-cell">92');
    expect(html).not.toContain("15 min");
    expect(html).toContain("CX616");
    expect(html).toContain('disabled="" aria-label="Sort incoming flights"');
  });
  it("pair renders full tags and independent bag assessment, never legacy fields", () => {
    const data = validateTransferSnapshot(transferFixture());
    const html = renderToStaticMarkup(<ConnectionBagTable snapshot={data} inboundId="in-14" outboundId="out-nrt" selectedTag="0160892014" now={fixtureNow} onSelect={() => {}} />);
    expect(html).toContain("0160892014");
    expect(html).toContain('class="score-cell">82');
    expect(html).toContain("28 bags");
    expect(html).not.toContain('class="score-cell">95');
    expect(html).not.toContain("PRIVATE");
    const stale = renderToStaticMarkup(<ConnectionBagTable snapshot={data} inboundId="in-14" outboundId="out-nrt" selectedTag="0160892014" now={fixtureNow} onSelect={() => {}} stale />);
    expect(stale).not.toContain('class="score-cell">82');
    expect(stale).not.toContain("15 min");
  });
  it("missing deadline renders unavailable and overdue stays negative", () => {
    expect(formatTimeToAct(null)).toBe("—");
    expect(formatTimeToAct(-2.5)).toContain("overdue");
    expect(formatTimeToAct(0)).toBe("0 min");
  });
  it("incoming table has independent flight risk and unavailable state", () => {
    const html = renderToStaticMarkup(<IncomingFlightQueue flights={[]} now={new Date(snapshot.generatedAt)} onSelect={() => {}} unavailable={true} loading={false} />);
    expect(html).toContain("Flight risk /100");
    expect(html).toContain("Incoming flight associations unavailable");
    expect(html).not.toContain("Passenger");
  });
  it("pair bag list excludes passenger, PNR, legacy risk and buffer", () => {
    const html = renderToStaticMarkup(<ConnectionBagTable snapshot={snapshot} inboundId="in" outboundId="out" selectedTag={null} now={new Date(snapshot.generatedAt)} onSelect={() => {}} />);
    expect(html).toContain("Bag ID");
    expect(html).toContain("Time to Act");
    expect(html).not.toContain("PNR");
    expect(html).not.toContain("Passenger");
  });
});
