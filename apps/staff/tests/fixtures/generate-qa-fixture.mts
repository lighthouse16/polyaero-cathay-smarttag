// Explicit local QA generator. No runtime or production import of fixture factory.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { transferFixture, fixtureNow } from "./transferFixture.ts";

const fixture = transferFixture();
const shift = Date.now() - fixtureNow.getTime();
const shifted = JSON.parse(JSON.stringify(fixture), (_key, value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)
    ? new Date(Date.parse(value) + shift).toISOString() : value);
const now = Date.now();
function extendValidity(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "validUntil" && typeof child === "string") (value as Record<string, unknown>)[key] = new Date(now + 4 * 60 * 60_000).toISOString();
    else extendValidity(child);
  }
}
extendValidity(shifted);
for (const leg of shifted.legs) {
  const tz = leg.origin === "BKK" ? "Asia/Bangkok" : leg.origin === "SIN" ? "Asia/Singapore" : "Asia/Hong_Kong";
  leg.operatingDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(leg.scheduledDepartureAt));
}
const directory = path.join(process.cwd(), ".next", "qa-fixtures");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "transfer-control.json"), JSON.stringify(shifted, null, 2));
console.log(`QA fixture written: ${shifted.bags.length} bags, 28 + 18 connections. Source test-only; expires in four hours.`);
