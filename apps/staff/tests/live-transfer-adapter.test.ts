import { clearReadCache } from "../src/lib/readCache";
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

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.unstubAllEnvs(); clearReadCache(); });

describe("persistent baggage integration", () => {
  it("reuses warm baggage and schedule reads but fresh refresh bypasses baggage cache", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.endsWith("/baggage/dashboard") ? [bag] : { outbound: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveTransferSnapshot(base);
    const coldCalls = fetchMock.mock.calls.length;
    await fetchLiveTransferSnapshot(base);
    expect(fetchMock).toHaveBeenCalledTimes(coldCalls);
    await fetchLiveTransferSnapshot(base, true);
    expect(fetchMock).toHaveBeenCalledTimes(coldCalls + 1);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${base}/baggage/dashboard`);
  });

  it("expires baggage after 15 seconds without repeating schedule searches", async () => {
    let clock = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.endsWith("/baggage/dashboard") ? [bag] : { outbound: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveTransferSnapshot(base);
    const coldCalls = fetchMock.mock.calls.length;
    clock += 15_001;
    await fetchLiveTransferSnapshot(base);
    expect(fetchMock).toHaveBeenCalledTimes(coldCalls + 1);
  });

  it("does not mutate upstream records while normalizing duplicate IDs", () => {
    const input = [{ ...bag }, { ...bag, tag_number: "0161234568" }];
    const original = structuredClone(input);
    const snapshot = buildLiveTransferSnapshot(input);
    expect(new Set(snapshot.bags.map((b) => b.id)).size).toBe(2);
    expect(input).toEqual(original);
  });

  it("expires flight searches after five minutes", async () => {
    let clock = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.endsWith("/baggage/dashboard") ? [bag] : { outbound: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveTransferSnapshot(base);
    const coldCalls = fetchMock.mock.calls.length;
    clock += 300_001;
    await fetchLiveTransferSnapshot(base);
    expect(fetchMock).toHaveBeenCalledTimes(coldCalls * 2);
  });

  it.each(["scan", "risk"])("invalidates cached baggage after persisted %s", async (action) => {
    let status = "CHECKED_IN";
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/baggage/dashboard")) return new Response(JSON.stringify([{ ...bag, status }]));
      if (url.endsWith("/scan") || url.endsWith("/risk/apply")) {
        status = "LOADED";
        return new Response(JSON.stringify({ ...bag, status }));
      }
      return new Response("{}");
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchLiveTransferSnapshot(base)).bags[0].status).toBe("CHECKED_IN");
    if (action === "scan") {
      await recordLiveBagScan(base, bag.tag_number, { event_type: "LOADED", location_code: "HKG", station_name: "Test" });
    } else {
      await applyLiveBagRisk(base, bag.tag_number, features);
    }
    expect((await fetchLiveTransferSnapshot(base)).bags[0].status).toBe("LOADED");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/baggage/dashboard"))).toHaveLength(2);
  });

  it.each([401, 403])("expired cache propagates HTTP %s and retries instead of returning old records", async (denied) => {
    let clock = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    let status = 200;
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      new Response(status === 200 ? JSON.stringify(url.endsWith("/baggage/dashboard") ? [bag] : {}) : "", { status }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveTransferSnapshot(base);
    clock += 300_001;
    status = denied;
    await expect(fetchLiveTransferSnapshot(base)).rejects.toThrow(`HTTP ${denied}`);
    status = 200;
    expect((await fetchLiveTransferSnapshot(base)).bags).toHaveLength(1);
  });

  it("failed writes preserve valid reads and successful scans invalidate Performance baggage", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", base);
    let writeFails = true;
    let status = "CHECKED_IN";
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/baggage/dashboard")) return new Response(JSON.stringify([{ ...bag, status }]));
      if (url.endsWith("/scan")) {
        if (writeFails) return new Response("", { status: 503 });
        status = "LOADED";
        return new Response(JSON.stringify({ ...bag, status }));
      }
      return new Response("{}");
    });
    vi.stubGlobal("fetch", fetchMock);
    const filters = { window: "24h", station: "HKG", outboundLegId: "all" } as const;
    await fetchLiveRecoveryPerformance(filters);
    const scan = { event_type: "LOADED", location_code: "HKG", station_name: "Test" };
    await expect(recordLiveBagScan(base, bag.tag_number, scan)).rejects.toThrow("HTTP 503");
    await fetchLiveRecoveryPerformance(filters);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/baggage/dashboard"))).toHaveLength(1);
    writeFails = false;
    await recordLiveBagScan(base, bag.tag_number, scan);
    await fetchLiveRecoveryPerformance(filters);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/baggage/dashboard"))).toHaveLength(2);
  });

  it("snapshot output edits cannot alter a later warm snapshot", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.endsWith("/baggage/dashboard") ? [{ ...bag, events: [{ id: "e", event_type: "TAGGED", timestamp: "2026-11-14T12:00:00Z" }] }] : {})));
    vi.stubGlobal("fetch", fetchMock);
    const first = await fetchLiveTransferSnapshot(base);
    first.bags[0].status = "LOADED";
    first.bags[0].events[0].event_type = "COLLECTED";
    const second = await fetchLiveTransferSnapshot(base);
    expect(second.bags[0].status).toBe("CHECKED_IN");
    expect(second.bags[0].events[0].event_type).toBe("TAGGED");
  });

  it.each(["2026-11-15T02:48:00Z", "2026-11-17T23:50:00Z"])("rebases every marked demo flight despite old persisted schedules at %s", (clock) => {
    const now = new Date(clock);
    const flights = ["CX251", "CX548", "CX888", "CX255", "CX711"];
    const destinations = ["LHR", "NRT", "YVR", "NKG", "SIN"];
    const cohort: BackendBag[] = Array.from({ length: 50 }, (_, i) => ({
      ...bag, id: `demo-${i}`, tag_number: `01699${String(i).padStart(5, "0")}`,
      dataset: i % 2 ? "realistic-v1" : undefined,
      tag_code: i % 2 ? "BENCHMARK" : `REALISTIC-${i}`,
      flight_number: flights[i % 5], arrival_airport: destinations[i % 5],
      departure_time: "2026-11-14T01:00:00Z", status: "MISROUTED", risk_score: 85,
    }));
    const schedules = flights.map((flight_number, i) => ({
      id: `flight-${i}`, flight_number, origin_code: "HKG", destination_code: destinations[i],
      departure_time: "2026-11-14T01:00:00Z", arrival_time: "2026-11-14T14:00:00Z",
    }));
    const original = structuredClone(cohort);
    const snapshot = buildLiveTransferSnapshot(cohort, now, "Demo test", schedules);
    const outbounds = snapshot.legs.filter((l) => l.id.startsWith("out-"));
    expect(outbounds).toHaveLength(5);
    expect(new Set(outbounds.map((l) => l.scheduledDepartureAt)).size).toBe(5);
    for (const c of snapshot.connections) {
      const out = snapshot.legs.find((l) => l.id === c.outboundLegId)!;
      const inbound = snapshot.legs.find((l) => l.id === c.inboundLegId)!;
      expect(Date.parse(c.deadline!.at) - now.getTime()).toBeGreaterThanOrEqual(55 * 60_000);
      expect(Date.parse(inbound.scheduledArrivalAt!)).toBeLessThan(Date.parse(c.deadline!.at));
      expect(snapshot.bags.find((b) => b.tag_number === c.bagTag)!.departure_time).toBe(out.scheduledDepartureAt);
      expect(out.scheduledArrivalAt === null || Date.parse(out.scheduledArrivalAt) > Date.parse(out.scheduledDepartureAt!)).toBe(true);
    }
    expect(cohort).toEqual(original);
  });

  it("keeps shared synthetic feeders before each outbound cutoff", () => {
    const now = new Date("2026-11-15T02:48:00Z");
    const cohort = Array.from({ length: 6 }, (_, i) => ({
      ...bag, id: `shared-${i}`, tag_number: `016700000${i}`, dataset: "realistic-v1",
      flight_number: i < 5 ? "CX251" : "CX548", arrival_airport: i < 5 ? "LHR" : "NRT",
      departure_time: "2026-11-14T01:00:00Z", connection_minutes: 90,
    }));
    const snapshot = buildLiveTransferSnapshot(cohort, now);
    for (const c of snapshot.connections) {
      const feeder = snapshot.legs.find((l) => l.id === c.inboundLegId)!;
      expect(Date.parse(feeder.scheduledArrivalAt!)).toBeLessThan(Date.parse(c.deadline!.at));
    }
  });

  it.each([false, true])("isolates real and demo outbound schedules regardless of input order %s", (reverse) => {
    const now = new Date("2026-11-15T02:00:00Z");
    const schedule = { id: "real", flight_number: "CX548", origin_code: "HKG", destination_code: "NRT", departure_time: "2026-11-15T08:00:00Z", arrival_time: "2026-11-15T13:00:00Z" };
    const real = { ...bag, departure_time: schedule.departure_time };
    const demo = { ...real, id: "demo", tag_number: "0161234500", dataset: "realistic-v1" };
    const snapshot = buildLiveTransferSnapshot(reverse ? [demo, real] : [real, demo], now, "Mixed", [schedule]);
    expect(snapshot.connections[0].outboundLegId).not.toBe(snapshot.connections[1].outboundLegId);
    for (const c of snapshot.connections) {
      const out = snapshot.legs.find((l) => l.id === c.outboundLegId)!;
      const b = snapshot.bags.find((b) => b.tag_number === c.bagTag)!;
      expect(b.departure_time).toBe(out.scheduledDepartureAt);
      expect(Date.parse(c.deadline!.at)).toBe(Date.parse(out.scheduledDepartureAt!) - 20 * 60_000);
    }
    expect(snapshot.bags.find((b) => b.tag_number === real.tag_number)!.departure_time).toBe("2026-11-15T08:00:00.000Z");
  });

  it("does not roll an authentic overdue flight into the demo shift", () => {
    const now = new Date("2026-11-15T02:48:00Z");
    const departure_time = "2026-11-14T01:00:00Z";
    const schedule = { id: "real", flight_number: "CX548", origin_code: "HKG", destination_code: "NRT", departure_time, arrival_time: "2026-11-14T06:00:00Z" };
    const snapshot = buildLiveTransferSnapshot([{ ...bag, departure_time }], now, "Real test", [schedule]);
    expect(snapshot.legs.find((l) => l.id.startsWith("out-"))!.scheduledDepartureAt).toBe("2026-11-14T01:00:00.000Z");
    expect(Date.parse(snapshot.connections[0].deadline!.at)).toBeLessThan(now.getTime());
  });

  it("never assigns an unrelated real feeder arriving after the outbound flight", () => {
    const now = new Date("2026-11-15T06:00:00Z");
    const flights = [
      { id: "out", flight_number: "CX548", origin_code: "HKG", destination_code: "NRT", departure_time: "2026-11-15T07:00:00Z", arrival_time: "2026-11-15T11:00:00Z" },
      { id: "late", flight_number: "CX541", origin_code: "NRT", destination_code: "HKG", departure_time: "2026-11-15T10:00:00Z", arrival_time: "2026-11-15T14:00:00Z" },
    ];
    const snapshot = buildLiveTransferSnapshot([{ ...bag, departure_time: flights[0].departure_time }], now, "test", flights);
    const connection = snapshot.connections[0];
    const feeder = snapshot.legs.find((leg) => leg.id === connection.inboundLegId)!;
    expect(feeder.flightNumber).not.toBe("CX541");
    expect(Date.parse(feeder.scheduledArrivalAt!)).toBeLessThan(Date.parse(connection.deadline!.at));
  });

  it("keeps overnight inbound dates and uses the next feasible real outbound", () => {
    const now = new Date("2026-11-15T06:00:00Z");
    const flights = [
      { id: "in", flight_number: "CX889", origin_code: "YVR", destination_code: "HKG", departure_time: "2026-11-14T06:00:00Z", arrival_time: "2026-11-15T05:00:00Z" },
      { id: "out", flight_number: "CX548", origin_code: "HKG", destination_code: "NRT", departure_time: "2026-11-15T07:00:00Z", arrival_time: "2026-11-15T11:00:00Z" },
    ];
    const snapshot = buildLiveTransferSnapshot([{ ...bag, flight_number: "CX889", departure_airport: "YVR", arrival_airport: "HKG", departure_time: flights[0].departure_time }], now, "test", flights);
    expect(snapshot.connections[0].inboundLegId).toBe("in-CX889-2026-11-14");
    expect(snapshot.connections[0].outboundLegId).toBe("out-CX548-2026-11-15");
    expect(snapshot.bags[0].departure_time).toBe("2026-11-15T07:00:00.000Z");
    expect(snapshot.connections[0].deadline!.at).toBe("2026-11-15T06:40:00.000Z");
  });

  it("keeps inferred departure after known inbound arrival when no feasible onward exists", () => {
    const now = new Date("2026-11-15T06:00:00Z");
    const inbound = { id: "in", flight_number: "CX889", origin_code: "YVR", destination_code: "HKG", departure_time: "2026-11-14T20:00:00Z", arrival_time: "2026-11-15T12:00:00Z" };
    const snapshot = buildLiveTransferSnapshot([{ ...bag, flight_number: "CX889", departure_airport: "YVR", arrival_airport: "HKG", departure_time: inbound.departure_time }], now, "test", [inbound]);
    expect(Date.parse(snapshot.connections[0].deadline!.at)).toBeGreaterThan(Date.parse(inbound.arrival_time));
  });

  it("rejects flight-phase cancellation instead of returning an available snapshot", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith("/baggage/dashboard")) return new Response(JSON.stringify([bag]));
      expect(options.signal).toBe(controller.signal);
      controller.abort();
      throw new DOMException("Cancelled", "AbortError");
    }));
    await expect(fetchLiveTransferSnapshot(controller.signal)).rejects.toThrow("Cancelled");
  });

  it.each([401, 403])("propagates flight HTTP %s without successful fallback", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) =>
      url.endsWith("/baggage/dashboard") ? new Response(JSON.stringify([bag])) : new Response("", { status })));
    await expect(fetchLiveTransferSnapshot(base)).rejects.toThrow(`HTTP ${status}`);
  });

  it("retains the baggage snapshot when optional flight enrichment returns 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) =>
      url.endsWith("/baggage/dashboard") ? new Response(JSON.stringify([bag])) : new Response("", { status: 503 })));
    expect((await fetchLiveTransferSnapshot(base)).bags).toHaveLength(1);
  });
  it("loads every database bag and queries matching flights", async () => {
    const bags = Array.from({ length: 11 }, (_, i) => ({
      ...bag,
      id: `persisted-${i}`,
      tag_number: `01612345${String(i).padStart(2, "0")}`,
    }));
    const flight = {
      id: "flight-cx548",
      flight_number: "CX548",
      origin_code: "HKG",
      destination_code: "NRT",
      departure_time: bag.departure_time,
      arrival_time: "2026-11-15T09:00:00Z",
    };
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(new Response(JSON.stringify(
        url.endsWith("/baggage/dashboard")
          ? bags
          : { outbound: [flight] },
      ))),
    );
    vi.stubGlobal("fetch", fetchMock);
    const snapshot = await fetchLiveTransferSnapshot(base);
    expect(snapshot.bags).toHaveLength(11);
    expect(snapshot.legs).toContainEqual(expect.objectContaining({
      id: "out-CX548-2026-11-15",
      scheduledDepartureAt: new Date(flight.departure_time).toISOString(),
      scheduledArrivalAt: new Date(flight.arrival_time).toISOString(),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${base}/baggage/dashboard`, { cache: "no-store" });
    expect(fetchMock.mock.calls.slice(1).every(([url]) => String(url).includes("/flights/search"))).toBe(true);
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

  it("reads a newly persisted mobile sync on the next request without losing bag identity", async () => {
    const updatedAt = "2026-11-14T19:00:01Z";
    const synced = {
      ...bag,
      status: "TAGGED",
      is_tag_synced: true,
      updated_at: updatedAt,
      events: [{ id: "mobile-sync-event", event_type: "SYNCHRONIZED", timestamp: updatedAt, scanner_type: "APP", location_code: "MOBILE-APP", station_name: "Cathay App SmartTag Sync" }],
    };
    let dashboardRequests = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (!url.endsWith("/baggage/dashboard")) {
        return Promise.resolve(new Response("{}"));
      }
      dashboardRequests += 1;
      return Promise.resolve(new Response(JSON.stringify([
        dashboardRequests === 1 ? { ...bag, is_tag_synced: false } : synced,
      ])));
    });
    vi.stubGlobal("fetch", fetchMock);
    const before = await fetchLiveTransferSnapshot(base);
    const after = await fetchLiveTransferSnapshot(base, true);
    expect(before.bags[0].id).toBe(after.bags[0].id);
    expect(before.bags[0].is_tag_synced).toBe(false);
    expect(after.bags[0]).toMatchObject({ id: bag.id, tag_number: bag.tag_number, status: "TAGGED", is_tag_synced: true, updated_at: new Date(updatedAt).toISOString() });
    expect(after.bags[0].events).toContainEqual(expect.objectContaining({ id: "mobile-sync-event", event_type: "SYNCHRONIZED", scanner_type: "APP" }));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/baggage/dashboard"))).toHaveLength(2);
    expect(fetchMock.mock.calls.every(([, options]) => options.cache === "no-store")).toBe(true);
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

  it("anchors stale or near-cutoff departures ahead of cutoff so no leg opens overdue", () => {
    const fixedNow = new Date("2026-11-15T06:00:00Z");
    const overdueInput: BackendBag[] = [
      {
        ...bag,
        id: "stale-bag",
        tag_number: "0169000001",
        departure_time: "2026-11-15T06:05:00Z", // only +5m left (< 20m cutoff)
        status: "MISROUTED",
        is_rush_bag: true,
        risk_score: 88,
      },
      {
        ...bag,
        id: "very-old-bag",
        tag_number: "0169000002",
        flight_number: "CX701",
        arrival_airport: "BKK",
        departure_time: "2026-11-10T10:00:00Z",
        status: "MISSING",
        is_rush_bag: true,
        risk_score: 91,
      },
    ];
    const snapshot = buildLiveTransferSnapshot(overdueInput, fixedNow);
    for (const conn of snapshot.connections) {
      const deadlineMs = Date.parse(conn.deadline?.at ?? "");
      expect(deadlineMs).toBeGreaterThan(fixedNow.getTime() + 45 * 60_000);
    }
  });

  it("caps synthetic multi-day connection_minutes on inbound feeder legs so arrivals stay in current shift", () => {
    const fixedNow = new Date("2026-11-15T06:00:00Z");
    const multiDayGapBag: BackendBag = {
      ...bag,
      id: "gap-bag",
      tag_number: "0169000099",
      flight_number: "CX251",
      arrival_airport: "LHR",
      departure_time: "2026-11-15T08:00:00Z",
      connection_minutes: 6793,
      status: "MISROUTED",
    };
    const snapshot = buildLiveTransferSnapshot([multiDayGapBag], fixedNow);
    const inboundLeg = snapshot.legs.find((l) => l.id.startsWith("in-"));
    expect(inboundLeg?.scheduledArrivalAt).toBeTruthy();
    const arrMs = Date.parse(inboundLeg!.scheduledArrivalAt!);
    expect(arrMs).toBeGreaterThan(fixedNow.getTime() - 4 * 3600_000);
  });

  it("produces multi-day qualified funnel, trends, response buckets, deltas, and business impact for realistic-v1 cohorts", async () => {
    const realisticCohort: BackendBag[] = Array.from({ length: 40 }, (_, i) => ({
      ...bag,
      id: `real-${i}`,
      dataset: "realistic-v1",
      tag_number: `016800${String(i).padStart(4, "0")}`,
      tag_code: `REALISTIC-20261114-${i}`,
      flight_number: ["CX701", "CX711", "CX888", "CX251", "CX548"][i % 5],
      arrival_airport: ["BKK", "SIN", "YVR", "LHR", "NRT"][i % 5],
      status: i % 4 === 0 ? "MISROUTED" : i % 4 === 1 ? "RECOVERY_IN_PROGRESS" : "COLLECTED",
      risk_score: i % 2 === 0 ? 82 : 14,
      is_rush_bag: i % 2 === 0,
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(realisticCohort)));
    vi.stubGlobal("fetch", fetchMock);

    const report = await fetchLiveRecoveryPerformance({
      window: "7d",
      station: "HKG",
      outboundLegId: "all",
    });

    expect(report.availability).toBe("available");
    expect(report.trend.length).toBeGreaterThan(1);
    const loadedStage = report.funnel.find((s) => s.key === "loaded");
    const transferredStage = report.funnel.find((s) => s.key === "transferred");
    expect(loadedStage?.count).toBeGreaterThan(0);
    expect(transferredStage?.count).toBeGreaterThan(0);
    expect(report.efficiency.responseTimeBuckets?.length).toBe(5);
    expect(report.kpis.every((k) => k.comparison !== null)).toBe(true);
    expect(report.businessImpact.every((b) => b.value !== null && b.value > 0)).toBe(true);
    const daily = await fetchLiveRecoveryPerformance({ window: "24h", station: "HKG", outboundLegId: "all" });
    const success = daily.kpis.find((k) => k.id === "transferSuccess")!;
    expect(success.denominator).toBeGreaterThan(0);
    expect(success.value).toBeCloseTo(100 * success.numerator! / success.denominator!, 1);
  });

  it("populates transferSuccess and differentiates flight composite risk scores across departure banks", () => {
    const fixedNow = new Date("2026-11-15T06:00:00Z");
    const cohort: BackendBag[] = Array.from({ length: 100 }, (_, i) => {
      const flightIdx = i % 5;
      const bagWithinFlight = Math.floor(i / 5);
      const isCompletedBag = flightIdx === 4 && bagWithinFlight % 2 === 0;
      const isCrit = bagWithinFlight < 4;
      const isMed = bagWithinFlight >= 4 && bagWithinFlight < 8;
      return {
        ...bag,
        id: `diff-${i}`,
        dataset: "realistic-v1",
        tag_number: `016811${String(i).padStart(4, "0")}`,
        tag_code: `REALISTIC-20261114-${i}`,
        flight_number: ["CX251", "CX701", "CX711", "CX548", "CX888"][flightIdx],
        arrival_airport: ["LHR", "BKK", "SIN", "NRT", "YVR"][flightIdx],
        departure_time: "2026-11-15T06:10:00Z", // stale -> anchored per flight wave
        status: isCompletedBag ? "LOADED" : isCrit ? "MISROUTED" : isMed ? "RECOVERY_IN_PROGRESS" : "TAGGED",
        risk_score: bagWithinFlight === 0 ? 96 : isCrit ? 88 : isMed ? 54 : 18,
        is_rush_bag: isCrit,
      };
    });

    const snapshot = buildLiveTransferSnapshot(cohort, fixedNow);
    expect(snapshot.transferSuccess).not.toBeNull();
    expect(snapshot.transferSuccess!.eligible).toBeGreaterThan(0);
    expect(snapshot.transferSuccess!.successful).toBeGreaterThan(0);

    const outRisks = snapshot.flightRisks
      .filter((r) => r.flightLegId.startsWith("out-") && r.score !== null)
      .map((r) => r.score!);
    expect(outRisks).toHaveLength(5);
    expect(new Set(outRisks).size).toBeGreaterThan(3);
    expect(Math.max(...outRisks)).toBeLessThan(96);

    const loadedBagRisk = snapshot.bagRisks.find(
      (r) => r.bagTag === "0168110004",
    );
    expect(loadedBagRisk?.score).toBeLessThanOrEqual(15);
  });
});
