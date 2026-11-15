import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OutboundFlightQueue, formatTimeToAct } from "../src/components/transfer/OutboundFlightQueue";
import { FlightWorkbench } from "../src/components/transfer/FlightWorkbench";
import { ConnectionBagTable } from "../src/components/transfer/ConnectionBagTable";
import { formatLiveTimeToAct, getRiskTier, stationClockSeconds } from "../src/components/transfer/WorkbenchMetrics";
import type { TransferControlSnapshot } from "../src/lib/types";
import { transferFixture, fixtureNow } from "./fixtures/transferFixture";
import { aggregateOutboundFlights, validateTransferSnapshot } from "../src/lib/transferControl";
const snapshot: TransferControlSnapshot = { availability: "unavailable", generatedAt: "2026-11-14T08:00:00Z", validUntil: null, source: "Unavailable", missingInputs: [], bags: [], legs: [], connections: [], flightRisks: [], bagRisks: [], transferSuccess: null };
describe("flight-first truthful UI", () => {
  it("failed poll masks last snapshot score/deadline and disables operational filters", () => {
    const flights = aggregateOutboundFlights(transferFixture(), fixtureNow);
    const html = renderToStaticMarkup(<OutboundFlightQueue flights={flights} now={fixtureNow} onSelect={() => {}} unavailable={true} loading={false} actionOnly={true} />);
    expect(html).not.toContain('class="score-cell">92');
    expect(html).not.toContain("15 min");
    expect(html).toContain("CX255");
    expect(html).toContain("HKG");
    expect(html).toContain("NRT");
    expect(html).toContain('disabled="" aria-label="Sort outbound flights"');
  });
  it("pair renders full tags and independent bag assessment, never legacy fields", () => {
    const data = validateTransferSnapshot(transferFixture());
    const html = renderToStaticMarkup(<ConnectionBagTable snapshot={data} inboundId="in-14" outboundId="out-nrt" selectedTag="0160892014" now={fixtureNow} onSelect={() => {}} />);
    expect(html).toContain("0160892014");
    expect(html).toContain('class="score-cell">82');
    expect(html).toContain("15 bags");
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
  it("outbound queue has independent flight risk and unavailable state", () => {
    const html = renderToStaticMarkup(<OutboundFlightQueue flights={[]} now={new Date(snapshot.generatedAt)} onSelect={() => {}} unavailable={true} loading={false} />);
    expect(html).toContain("Flight risk /100");
    expect(html).toContain("Outbound flight associations unavailable");
    expect(html).not.toContain("Passenger");
  });
  it("workbench opens outbound flight first and drills into incoming feeder flights and bags", () => {
    const data = validateTransferSnapshot(transferFixture());
    const feedersHtml = renderToStaticMarkup(
      <FlightWorkbench
        snapshot={data}
        selection={{ outbound: "out-nrt", inbound: null, bag: null }}
        now={fixtureNow}
        stale={false}
        onSelection={() => {}}
      />,
    );
    expect(feedersHtml).toContain("Outbound flight");
    expect(feedersHtml).toContain("CX255");
    expect(feedersHtml).toContain("Incoming feeder flights");
    expect(feedersHtml).toContain("CX616");
    expect(feedersHtml).toContain("CX714");

    const bagHtml = renderToStaticMarkup(
      <FlightWorkbench
        snapshot={data}
        selection={{ outbound: "out-nrt", inbound: "in-14", bag: "0160892014" }}
        now={fixtureNow}
        stale={false}
        onSelection={() => {}}
      />,
    );
    expect(bagHtml).toContain("CX616 (BKK)");
    expect(bagHtml).toContain("CX255 ← CX616");
    expect(bagHtml).toContain("0160892014");
  });
  it("pair bag list excludes passenger, PNR, legacy risk and buffer", () => {
    const html = renderToStaticMarkup(<ConnectionBagTable snapshot={snapshot} inboundId="in" outboundId="out" selectedTag={null} now={new Date(snapshot.generatedAt)} onSelect={() => {}} />);
    expect(html).toContain("Bag ID");
    expect(html).toContain("Time to Act");
    expect(html).not.toContain("PNR");
    expect(html).not.toContain("Passenger");
  });
  it("formats live second-precision countdown/overdue readouts and workbench telemetry", () => {
    expect(formatLiveTimeToAct(null)).toMatchObject({ text: "—", badge: null, urgency: "none", meterPct: 0 });
    expect(formatLiveTimeToAct(14 * 60_000 + 5_000)).toMatchObject({ text: "14m 05s", badge: "urgent", urgency: "urgent" });
    expect(formatLiveTimeToAct(65 * 60_000 + 2_000)).toMatchObject({ text: "1h 05m 02s", badge: "remaining", urgency: "active" });
    expect(formatLiveTimeToAct(-10 * 60_000 - 24_000)).toMatchObject({ text: "10m 24s", badge: "overdue", urgency: "overdue", meterPct: 100 });
    expect(getRiskTier(92)).toBe("critical");
    expect(stationClockSeconds("2026-11-14T08:15:30Z")).toBe("16:15:30");

    const data = validateTransferSnapshot(transferFixture());
    const html = renderToStaticMarkup(
      <FlightWorkbench
        snapshot={data}
        selection={{ outbound: "out-nrt", inbound: null, bag: null }}
        now={fixtureNow}
        stale={false}
        onSelection={() => {}}
      />,
    );
    expect(html).toContain("wb-metrics");
    expect(html).toContain("wb-stacked-track");
    expect(html).toContain("Cutoff ");
    expect(html).toContain("15m 00s");
  });
});
