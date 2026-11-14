import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationsHeader } from "../src/components/layout/OperationsHeader";
const root = path.resolve(__dirname, "..", "src");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
describe("frozen Cathay operational design", () => {
  it("keeps compact header free of visible operations title and command chip", () => {
    const html = renderToStaticMarkup(React.createElement(OperationsHeader, { station: "HKG · T1", activeView: "transfer-control", onSelectView: () => {}, onOpenSearch: () => {}, actionRequiredCount: null, onOpenAlerts: () => {} }));
    expect(html).not.toContain(">Ground Operations<");
    expect(html).not.toContain("<kbd");
    expect(html).not.toContain("Ctrl/Cmd+K");
    expect(html).toContain('aria-keyshortcuts="Control+K Meta+K"');
    expect(html).toContain('aria-label="Search baggage by bag tag or flight"');
    expect(read("app/page.tsx")).toContain('event.key.toLowerCase() !== "k"');
  });
  it("uses supplied primary roles without borrowing logo-only teal", () => {
    const css = read("app/globals.css") + read("components/layout/OperationsHeader.module.css") + read("components/investigation/BaggageInvestigationPanel.module.css");
    expect(css).toContain("--brand-primary-darkcyan-default: #367878");
    expect(css).toContain("--brand-primary-darkcyan-active: #163230");
    expect(css).toContain("--brand-primary-darkcyan-light: #F1F4F1");
    expect(css).toContain("--brand-primary-darkgreen-active: #002527");
    expect(css).toContain("--brand-secondary-gold-default: #886521");
    expect(css).toContain("width: 108px");
    expect(css).toContain("border-bottom: 2px solid var(--brand-primary-darkcyan-active)");
    expect(css).toContain("outline: 2px solid var(--brand-primary-darkcyan-default)");
    expect(css.toUpperCase()).not.toContain("#005D63");
  });
  it("uses local Cathay type and required neutral text tokens", () => {
    const css = read("app/globals.css");
    expect(css).toContain('font-family: "Cathay Sans EN"');
    expect(css).toContain("--text-primary: #2D2D2D");
    expect(css).toContain("--text-secondary: #66686A");
    expect(css).toContain("border-radius: 14px");
    expect(css).toContain("--workspace-bg: #F9F9F9");
    expect(read("app/layout.tsx")).not.toContain("next/font/google");
  });
  it("header white, three stable nav labels and real official logo", () => {
    const header = read("components/layout/OperationsHeader.tsx");
    const css = read("components/layout/OperationsHeader.module.css");
    for (const label of ["Transfer Control", "Baggage Trace", "Performance"]) expect(header).toContain(label);
    expect(header).toContain("/cathay/cathay-en.svg");
    expect(css.toLowerCase()).toContain("#ffffff");
    expect(header).not.toContain("STF-8821");
    expect(header).not.toContain("Reset Demo");
  });
  it("new operational surfaces use no pastel/gradient/icon-bubble styling", () => {
    const css = read("app/globals.css") + read("components/investigation/BaggageInvestigationPanel.module.css");
    for (const forbidden of ["#F3F1EC", "#EFEEE9", "glassmorphism", "radial-gradient", "backdrop-filter"]) expect(css).not.toContain(forbidden);
    const workbench = read("components/transfer/FlightWorkbench.tsx");
    expect(workbench).not.toMatch(/Approve Recovery|Dispatch|Allocate team|Recommended action|stepper/i);
  });
});
