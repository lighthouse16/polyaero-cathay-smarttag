import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "../v1/recovery-performance/route";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

describe("recovery-performance API", () => {
  it("defaults to honest unavailable report without fabricating data", async () => {
    vi.stubEnv("STAFF_QA_FIXTURE", "");
    vi.stubEnv("STAFF_LIVE_BACKEND", "");
    const response = await GET(
      new Request("http://localhost/api/v1/recovery-performance?window=7d&station=HKG"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const json = await response.json();
    expect(json.availability).toBe("unavailable");
    expect(json.trend).toEqual([]);
    expect(json.kpis.every((k: { value: unknown }) => k.value === null)).toBe(true);
    expect(json.businessImpact.every((b: { value: unknown }) => b.value === null)).toBe(
      true,
    );
    expect(json.missingInputs).toContain("historical_risk_episodes");
  });

  it("rejects invalid reporting window and station codes", async () => {
    const badWindow = await GET(
      new Request("http://localhost/api/v1/recovery-performance?window=90d"),
    );
    expect(badWindow.status).toBe(400);

    const badStation = await GET(
      new Request("http://localhost/api/v1/recovery-performance?station=HKG1"),
    );
    expect(badStation.status).toBe(400);
  });

  it("production ignores QA fixture opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STAFF_QA_FIXTURE", "1");
    vi.stubEnv("STAFF_LIVE_BACKEND", "");
    const response = await GET(
      new Request("http://localhost/api/v1/recovery-performance?window=7d"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).availability).toBe("unavailable");
  });

  it("treats missing QA file cleanly as unavailable while failing safely on invalid JSON", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STAFF_QA_FIXTURE", "1");
    vi.stubEnv("STAFF_LIVE_BACKEND", "");
    const { readFile } = await import("node:fs/promises");

    vi.mocked(readFile).mockRejectedValueOnce(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    const missingRes = await GET(
      new Request("http://localhost/api/v1/recovery-performance"),
    );
    expect(missingRes.status).toBe(200);
    expect((await missingRes.json()).availability).toBe("unavailable");

    vi.mocked(readFile).mockResolvedValueOnce("{corrupt-json");
    const corruptRes = await GET(
      new Request("http://localhost/api/v1/recovery-performance"),
    );
    expect(corruptRes.status).toBe(503);
    expect(await corruptRes.json()).toEqual({
      detail: "Recovery-performance source unavailable",
    });
  });

  it("computes cohort report dynamically when valid QA episode source exists", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STAFF_QA_FIXTURE", "1");
    vi.stubEnv("STAFF_LIVE_BACKEND", "");
    const { readFile } = await import("node:fs/promises");

    vi.mocked(readFile).mockResolvedValueOnce(
      JSON.stringify({
        generatedAt: "2026-11-14T12:00:00Z",
        validUntil: "2026-11-14T18:00:00Z",
        referenceNow: "2026-11-14T12:00:00Z",
        source: "qa-fixture",
        episodes: [
          {
            episodeId: "ep-1",
            bagTag: "0160000001",
            connectionId: "conn-1",
            inboundLegId: "in-1",
            outboundLegId: "out-cx255",
            outboundFlightNumber: "CX255",
            outboundOperatingDate: "2026-11-13",
            origin: "HKG",
            destination: "NRT",
            station: "HKG",
            detectedAt: "2026-11-13T04:00:00Z",
            actionedAt: "2026-11-13T04:05:00Z",
            locatedAt: "2026-11-13T04:15:00Z",
            loadedAt: "2026-11-13T04:25:00Z",
            transferredAt: "2026-11-13T04:45:00Z",
            loadingCutoffAt: "2026-11-13T04:30:00Z",
            outcome: "recovered",
            primaryRiskCause: "Inbound delay",
            riskFactors: ["Inbound delay"],
            provenance: {
              system: "qa-fixture",
              recordId: "r-1",
              observedAt: "2026-11-13T04:45:00Z",
              validUntil: "2026-11-14T18:00:00Z",
            },
          },
        ],
        eligibleTransfers: [
          {
            bagTag: "0160000001",
            connectionId: "conn-1",
            outboundLegId: "out-cx255",
            outboundFlightNumber: "CX255",
            outboundOperatingDate: "2026-11-13",
            origin: "HKG",
            destination: "NRT",
            station: "HKG",
            observedAt: "2026-11-13T04:45:00Z",
            transferred: true,
            provenance: {
              system: "qa-fixture",
              recordId: "t-1",
              observedAt: "2026-11-13T04:45:00Z",
              validUntil: "2026-11-14T18:00:00Z",
            },
          },
        ],
      }),
    );

    const res = await GET(
      new Request("http://localhost/api/v1/recovery-performance?window=7d&station=HKG"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.availability).toBe("partial");
    expect(json.kpis.find((k: { id: string }) => k.id === "highRisk").value).toBe(1);
    expect(json.kpis.find((k: { id: string }) => k.id === "transferSuccess").value).toBe(
      100,
    );
    expect(json.businessImpact.every((b: { value: unknown }) => b.value === null)).toBe(
      true,
    );
  });
});
