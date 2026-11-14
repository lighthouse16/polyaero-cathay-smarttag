import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("Responsive Layout Integrity (Zero Waste & Zero Overflow)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const pageFile = path.join(rootDir, "src/app/page.tsx");
  const globalsFile = path.join(rootDir, "src/app/globals.css");
  const tableCssFile = path.join(
    rootDir,
    "src/components/transfer/BaggageRiskTable.module.css",
  );
  const sidebarFile = path.join(
    rootDir,
    "src/components/layout/OperationsSidebar.tsx",
  );
  const metricCardFile = path.join(
    rootDir,
    "src/components/transfer/OperationalMetricCard.tsx",
  );

  it("removes hardcoded 1520px max-width from main container to prevent dead side-margins on wide screens", () => {
    const pageSrc = fs.readFileSync(pageFile, "utf-8");
    expect(pageSrc).not.toContain('maxWidth: "1520px"');
    expect(pageSrc).toContain('width: "100%"');
  });

  it("uses ergonomic bounded grid columns for desktop and stacked on < 1180px", () => {
    const pageSrc = fs.readFileSync(pageFile, "utf-8");
    expect(pageSrc).toContain("minmax(0, 1fr) clamp(380px, 26vw, 440px)");
    expect(pageSrc).toContain("@media (max-width: 1180px)");
  });

  it("uses auto-fit fluid columns for KPI cards to prevent text clipping and overlapping on medium viewports", () => {
    const pageSrc = fs.readFileSync(pageFile, "utf-8");
    expect(pageSrc).toContain(
      "repeat(auto-fit, minmax(min(100%, 205px), 1fr))",
    );
  });

  it("defines dynamic ops-header-height tokens for seamless mobile header/sidebar alignment", () => {
    const css = fs.readFileSync(globalsFile, "utf-8");
    expect(css).toContain("--ops-header-height: 82px");
    expect(css).toContain("--ops-header-height: 64px");

    const sidebarSrc = fs.readFileSync(sidebarFile, "utf-8");
    expect(sidebarSrc).toContain("var(--ops-header-height, 82px)");
  });

  it("scales table height dynamically to eliminate empty space on tall monitors and overflow on laptops", () => {
    const tableCss = fs.readFileSync(tableCssFile, "utf-8");
    expect(tableCss).toContain("max-height: clamp(380px, 46vh, 720px)");
    expect(tableCss).toContain("-webkit-overflow-scrolling: touch");
  });

  it("uses clamp typography for metric card value so large numbers never clip on narrow cards", () => {
    const cardSrc = fs.readFileSync(metricCardFile, "utf-8");
    expect(cardSrc).toContain("clamp(22px, 2.1vw, 30px)");
  });
});
