import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = join(process.cwd(), "src");
const read = (path: string) => readFileSync(join(src, path), "utf8");
const css = read("app/globals.css");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(css|tsx)$/.test(path) ? [path] : [];
  });
}

describe("Cathay local typography", () => {
  it("maps all six static font files to their real weights", () => {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)];
    expect(faces).toHaveLength(6);
    for (const face of faces) {
      const file = face[1].match(/url\("([^"]+)"\)/)?.[1];
      expect(file).toBeDefined();
      expect(existsSync(join(process.cwd(), "public", file!))).toBe(true);
      const weight = /(?:_Lt|Light)\./.test(file!) ? 300 : /(?:_Bd|Bold)\./.test(file!) ? 700 : 400;
      expect(face[1]).toMatch(new RegExp(`font-weight:\\s*${weight};`));
    }
    expect(css).toContain("font-synthesis-weight: none;");
  });

  it("uses only supplied static weights in styles and components", () => {
    for (const path of sourceFiles(src)) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toMatch(/(?:font-weight|fontWeight):\s*(?:200|450|500|550|600)\b/);
      expect(text, path).not.toMatch(/fontWeight:\s*active\s*\?\s*600\s*:\s*500/);
    }
  });

  it("shares brand family tokens and uses tabular brand text for entity IDs", () => {
    for (const path of ["components/layout/OperationsHeader.module.css", "components/investigation/BaggageInvestigationPanel.module.css"]) {
      expect(read(path)).not.toMatch(/font-family:\s*"/);
      expect(read(path)).toContain("font-family: var(--font-sans);");
      expect(read(path)).toContain("font-family: var(--font-display);");
    }
    const copilot = read("components/copilot/OperationsCopilot.module.css");
    const entityRule = copilot.match(/\.entityChipMono\s*\{([^}]+)\}/)?.[1];
    expect(entityRule).toContain("font-family: var(--font-sans);");
    expect(entityRule).toContain("font-variant-numeric: tabular-nums;");
    expect(copilot.match(/\.inlineCode\s*\{([^}]+)\}/)?.[1]).toContain("monospace");
  });
});
