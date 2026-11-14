import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "../v1/transfer-control/route";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

describe("transfer snapshot API", () => {
  it("defaults unavailable without importing baggage seeds", async () => {
    vi.stubEnv("STAFF_QA_FIXTURE", "");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ availability: "unavailable", bags: [], legs: [], connections: [], flightRisks: [], bagRisks: [], transferSuccess: null });
  });
  it("production ignores explicit QA fixture opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("STAFF_QA_FIXTURE", "1");
    const response = await GET();
    expect((await response.json()).availability).toBe("unavailable");
  });
  it("invalid QA file fails safely instead of returning stale or seeded state", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("STAFF_QA_FIXTURE", "1");
    const { readFile } = await import("node:fs/promises");
    vi.mocked(readFile).mockResolvedValue("{invalid");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ detail: "Transfer-control source unavailable" });
  });
});
