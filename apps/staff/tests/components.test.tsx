import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { BaggageInvestigationPanel } from "../src/components/investigation/BaggageInvestigationPanel";
import { SmartTagStatusPanel } from "../src/components/investigation/SmartTagStatusPanel";
import { RiskFactorsList } from "../src/components/investigation/RiskFactorsList";
import { OperationalMetricCard } from "../src/components/transfer/OperationalMetricCard";
import type { LiveBag } from "../src/lib/types";
const bag: LiveBag = {
  id: "b",
  tag_number: "0160892014",
  tag_code: "04:AB",
  booking_reference: "CX4M1P",
  passenger_name: "WONG/VICTOR",
  tier_status: "GOLD",
  cabin_class: "BUSINESS",
  flight_number: "CX255",
  departure_airport: "HKG",
  arrival_airport: "NRT",
  seat_number: "14K",
  weight_kg: 28.5,
  connection_minutes: 0,
  status: "MISROUTED",
  last_known_location: "HKG",
  carousel_assigned: "2",
  is_rush_bag: true,
  risk_score: 82,
  risk_level: "HIGH_PRIORITY",
  recommended_action: "Review",
  eink_banner: "PRIORITY",
  updated_at: "2026-11-14T07:30:00Z",
  events: [],
};
describe("truthful component output", () => {
  it("SmartTag records never become physical telemetry", () => {
    const html = renderToStaticMarkup(<SmartTagStatusPanel bag={bag} />);
    expect(html).toContain("Hardware confirmation unavailable");
    for (const fake of ["Online", "98%", "v3.0", "14:32"]) expect(html).not.toContain(fake);
  });
  it("case uses separate assessed risk and real deadline, not connection buffer", () => {
    const html = renderToStaticMarkup(<BaggageInvestigationPanel bag={bag} bagRisk={null} timeToAct={null} connectionLabel="CX616 / CX255" onClose={() => {}} />);
    expect(html).toContain(bag.tag_number);
    expect(html).toContain("Close baggage case");
    expect(html).not.toContain("0 min");
    expect(html).not.toContain("WONG");
    expect(html).not.toContain("CX4M1P");
    expect(html).not.toContain("Recommended action");
    expect(html).not.toContain("<dialog");
    expect(html).toMatch(/data-testid="llm-region"[^>]*><\/div>/);
  });
  it("case retains genuine zero deadline and distinct score", () => {
    const html = renderToStaticMarkup(<BaggageInvestigationPanel bag={bag} bagRisk={37} timeToAct={0} connectionLabel="CX616 / CX255" />);
    expect(html).toContain("0 min");
    expect(html).toContain("37");
    expect(html).not.toContain("82");
    expect(html).toContain('role="tablist"');
    for (const tab of ["Overview", "Journey", "SmartTag", "History"]) expect(html).toContain(tab);
  });
  it("omits sparkline without genuine history", () => expect(renderToStaticMarkup(<OperationalMetricCard title="Tracked" value={2} sublabel="Snapshot" icon={null} accentColor="#2D2D2D" />)).not.toContain("<svg"));
  it("keeps textual factors qualitative", () => {
    const html = renderToStaticMarkup(<RiskFactorsList bag={{ ...bag, risk_factors: ["Load (90%)"] }} />);
    expect(html).toContain("Load (90%)");
    expect(html).not.toContain("width:90%");
  });
});
