import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateTransferSnapshot } from "../../../../lib/transferControl";
import type { TransferControlSnapshot } from "../../../../lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // ponytail: upstream transfer manifest/assessment adapter not supplied; no legacy demo-store join.
  const snapshot: TransferControlSnapshot = {
    availability: "unavailable", generatedAt: new Date().toISOString(), validUntil: null,
    source: "operational-transfer-source-unconfigured",
    missingInputs: ["authorized_transfer_manifest", "flight_operating_date_and_schedule", "independent_flight_and_bag_risk", "latest_intervention_deadline", "transfer_success_population"],
    bags: [], legs: [], connections: [], flightRisks: [], bagRisks: [], transferSuccess: null,
  };
  // Explicit local QA only. Fixed test-file path, never caller-controlled and never production.
  if (process.env.NODE_ENV !== "production" && process.env.STAFF_QA_FIXTURE === "1") {
    try {
      const file = path.join(process.cwd(), ".next", "qa-fixtures", "transfer-control.json");
      const fixture = validateTransferSnapshot(JSON.parse(await readFile(file, "utf8")));
      return NextResponse.json(fixture, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ detail: "Transfer-control source unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
