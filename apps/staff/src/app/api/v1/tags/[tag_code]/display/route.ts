import { NextRequest, NextResponse } from "next/server";
import { GET as getBaggageHandler } from "../../../baggage/[[...path]]/route";

export const dynamic = "force-dynamic";

interface BaggageRecord {
  tag_code?: string;
  tag_number?: string;
  flight_number?: string;
  departure_airport?: string;
  arrival_airport?: string;
  passenger_name?: string;
  cabin_class?: string;
  weight_kg?: number;
  status?: string;
  eink_banner?: string;
  is_rush_bag?: boolean;
  updated_at?: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tag_code: string }> },
): Promise<NextResponse> {
  const { tag_code: rawTagCode } = await context.params;
  if (!rawTagCode) {
    return NextResponse.json({ detail: "Tag not registered" }, { status: 404 });
  }

  // ponytail: In-process invocation of baggage GET handler. Backed by same local store, avoids HTTP self-fetch.
  // Upgrade path: Shared baggage repository service across API routes.
  const baggageRes = await getBaggageHandler(req, {
    params: Promise.resolve({ path: [] }),
  });
  if (!baggageRes.ok) {
    return NextResponse.json(
      { detail: "Failed to query baggage store" },
      { status: 500 },
    );
  }

  const bags = (await baggageRes.json()) as BaggageRecord[];
  const normalized = decodeURIComponent(rawTagCode).trim().toUpperCase();
  const bag = bags.find(
    (b) =>
      b.tag_code?.trim().toUpperCase() === normalized ||
      b.tag_number?.trim().toUpperCase() === normalized,
  );

  if (!bag) {
    return NextResponse.json({ detail: "Tag not registered" }, { status: 404 });
  }

  // Exact payload fields matching FastAPI main tags.py
  return NextResponse.json({
    tag_code: bag.tag_code,
    bag_number: bag.tag_number,
    flight: bag.flight_number,
    origin: bag.departure_airport,
    destination: bag.arrival_airport,
    passenger: bag.passenger_name,
    cabin: bag.cabin_class,
    weight_kg: bag.weight_kg,
    status: bag.status,
    banner: bag.eink_banner,
    is_rush: bag.is_rush_bag,
    updated_at: bag.updated_at,
  });
}
