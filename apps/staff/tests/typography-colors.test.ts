import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("Strict Black and White Typography Rules", () => {
  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");

  function getAllSourceFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getAllSourceFiles(fullPath));
      } else if (
        file.endsWith(".tsx") ||
        (file.endsWith(".ts") && !file.endsWith(".d.ts")) ||
        file.endsWith(".css")
      ) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it("ensures globals.css text variables are strictly black #000000", () => {
    const css = fs.readFileSync(path.join(srcDir, "app/globals.css"), "utf-8");
    expect(css).toContain("--text-primary: #000000;");
    expect(css).toContain("--text-secondary: #000000;");
    expect(css).toContain("--text-muted: #000000;");
    expect(css).toContain("--risk-high-text: #000000;");
    expect(css).toContain("--risk-med-text: #000000;");
    expect(css).toContain("--risk-low-text: #000000;");
  });

  it("ensures BaggageRiskTable CSS status and risk pills use strictly #000000 or #ffffff", () => {
    const css = fs.readFileSync(
      path.join(srcDir, "components/transfer/BaggageRiskTable.module.css"),
      "utf-8",
    );
    // Critical risk pill uses white on dark red background
    expect(css).toMatch(/\.risk-critical\s*\{[^}]*color:\s*#ffffff;/i);
    // Other pills use black #000000
    expect(css).toMatch(/\.risk-high\s*\{[^}]*color:\s*#000000;/i);
    expect(css).toMatch(/\.risk-medium\s*\{[^}]*color:\s*#000000;/i);
    expect(css).toMatch(/\.risk-low\s*\{[^}]*color:\s*#000000;/i);
    expect(css).toMatch(/\.status-exception\s*\{[^}]*color:\s*#000000;/i);
    expect(css).toMatch(/\.status-transfer\s*\{[^}]*color:\s*#000000;/i);
    expect(css).toMatch(/\.status-ok\s*\{[^}]*color:\s*#000000;/i);
  });

  it("ensures all text color declarations across components use strictly black or white", () => {
    const files = getAllSourceFiles(srcDir);
    const allowed = new Set([
      "#000000",
      "#000",
      "black",
      "#ffffff",
      "#fff",
      "white",
      "inherit",
      "transparent",
      "currentcolor",
    ]);

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of files) {
      if (file.includes("icons")) continue;

      const relativePath = path.relative(rootDir, file);
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // Skip comments or background-color / border-color lines
        if (line.includes("background") || line.includes("border")) return;

        // Match color: "#..." or color: #...
        const colorRegex = /\bcolor\s*:\s*["']?([^"',;}\n]+)["']?/gi;
        let m: RegExpExecArray | null;
        while ((m = colorRegex.exec(line)) !== null) {
          const raw = m[1].trim().toLowerCase();
          // Allow CSS variables
          if (raw.startsWith("var(")) continue;
          // Allow white rgba on dark surfaces
          if (raw.startsWith("rgba(255, 255, 255,") || raw.startsWith("rgba(255,255,255,")) continue;
          // Allow black rgba
          if (raw.startsWith("rgba(0, 0, 0,") || raw.startsWith("rgba(0,0,0,")) continue;

          if (!allowed.has(raw)) {
            violations.push({
              file: relativePath,
              line: idx + 1,
              match: m[0],
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
