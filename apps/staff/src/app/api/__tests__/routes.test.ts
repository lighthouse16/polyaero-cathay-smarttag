import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
// Tests never read or reset the running demo store.
vi.mock("node:fs", () => ({
  default: { existsSync: () => false, writeFileSync: vi.fn() },
}));

import { NextRequest } from "next/server";
import {
  GET as baggageGET,
  POST as baggagePOST,
} from "../v1/baggage/[[...path]]/route";
import { GET as tagDisplayGET } from "../v1/tags/[tag_code]/display/route";

function makeRequest(
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
) {
  return new NextRequest(url, init);
}

describe("Staff API Route Handlers", () => {
  beforeEach(async () => {
    await baggagePOST(
      makeRequest("http://localhost/api/v1/baggage/reset", { method: "POST" }),
      {
        params: Promise.resolve({ path: ["reset"] }),
      },
    );
  });

  afterAll(async () => {
    await baggagePOST(
      makeRequest("http://localhost/api/v1/baggage/reset", { method: "POST" }),
      {
        params: Promise.resolve({ path: ["reset"] }),
      },
    );
  });

  describe("Baggage Fixtures & GET", () => {
    it("returns 8 demo transfer baggage fixtures", async () => {
      const res = await baggageGET(
        makeRequest("http://localhost/api/v1/baggage"),
        {
          params: Promise.resolve({ path: [] }),
        },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(8);
      expect(data.map((b: { tag_number: string }) => b.tag_number)).toEqual([
        "0160892014",
        "0160892037",
        "0160892056",
        "0160892088",
        "0160892097",
        "0160892115",
        "0160892122",
        "0160892012",
      ]);
    });

    it("returns 404 for unknown baggage tag number", async () => {
      const res = await baggageGET(
        makeRequest("http://localhost/api/v1/baggage/9999999999"),
        {
          params: Promise.resolve({ path: ["9999999999"] }),
        },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/tags/[tag_code]/display", () => {
    it("returns FastAPI-compatible E-Ink display payload by tag_code", async () => {
      const res = await tagDisplayGET(
        makeRequest(
          "http://localhost/api/v1/tags/04:A2:3B:4C:5D:6E:70/display",
        ),
        { params: Promise.resolve({ tag_code: "04:A2:3B:4C:5D:6E:70" }) },
      );
      expect(res.status).toBe(200);
      const payload = await res.json();
      expect(Object.keys(payload).sort()).toEqual([
        "bag_number",
        "banner",
        "cabin",
        "destination",
        "flight",
        "is_rush",
        "origin",
        "passenger",
        "status",
        "tag_code",
        "updated_at",
        "weight_kg",
      ]);
      expect(payload).toMatchObject({
        tag_code: "04:A2:3B:4C:5D:6E:70",
        bag_number: "0160892012",
        flight: "CX888",
        origin: "HKG",
        destination: "YVR",
        passenger: "NG/RAYMOND",
        cabin: "PRIORITY J",
        weight_kg: 22.4,
        status: "LOADED",
        banner: "ON TRACK",
        is_rush: false,
      });
    });

    it("resolves case-insensitively and by bag tag_number", async () => {
      const res = await tagDisplayGET(
        makeRequest("http://localhost/api/v1/tags/0160892014/display"),
        { params: Promise.resolve({ tag_code: " 0160892014 " }) },
      );
      expect(res.status).toBe(200);
      const payload = await res.json();
      expect(payload.bag_number).toBe("0160892014");
      expect(payload.status).toBe("MISROUTED");
      expect(payload.is_rush).toBe(true);
    });

    it("returns 404 when tag is not registered", async () => {
      const res = await tagDisplayGET(
        makeRequest("http://localhost/api/v1/tags/FF:FF:FF/display"),
        { params: Promise.resolve({ tag_code: "FF:FF:FF" }) },
      );
      expect(res.status).toBe(404);
      const payload = await res.json();
      expect(payload).toEqual({ detail: "Tag not registered" });
    });

    it("reflects updates from shared local baggage store after scan", async () => {
      await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: JSON.stringify({ event_type: "MISROUTED" }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );

      const res = await tagDisplayGET(
        makeRequest(
          "http://localhost/api/v1/tags/04:A2:3B:4C:5D:6E:70/display",
        ),
        { params: Promise.resolve({ tag_code: "04:A2:3B:4C:5D:6E:70" }) },
      );
      expect(res.status).toBe(200);
      const payload = await res.json();
      expect(payload.status).toBe("MISROUTED");
      expect(payload.banner).toBe("MISROUTED • REROUTING");
      expect(payload.is_rush).toBe(true);
    });
  });

  describe("POST /api/v1/baggage/[tagNumber]/scan hardening", () => {
    it("rejects malformed JSON or empty object with 400", async () => {
      const resMalformed = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: "{bad json",
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );
      expect(resMalformed.status).toBe(400);

      const resArray = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: "[]",
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );
      expect(resArray.status).toBe(400);
    });

    it("rejects unsupported event_type with 400", async () => {
      const res = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: JSON.stringify({ event_type: "TELEPORTED" }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );
      expect(res.status).toBe(400);
    });

    it("defaults scanner_type to MANUAL_OVERRIDE and never infers NFC", async () => {
      const res = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: JSON.stringify({ event_type: "ARRIVED" }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );
      expect(res.status).toBe(200);
      const bag = await res.json();
      expect(bag.status).toBe("ARRIVED");
      expect(bag.events[bag.events.length - 1].scanner_type).toBe(
        "MANUAL_OVERRIDE",
      );
    });

    it("defaults unknown scanner_type to MANUAL_OVERRIDE and keeps explicit valid scanner_type", async () => {
      const resUnknown = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: JSON.stringify({
            event_type: "ARRIVED",
            scanner_type: "FAKE_NFC",
          }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );
      expect(resUnknown.status).toBe(200);
      const bagUnknown = await resUnknown.json();
      expect(bagUnknown.events[bagUnknown.events.length - 1].scanner_type).toBe(
        "MANUAL_OVERRIDE",
      );

      const resExplicit = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/scan", {
          method: "POST",
          body: JSON.stringify({
            event_type: "COLLECTED",
            scanner_type: "OPTICAL_BARCODE",
          }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "scan"] }) },
      );
      expect(resExplicit.status).toBe(200);
      const bagExplicit = await resExplicit.json();
      expect(
        bagExplicit.events[bagExplicit.events.length - 1].scanner_type,
      ).toBe("OPTICAL_BARCODE");
    });
  });

  describe("POST risk endpoints validation & bounds", () => {
    it("rejects malformed JSON or invalid flight_number/origin/destination", async () => {
      const resMalformed = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/risk/predict", {
          method: "POST",
          body: "not json",
        }),
        { params: Promise.resolve({ path: ["risk", "predict"] }) },
      );
      expect(resMalformed.status).toBe(400);

      const resBadOrigin = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/risk/predict", {
          method: "POST",
          body: JSON.stringify({
            flight_number: "CX888",
            origin: "HK",
            destination: "YVR",
          }),
        }),
        { params: Promise.resolve({ path: ["risk", "predict"] }) },
      );
      expect(resBadOrigin.status).toBe(400);

      const resBadFlight = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/risk/predict", {
          method: "POST",
          body: JSON.stringify({
            flight_number: "X",
            origin: "HKG",
            destination: "YVR",
          }),
        }),
        { params: Promise.resolve({ path: ["risk", "predict"] }) },
      );
      expect(resBadFlight.status).toBe(400);
    });

    it("rejects out-of-bounds numeric risk features", async () => {
      const resTransfer = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/risk/predict", {
          method: "POST",
          body: JSON.stringify({
            flight_number: "CX888",
            origin: "HKG",
            destination: "YVR",
            transfer_minutes: -10,
          }),
        }),
        { params: Promise.resolve({ path: ["risk", "predict"] }) },
      );
      expect(resTransfer.status).toBe(400);

      const resWeather = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/risk/predict", {
          method: "POST",
          body: JSON.stringify({
            flight_number: "CX888",
            origin: "HKG",
            destination: "YVR",
            weather_severity: 9,
          }),
        }),
        { params: Promise.resolve({ path: ["risk", "predict"] }) },
      );
      expect(resWeather.status).toBe(400);

      const resLoad = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/risk/apply", {
          method: "POST",
          body: JSON.stringify({
            flight_number: "CX888",
            origin: "HKG",
            destination: "YVR",
            load_factor_pct: 120,
          }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "risk", "apply"] }) },
      );
      expect(resLoad.status).toBe(400);
    });

    it("predicts and applies risk within valid bounds", async () => {
      const res = await baggagePOST(
        makeRequest("http://localhost/api/v1/baggage/0160892012/risk/apply", {
          method: "POST",
          body: JSON.stringify({
            flight_number: "CX888",
            origin: "HKG",
            destination: "YVR",
            transfer_minutes: 30,
            weather_severity: 4,
            load_factor_pct: 95,
            airport_congestion: 4,
          }),
        }),
        { params: Promise.resolve({ path: ["0160892012", "risk", "apply"] }) },
      );
      expect(res.status).toBe(200);
      const assessment = await res.json();
      expect(assessment.risk_level).toBe("HIGH_PRIORITY");
      expect(assessment.risk_score).toBe(98);
    });
  });
});
