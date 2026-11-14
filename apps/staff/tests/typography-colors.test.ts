import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
const root = path.resolve(__dirname, "..", "src");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
describe("frozen Cathay operational design", () => {
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
