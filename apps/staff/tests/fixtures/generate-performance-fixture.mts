import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const now = Date.now();
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// Generate 7 days of realistic verified QA episode records matching Cathay legs (CX255, CX564, CX772, CX418, CX703, CX619, CX524, CX872)
const flights = [
  { flightNumber: "CX255", origin: "HKG", destination: "NRT", transferBags: 246, highRiskBags: 42, recovered: 41, primaryCause: "Inbound delay" },
  { flightNumber: "CX564", origin: "HKG", destination: "TPE", transferBags: 192, highRiskBags: 34, recovered: 33, primaryCause: "Short connection" },
  { flightNumber: "CX772", origin: "HKG", destination: "SIN", transferBags: 178, highRiskBags: 29, recovered: 28, primaryCause: "Transfer scan missing" },
  { flightNumber: "CX418", origin: "HKG", destination: "BKK", transferBags: 164, highRiskBags: 27, recovered: 26, primaryCause: "Inbound delay" },
  { flightNumber: "CX703", origin: "HKG", destination: "MNL", transferBags: 150, highRiskBags: 26, recovered: 25, primaryCause: "Hub congestion" },
  { flightNumber: "CX619", origin: "HKG", destination: "ICN", transferBags: 138, highRiskBags: 22, recovered: 21, primaryCause: "Loading pressure" },
  { flightNumber: "CX524", origin: "HKG", destination: "KUL", transferBags: 126, highRiskBags: 20, recovered: 19, primaryCause: "Short connection" },
  { flightNumber: "CX872", origin: "HKG", destination: "SYD", transferBags: 118, highRiskBags: 18, recovered: 17, primaryCause: "Inbound delay" },
];

const episodes: any[] = [];
const eligibleTransfers: any[] = [];
let bagIdCounter = 10000;

for (let d = 6; d >= 0; d--) {
  const dayBase = now - d * DAY_MS;
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dayBase));

  for (const f of flights) {
    const outboundLegId = `leg-${f.flightNumber.toLowerCase()}-${dateStr}`;
    const dayRatio = 1 / 7;
    const dayTransfers = Math.round(f.transferBags * dayRatio);
    const dayRisk = Math.round(f.highRiskBags * dayRatio);
    const dayRecovered = Math.round(f.recovered * dayRatio);

    // Eligible transfers
    for (let i = 0; i < dayTransfers; i++) {
      bagIdCounter++;
      const bagTag = `01600${bagIdCounter}`;
      eligibleTransfers.push({
        bagTag,
        connectionId: `conn-${bagTag}`,
        outboundLegId,
        outboundFlightNumber: f.flightNumber,
        outboundOperatingDate: dateStr,
        origin: f.origin,
        destination: f.destination,
        station: "HKG",
        observedAt: new Date(dayBase - 2 * HOUR_MS + (i % 60) * 60_000).toISOString(),
        transferred: i < Math.round(dayTransfers * 0.97),
        provenance: {
          system: "qa-fixture",
          recordId: `tr-${bagTag}`,
          observedAt: new Date(dayBase).toISOString(),
          validUntil: new Date(now + 4 * HOUR_MS).toISOString(),
        },
      });
    }

    // High risk episodes
    for (let i = 0; i < dayRisk; i++) {
      const bagTag = `01600${bagIdCounter - i}`;
      const isRecovered = i < dayRecovered;
      const tDetect = new Date(dayBase - 3 * HOUR_MS + i * 3 * 60_000).toISOString();
      const tAction = new Date(Date.parse(tDetect) + 5.5 * 60_000).toISOString();
      const tLocate = new Date(Date.parse(tAction) + 11.8 * 60_000).toISOString();
      const tCutoff = new Date(dayBase - 40 * 60_000).toISOString();
      const tLoad = isRecovered ? new Date(Date.parse(tCutoff) - 10 * 60_000).toISOString() : null;
      const tTrans = isRecovered ? new Date(Date.parse(tCutoff) + 15 * 60_000).toISOString() : null;

      episodes.push({
        episodeId: `ep-${bagTag}-${dateStr}`,
        bagTag,
        connectionId: `conn-${bagTag}`,
        inboundLegId: "in-mock",
        outboundLegId,
        outboundFlightNumber: f.flightNumber,
        outboundOperatingDate: dateStr,
        origin: f.origin,
        destination: f.destination,
        station: "HKG",
        detectedAt: tDetect,
        actionedAt: tAction,
        locatedAt: tLocate,
        loadedAt: tLoad,
        transferredAt: tTrans,
        loadingCutoffAt: tCutoff,
        outcome: isRecovered ? "recovered" : "missed",
        primaryRiskCause: f.primaryCause,
        riskFactors: [f.primaryCause, "Short connection"],
        provenance: {
          system: "qa-fixture",
          recordId: `ep-rec-${bagTag}`,
          observedAt: new Date(dayBase).toISOString(),
          validUntil: new Date(now + 4 * HOUR_MS).toISOString(),
        },
      });
    }
  }
}

const fixtureData = {
  generatedAt: new Date(now).toISOString(),
  validUntil: new Date(now + 4 * HOUR_MS).toISOString(),
  referenceNow: new Date(now).toISOString(),
  source: "qa-fixture",
  episodes,
  eligibleTransfers,
  counterfactualAssumptions: {
    counterfactualModelVersion: "cf-cathay-v2.1",
    missedConnectionBaselineRate: 0.92,
    methodologyNote: "Historical non-intervened cohort miss rate at HKG hub",
    provenance: {
      system: "qa-fixture",
      recordId: "cf-model-spec",
      observedAt: new Date(now).toISOString(),
      validUntil: new Date(now + 4 * HOUR_MS).toISOString(),
    },
  },
  laborAssumptions: {
    minutesSavedPerHandledCase: 10.4,
    methodologyNote: "Time-motion study per avoided baggage trace & delivery incident",
    provenance: {
      system: "qa-fixture",
      recordId: "labor-spec",
      observedAt: new Date(now).toISOString(),
      validUntil: new Date(now + 4 * HOUR_MS).toISOString(),
    },
  },
  costAssumptions: {
    currency: "HKD",
    costPerAvoidedMisconnection: 1075,
    methodologyNote: "Passenger compensation & expedited courier delivery unit baseline",
    provenance: {
      system: "qa-fixture",
      recordId: "cost-spec",
      observedAt: new Date(now).toISOString(),
      validUntil: new Date(now + 4 * HOUR_MS).toISOString(),
    },
  },
};

const directory = path.join(process.cwd(), ".next", "qa-fixtures");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "recovery-performance.json"), JSON.stringify(fixtureData, null, 2));
console.log(`Recovery QA fixture written: ${episodes.length} episodes, ${eligibleTransfers.length} eligible transfers.`);
