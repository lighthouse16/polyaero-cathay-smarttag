import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyLiveBagRisk,
  buildLiveTransferSnapshot,
  fetchLiveTransferSnapshot,
  fetchLiveRecoveryPerformance,
  recordLiveBagScan,
  type BackendBag,
} from "../src/lib/liveTransferAdapter";

const base = "https://example.invalid/api/v1";
const bag: BackendBag = {
  id: "persisted-bag",
  tag_number: "0161234567",
  tag_code: "SEED-20200101-00",
  passenger_name: "SYNTHETIC/DEMO",
  flight_number: "CX548",
  departure_airport: "HKG",
  arrival_airport: "NRT",
  departure_time: "2026-11-15T04:00:00Z",
  status: "CHECKED_IN",
  risk_score: null,
  events: [],
};
const features = {
  flight_number: "CX548",
  origin: "HKG",
  destination: "NRT",
  transfer_minutes: 35,
  weather_severity: 2,
  load_factor_pct: 85,
  airport_congestion: 2,
};

afterEach(() => vi.unstubAllGlobals());

describe("persistent baggage integration", () => {
  it("discovers every database bag in one request without guessing seed dates", async () => {
    const bags = Array.from({ length: 10 }, (_, i) => ({
      ...bag,
      id: `persisted-${i}`,
      tag_number: `016123450${i}`,
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(bags)));
    vi.stubGlobal("fetch", fetchMock);
    const snapshot = await fetchLiveTransferSnapshot(base);
    expect(snapshot.bags).toHaveLength(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${base}/baggage/dashboard`, { cache: "no-store" });
  });

  it("passes cancellation to the baggage request", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveTransferSnapshot(controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("uses the staff dashboard endpoint for performance and forwards cancellation", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveRecoveryPerformance(
      { window: "7d", station: "HKG", outboundLegId: "all" },
      controller.signal,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/baggage\/dashboard$/);
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: "no-store", signal: controller.signal });
  });

  it("propagates authorization failures without falling back to member baggage", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchLiveTransferSnapshot(base)).rejects.toThrow("HTTP 401");
    await expect(fetchLiveRecoveryPerformance({ window: "7d", station: "HKG", outboundLegId: "all" })).rejects.toThrow("HTTP 401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("/baggage/dashboard"))).toBe(true);
  });

  it("does not invent risk assessments for records without persisted risk", () => {
    const snapshot = buildLiveTransferSnapshot([bag]);
    expect(snapshot.bagRisks[0]).toMatchObject({ status: "unavailable", score: null });
    expect(snapshot.flightRisks.every((risk) => risk.score === null)).toBe(true);
    expect(snapshot.connections[0].attention).toBe("unknown");
  });

  it("reports failed writes rather than returning fake scan or prediction success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      recordLiveBagScan(base, bag.tag_number, {
        event_type: "TRANSFER_SCANNED",
        location_code: "HKG",
        station_name: "Demo station",
      }),
    ).rejects.toThrow("Baggage scan failed with HTTP 404");
    await expect(
      applyLiveBagRisk(base, bag.tag_number, features),
    ).rejects.toThrow("Baggage risk update failed with HTTP 404");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the server's persisted record after a successful scan", async () => {
    const updated = { ...bag, status: "LOADED" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(updated)));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await recordLiveBagScan(base, bag.tag_number, {
        event_type: "TRANSFER_SCANNED",
        location_code: "HKG",
        station_name: "Demo station",
      }),
    ).toEqual(updated);
  });
});
