import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
const root = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, "src", file), "utf8");
describe("responsive flight workbench structure", () => {
  it("one native dialog progresses with no sidebar or stepper", () => {
    const page = read("app/page.tsx");
    const workbench = read("components/transfer/FlightWorkbench.tsx");
    expect(page).not.toContain("OperationsSidebar");
    expect(page).not.toContain("FlightTransferTimeline");
    expect(workbench.match(/<dialog\b/g)).toHaveLength(1);
    expect(workbench).toContain("dialog.showModal()");
    expect(workbench).toContain('onSelection({ type: "back" })');
    expect(workbench).toContain("if (trigger) trigger.focus()");
    expect(workbench).toContain('inert={compact && !!selection.bag}');
    expect(workbench).toContain('data-workbench-search');
  });
  it("header tokens match same desktop/mobile navigation geometry", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--ops-header-height: 82px");
    expect(css).toContain("--ops-header-height: 112px");
    expect(css).toContain("height: calc(100dvh - var(--ops-header-height)");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });
  it("three panes scroll independently and compact inspector stays inside same modal", () => {
    const css = read("app/globals.css");
    expect(css).toContain(".workbench-panes.has-inspector");
    expect(css).toContain(".has-inspector .inspector-pane { position: absolute");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("@media (max-width: 600px)");
    expect(css).toContain("-webkit-overflow-scrolling: touch");
    expect(css).toContain("min-height: 0");
  });
  it("polling never dispatches selection or replaces filters", () => {
    const page = read("app/page.tsx");
    const fetch = page.slice(page.indexOf("const fetchSnapshot"), page.indexOf("useEffect(() =>"));
    expect(fetch).toContain("setSnapshot(next)");
    expect(fetch).not.toContain("select(");
    expect(fetch).not.toContain("setView(");
    expect(page).not.toContain("/baggage");
    expect(page).toContain('useReducer(transferSelection, emptySelection)');
  });
});
