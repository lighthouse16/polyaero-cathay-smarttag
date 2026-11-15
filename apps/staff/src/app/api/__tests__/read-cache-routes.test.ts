import { afterEach, expect, it, vi } from "vitest";
import { GET as transfer } from "../v1/transfer-control/route";
import { GET as performance } from "../v1/recovery-performance/route";
import { fetchLiveTransferSnapshot, fetchLiveRecoveryPerformance } from "../../../lib/liveTransferAdapter";

vi.mock("../../../lib/liveTransferAdapter", () => ({
  fetchLiveTransferSnapshot: vi.fn(), fetchLiveRecoveryPerformance: vi.fn(),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

it.each(["", "?fresh=1", "?fresh=0"])("routes preserve private responses for %s", async (suffix) => {
  const fresh = suffix === "?fresh=1";
  vi.stubEnv("STAFF_LIVE_BACKEND", "1");
  vi.mocked(fetchLiveTransferSnapshot).mockResolvedValue({ availability: "available" } as never);
  vi.mocked(fetchLiveRecoveryPerformance).mockResolvedValue({ availability: "available" } as never);
  const a = await transfer(new Request(`http://localhost/api/v1/transfer-control${suffix}`));
  const b = await performance(new Request(`http://localhost/api/v1/recovery-performance${suffix}`));
  expect(fetchLiveTransferSnapshot).toHaveBeenCalledWith(undefined, fresh);
  expect(fetchLiveRecoveryPerformance).toHaveBeenCalledWith(
    { window: "7d", station: "HKG", outboundLegId: "all" }, undefined, fresh,
  );
  for (const res of [a, b]) {
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  }
});

it("source errors return uncached 503 without leaking upstream details", async () => {
  vi.stubEnv("STAFF_LIVE_BACKEND", "1");
  vi.mocked(fetchLiveTransferSnapshot).mockRejectedValue(new Error("HTTP 401 secret"));
  vi.mocked(fetchLiveRecoveryPerformance).mockRejectedValue(new Error("HTTP 403 secret"));
  const a = await transfer(new Request("http://localhost/api/v1/transfer-control"));
  const b = await performance(new Request("http://localhost/api/v1/recovery-performance"));
  for (const res of [a, b]) {
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).not.toContain("secret");
  }
});
