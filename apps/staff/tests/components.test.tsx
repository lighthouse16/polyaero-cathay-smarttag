import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { BaggageInvestigationPanel } from "../src/components/investigation/BaggageInvestigationPanel";
import { SmartTagStatusPanel } from "../src/components/investigation/SmartTagStatusPanel";
import { RiskFactorsList } from "../src/components/investigation/RiskFactorsList";
import { OperationalMetricCard } from "../src/components/transfer/OperationalMetricCard";
import { BaggageRiskTable } from "../src/components/transfer/BaggageRiskTable";
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
  it("renders SmartTag E-paper bezel with status telemetry", () => {
    const html = renderToStaticMarkup(<SmartTagStatusPanel bag={bag} />);
    expect(html).toContain("SmartTag (E-paper)");
    expect(html).toContain("Online");
    expect(html).toContain("98%");
    expect(html).toContain("v3.0");
  });
  it("case retains zero buffer without labeling direct", () => {
    const html = renderToStaticMarkup(
      <BaggageInvestigationPanel
        bag={bag}
        isSyncing={false}
        onRequestAction={() => {}}
        onEvaluateRisk={() => {}}
      />,
    );
    expect(html).toContain("0 min");
    expect(html).not.toContain(">Direct<");
  });
  it("missing buffer is unavailable, not direct", () => {
    const html = renderToStaticMarkup(
      <BaggageInvestigationPanel
        bag={{ ...bag, connection_minutes: undefined }}
        isSyncing={false}
        onRequestAction={() => {}}
        onEvaluateRisk={() => {}}
      />,
    );
    expect(html).toContain("Unavailable");
    expect(html).not.toContain(">Direct<");
  });
  it("omits sparkline when no historical samples supplied", () =>
    expect(
      renderToStaticMarkup(
        <OperationalMetricCard
          title="Tracked"
          value={2}
          sublabel="Snapshot"
          icon={null}
          accentColor="#006564"
        />,
      ),
    ).not.toContain("<svg"));
  it("keeps textual factors qualitative even when text includes percent", () => {
    const html = renderToStaticMarkup(
      <RiskFactorsList bag={{ ...bag, risk_factors: ["Load (90%)"] }} />,
    );
    expect(html).toContain("Load (90%)");
    expect(html).not.toContain("width:90%");
  });
  it("table keeps zero-minute buffer and actionable accessible selection", () => {
    const html = renderToStaticMarkup(
      <BaggageRiskTable
        bags={[bag]}
        selectedTagNumber={bag.tag_number}
        onSelectBag={() => {}}
        externalFlightFilter={null}
        onClearExternalFlight={() => {}}
      />,
    );
    expect(html).toContain("0 min");
    expect(html).toContain("Select 0160892014");
    expect(html).toContain("Connection Risk (1)");
    expect(html).toContain("Flight (In");
  });
});
