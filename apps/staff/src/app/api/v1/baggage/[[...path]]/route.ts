import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const dynamic = 'force-dynamic';

interface BaggageEventItem {
  id: string;
  event_type: string;
  timestamp: string;
  location_code: string;
  station_name: string;
  handled_by_staff_id?: string | null;
  scanner_type: string;
  notes?: string;
}

interface LiveBag {
  id: string;
  tag_number: string;
  tag_code: string;
  tag_interface?: string;
  booking_reference: string;
  passenger_name: string;
  tier_status: string;
  cabin_class: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time?: string;
  seat_number: string;
  weight_kg: number;
  connection_minutes?: number;
  status: string;
  is_tag_synced?: boolean;
  last_known_location: string;
  carousel_assigned: string;
  is_rush_bag: boolean;
  risk_score: number;
  risk_level: string;
  risk_factors?: string[];
  passenger_risk_summary?: string;
  predicted_arrival_time?: string;
  model_version?: string;
  recommended_action: string;
  copilot_approval_status?: string;
  passenger_recovery_choice?: string | null;
  recovery_flight_number?: string | null;
  recovery_eta?: string | null;
  delivery_address?: string | null;
  eink_banner: string;
  updated_at: string;
  events: BaggageEventItem[];
}

interface FlightRiskFeatures {
  flight_number: string;
  origin: string;
  destination: string;
  transfer_minutes?: number;
  weather_severity?: number;
  load_factor_pct?: number;
  airport_congestion?: number;
  tier_status?: string;
}

interface FlightRiskAssessment {
  model_version: string;
  risk_score: number;
  risk_level: string;
  priority_sequence: number;
  recommended_action: string;
  passenger_summary: string;
  predicted_arrival_time: string;
  carousel_estimate: string;
  factors: string[];
}

const STORE_FILE = path.join(os.tmpdir(), 'polyaero_demo_bags_v1.json');

function createInitialBags(): Record<string, LiveBag> {
  const now = new Date().toISOString();
  return {
    '0160892012': {
      id: 'bag_01',
      tag_number: '0160892012',
      tag_code: '04:A2:3B:4C:5D:6E:70',
      tag_interface: 'SMARTTAG_EINK_EXCLUSIVE',
      booking_reference: 'CX7K9M',
      passenger_name: 'CHAN/TIMOTHY',
      tier_status: 'DIAMOND',
      cabin_class: 'PRIORITY J',
      flight_number: 'CX888',
      departure_airport: 'HKG',
      arrival_airport: 'YVR',
      departure_time: '2026-11-14T16:30:00Z',
      seat_number: '12A',
      weight_kg: 22.4,
      connection_minutes: 95,
      status: 'LOADED',
      is_tag_synced: true,
      last_known_location: 'HKG-T1-GATE-36-ULD-AK7291',
      carousel_assigned: 'Carousel 7',
      is_rush_bag: false,
      risk_score: 24,
      risk_level: 'LOW',
      recommended_action: 'STANDARD DIGITAL ITINERARY FLOW',
      copilot_approval_status: 'AUTO_CLEARED',
      passenger_recovery_choice: null,
      eink_banner: 'ON TRACK',
      updated_at: now,
      events: [
        {
          id: 'evt_01',
          event_type: 'TAGGED',
          timestamp: '2026-11-14T11:00:00Z',
          location_code: 'HKG-APP',
          station_name: 'Cathay Mobile Check-In & Risk Scan',
          scanner_type: 'NFC_TAP',
          notes: 'Check-in risk evaluated (Score 24/100 LOW); Diamond SmartTag synced',
        },
        {
          id: 'evt_02',
          event_type: 'CHECKED_IN',
          timestamp: '2026-11-14T14:15:00Z',
          location_code: 'HKG-T1-DROP-04',
          station_name: 'Self Bag Drop Counter 4',
          scanner_type: 'OPTICAL_BARCODE',
          notes: 'Biometric face match + scale weight 22.4 kg verified',
        },
        {
          id: 'evt_03',
          event_type: 'LOADED',
          timestamp: '2026-11-14T15:45:00Z',
          location_code: 'HKG-GATE-36-RAMP',
          station_name: 'Baggage Makeup Ramp Gate 36',
          scanner_type: 'NFC_TAP',
          notes: 'Loaded into Container AK7291 for CX888',
        },
      ],
    },
    '0160892014': {
      id: 'bag_03',
      tag_number: '0160892014',
      tag_code: '04:B3:7C:1D:9E:2F:81',
      tag_interface: 'DIGITAL_APP_TAG',
      booking_reference: 'CX4M1P',
      passenger_name: 'WONG/VICTOR',
      tier_status: 'GOLD',
      cabin_class: 'BUSINESS',
      flight_number: 'CX255',
      departure_airport: 'HKG',
      arrival_airport: 'NRT',
      departure_time: '2026-11-14T08:15:00Z',
      seat_number: '14K',
      weight_kg: 28.5,
      connection_minutes: 35,
      status: 'MISROUTED',
      is_tag_synced: true,
      last_known_location: 'HKG-TRANSFER-STAGING-AREA',
      carousel_assigned: 'Carousel 2',
      is_rush_bag: true,
      risk_score: 82,
      risk_level: 'HIGH_PRIORITY',
      recommended_action: 'APPROVE RAMP INTERCEPT & OFFER PASSENGER RECOVERY OPTIONS',
      copilot_approval_status: 'PENDING_STAFF_APPROVAL',
      passenger_recovery_choice: null,
      eink_banner: 'PRIORITY TRANSFER',
      updated_at: now,
      events: [
        {
          id: 'evt_10',
          event_type: 'MISROUTED',
          timestamp: '2026-11-14T07:30:00Z',
          location_code: 'HKG-TRANSFER-STAGING-AREA',
          station_name: 'HKIA Transfer Bay 2',
          scanner_type: 'RFID_GATE',
          notes: 'Copilot flagged 35m connection risk (Score 82) — awaiting Ground Staff approval',
        },
      ],
    },
  };
}

const g = globalThis as typeof globalThis & { __polyaeroBags?: Record<string, LiveBag> };

function getBags(): Record<string, LiveBag> {
  if (!g.__polyaeroBags) {
    try {
      if (fs.existsSync(STORE_FILE)) {
        g.__polyaeroBags = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as Record<string, LiveBag>;
      }
    } catch {
      // ignore tmp read errors
    }
  }
  if (!g.__polyaeroBags) {
    g.__polyaeroBags = createInitialBags();
  }
  return g.__polyaeroBags;
}

function saveBags(bags: Record<string, LiveBag>): void {
  g.__polyaeroBags = bags;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(bags), 'utf-8');
  } catch {
    // ignore tmp write errors
  }
}

function formatUtcEta(hoursOffset: number, minutesOffset: number): string {
  const dt = new Date(Date.now() + (hoursOffset * 60 + minutesOffset) * 60_000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(dt.getUTCDate()).padStart(2, '0');
  const mon = months[dt.getUTCMonth()];
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${day} ${mon}, ${hh}:${mm} Local`;
}

function predictRisk(features: FlightRiskFeatures): FlightRiskAssessment {
  const transferMinutes = features.transfer_minutes ?? 75;
  const weatherSeverity = features.weather_severity ?? 2;
  const loadFactorPct = features.load_factor_pct ?? 85.0;
  const airportCongestion = features.airport_congestion ?? 2;

  let score = 12;
  const factors: string[] = [];

  if (transferMinutes < 45) {
    score += 42;
    factors.push(`Tight connection window (${transferMinutes} mins)`);
  } else if (transferMinutes < 70) {
    score += 20;
    factors.push(`Moderate transfer buffer (${transferMinutes} mins)`);
  } else {
    factors.push(`Healthy connection buffer (${transferMinutes} mins)`);
  }

  if (weatherSeverity >= 4) {
    score += 24;
    factors.push(`Adverse route weather (Severity ${weatherSeverity}/5)`);
  } else if (weatherSeverity === 3) {
    score += 10;
    factors.push('Moderate en-route weather');
  }

  if (airportCongestion >= 4) {
    score += 14;
    factors.push(`Peak terminal BHS congestion (${airportCongestion}/5)`);
  }

  if (loadFactorPct >= 92) {
    score += 10;
    factors.push(`High cabin/cargo load (${Math.round(loadFactorPct)}%)`);
  }

  score = Math.max(5, Math.min(98, score));

  const routeKey = `${features.origin.toUpperCase()}-${features.destination.toUpperCase()}`;
  const routeHoursMap: Record<string, number> = {
    'HKG-HND': 4.2,
    'HKG-NRT': 4.4,
    'HKG-YVR': 11.8,
    'HKG-LHR': 13.5,
    'HKG-NKG': 2.6,
  };
  const routeHours = routeHoursMap[routeKey] ?? 4.5;
  const etaStr = formatUtcEta(routeHours, 22);
  const dest = features.destination.toUpperCase();
  const carousel = dest === 'HND' || dest === 'NRT' ? 'Belt 7' : 'Belt 4';

  if (score >= 65) {
    return {
      model_version: 'cathay-bag-risk-v1.0-interface',
      risk_score: score,
      risk_level: 'HIGH_PRIORITY',
      priority_sequence: 1,
      recommended_action: 'Flag for priority tail-to-tail ramp transfer',
      passenger_summary: `High-priority transfer protection active for ${features.flight_number}.`,
      predicted_arrival_time: etaStr,
      carousel_estimate: carousel,
      factors,
    };
  }
  if (score >= 35) {
    return {
      model_version: 'cathay-bag-risk-v1.0-interface',
      risk_score: score,
      risk_level: 'MEDIUM',
      priority_sequence: 2,
      recommended_action: 'Monitor BHS sortation & standard ULD load',
      passenger_summary: `Standard transfer window on ${features.flight_number} — actively monitored.`,
      predicted_arrival_time: etaStr,
      carousel_estimate: carousel,
      factors,
    };
  }
  return {
    model_version: 'cathay-bag-risk-v1.0-interface',
    risk_score: score,
    risk_level: 'LOW',
    priority_sequence: 3,
    recommended_action: 'Normal automated BHS routing',
    passenger_summary: `Smooth connection outlook on ${features.flight_number}.`,
    predicted_arrival_time: etaStr,
    carousel_estimate: carousel,
    factors,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  const { path: segs = [] } = await context.params;
  const bags = getBags();

  if (segs.length === 0) {
    return NextResponse.json(Object.values(bags));
  }
  if (segs.length === 1) {
    const bag = bags[segs[0]];
    if (!bag) {
      return NextResponse.json({ detail: `Baggage tag ${segs[0]} not found` }, { status: 404 });
    }
    return NextResponse.json(bag);
  }
  return NextResponse.json({ detail: 'Not found' }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  const { path: segs = [] } = await context.params;
  const bags = getBags();
  const now = new Date().toISOString();

  if (segs.length === 1 && segs[0] === 'reset') {
    const fresh = createInitialBags();
    saveBags(fresh);
    return NextResponse.json(Object.values(fresh));
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (segs.length === 2 && segs[0] === 'risk' && segs[1] === 'predict') {
    return NextResponse.json(predictRisk(body as unknown as FlightRiskFeatures));
  }

  if (segs.length === 1 && segs[0] === 'sync') {
    const tagNumber = String(body.tag_number ?? '0160892012');
    const existing = bags[tagNumber];
    const events = existing ? [...existing.events] : [];
    const flightNumber = String(body.flight_number ?? 'CX548');
    const origin = String(body.departure_airport ?? 'HKG');
    const destination = String(body.arrival_airport ?? 'HND');
    const connectionMinutes = Number(body.connection_minutes ?? 85);

    const assessment = predictRisk({
      flight_number: flightNumber,
      origin,
      destination,
      transfer_minutes: connectionMinutes,
      weather_severity: Number(body.weather_severity ?? 2),
      load_factor_pct: Number(body.load_factor_pct ?? 86),
      airport_congestion: Number(body.airport_congestion ?? 2),
    });

    const statusCode = String(body.initial_status ?? 'AWAITING_SYNC').toUpperCase();
    const isSynced = statusCode !== 'AWAITING_SYNC';

    if (isSynced) {
      events.push({
        id: `evt_${randomUUID().slice(0, 6)}`,
        event_type: 'TAGGED',
        timestamp: now,
        location_code: 'MOBILE-SMARTTAG-SYNC',
        station_name: 'Cathay App SmartTag™ Sync',
        scanner_type: 'NFC_TAP',
        notes: `Tag synced · AI Risk Score ${assessment.risk_score}/100 (${assessment.risk_level})`,
      });
    } else if (events.length === 0) {
      events.push({
        id: `evt_${randomUUID().slice(0, 6)}`,
        event_type: 'AWAITING_SYNC',
        timestamp: now,
        location_code: 'BOOKING-CREATED',
        station_name: 'Flight Booked · AI Risk Evaluated',
        scanner_type: 'APP',
        notes: `AI Risk Score ${assessment.risk_score}/100 · Expected arrival ${assessment.predicted_arrival_time}`,
      });
    }

    const record: LiveBag = {
      id: existing ? existing.id : `bag_${randomUUID().slice(0, 6)}`,
      tag_number: tagNumber,
      tag_code: String(body.tag_code ?? '04:A2:3B:4C:5D:6E:70'),
      tag_interface: existing?.tag_interface ?? 'E-Ink SmartTag™',
      booking_reference: existing?.booking_reference ?? 'CX7K9M',
      passenger_name: String(body.passenger_name ?? 'TRINH/HAI DANG'),
      tier_status: existing?.tier_status ?? 'DIAMOND',
      cabin_class: String(body.cabin_class ?? 'BUSINESS'),
      flight_number: flightNumber,
      departure_airport: origin,
      arrival_airport: destination,
      departure_time: '2026-11-14T16:30:00Z',
      seat_number: existing?.seat_number ?? '12A',
      weight_kg: Number(body.weight_kg ?? 22.4),
      connection_minutes: connectionMinutes,
      status: statusCode,
      is_tag_synced: isSynced,
      last_known_location: isSynced ? 'SMARTTAG-SYNCED' : 'AWAITING-TAG-SYNC',
      carousel_assigned: assessment.carousel_estimate,
      is_rush_bag: assessment.risk_level === 'HIGH_PRIORITY',
      risk_score: assessment.risk_score,
      risk_level: assessment.risk_level,
      risk_factors: assessment.factors,
      passenger_risk_summary: assessment.passenger_summary,
      predicted_arrival_time: assessment.predicted_arrival_time,
      model_version: assessment.model_version,
      recommended_action: assessment.recommended_action,
      passenger_recovery_choice: existing?.passenger_recovery_choice ?? null,
      recovery_flight_number: existing?.recovery_flight_number ?? null,
      recovery_eta: existing?.recovery_eta ?? null,
      delivery_address: existing?.delivery_address ?? null,
      eink_banner: isSynced ? `TAG SYNCED • ${flightNumber}` : 'AWAITING TAG SYNC',
      updated_at: now,
      events,
    };
    bags[tagNumber] = record;
    saveBags(bags);
    return NextResponse.json(record);
  }

  if (segs.length === 2 && segs[1] === 'scan') {
    const tagNumber = segs[0];
    const bag = bags[tagNumber];
    if (!bag) {
      return NextResponse.json({ detail: `Baggage tag ${tagNumber} not found` }, { status: 404 });
    }
    const statusUpper = String(body.event_type ?? 'LOADED').toUpperCase();
    bag.status = statusUpper;
    bag.is_tag_synced = statusUpper !== 'AWAITING_SYNC';
    bag.last_known_location = String(body.location_code ?? 'HKG-T1-RAMP-04');
    bag.updated_at = now;

    if (statusUpper === 'MISROUTED') {
      bag.is_rush_bag = true;
      bag.risk_score = 88;
      bag.risk_level = 'HIGH_PRIORITY';
      bag.recommended_action = 'Reroute via Express Next Flight or Direct Hotel Courier';
      bag.eink_banner = 'MISROUTED • REROUTING';
    } else if (statusUpper === 'MISSING') {
      bag.is_rush_bag = true;
      bag.risk_score = 95;
      bag.risk_level = 'HIGH_PRIORITY';
      bag.recommended_action = 'Active Ramp Trace & Customer Care Escalation';
      bag.eink_banner = 'RECOVERY IN PROCESS';
    } else if (statusUpper === 'RECOVERY_IN_PROGRESS') {
      bag.is_rush_bag = true;
      bag.risk_score = 65;
      bag.risk_level = 'MEDIUM';
      bag.recommended_action = 'Executing Passenger Recovery Preference';
      bag.eink_banner = 'RECOVERY IN PROCESS';
    } else if (['LOADED', 'ARRIVED', 'COLLECTED', 'ON_CAROUSEL', 'CLAIMED'].includes(statusUpper)) {
      bag.is_rush_bag = false;
      bag.risk_score = 12;
      bag.risk_level = 'LOW';
      bag.recommended_action = 'On schedule';
      bag.eink_banner = statusUpper.replace(/_/g, ' ');
    } else {
      bag.is_rush_bag = false;
      bag.eink_banner = statusUpper.replace(/_/g, ' ');
    }

    bag.events.push({
      id: `evt_${randomUUID().slice(0, 6)}`,
      event_type: statusUpper,
      timestamp: now,
      location_code: bag.last_known_location,
      station_name: String(body.station_name ?? 'HKIA Terminal 1 Operations'),
      handled_by_staff_id: body.staff_id ? String(body.staff_id) : null,
      scanner_type: String(body.scanner_type ?? 'NFC_TAP'),
      notes: body.notes ? String(body.notes) : `Milestone updated to ${statusUpper}`,
    });
    saveBags(bags);
    return NextResponse.json(bag);
  }

  if (segs.length === 3 && segs[1] === 'risk' && segs[2] === 'apply') {
    const tagNumber = segs[0];
    const bag = bags[tagNumber];
    if (!bag) {
      return NextResponse.json({ detail: `Baggage tag ${tagNumber} not found` }, { status: 404 });
    }
    const features = body as unknown as FlightRiskFeatures;
    const assessment = predictRisk(features);
    bag.risk_score = assessment.risk_score;
    bag.risk_level = assessment.risk_level;
    bag.risk_factors = assessment.factors;
    bag.passenger_risk_summary = assessment.passenger_summary;
    bag.predicted_arrival_time = assessment.predicted_arrival_time;
    bag.carousel_assigned = assessment.carousel_estimate;
    bag.model_version = assessment.model_version;
    bag.recommended_action = assessment.recommended_action;
    bag.connection_minutes = features.transfer_minutes ?? bag.connection_minutes;
    bag.is_rush_bag = assessment.risk_level === 'HIGH_PRIORITY';
    bag.updated_at = now;
    saveBags(bags);
    return NextResponse.json(assessment);
  }

  if (segs.length === 3 && segs[1] === 'passenger' && segs[2] === 'choice') {
    const tagNumber = segs[0];
    const bag = bags[tagNumber];
    if (!bag) {
      return NextResponse.json({ detail: `Baggage tag ${tagNumber} not found` }, { status: 404 });
    }
    const choice = String(body.choice ?? 'EXPRESS_NEXT_FLIGHT');
    const origFlight = bag.flight_number || 'CX548';
    const dest = bag.arrival_airport || 'HND';

    let summary = '';
    if (choice === 'EXPRESS_NEXT_FLIGHT') {
      const nextFlight = origFlight === 'CX548' ? 'CX524' : origFlight === 'CX888' ? 'CX890' : 'CX257';
      const etaStr = formatUtcEta(4, 35);
      bag.recovery_flight_number = nextFlight;
      bag.recovery_eta = `${etaStr} (${dest} Belt 4)`;
      bag.delivery_address = null;
      bag.eink_banner = `EXPRESS ${nextFlight} • ${dest}`;
      summary = `Rebooked onto ${nextFlight} · Estimated arrival: ${etaStr}`;
    } else {
      const cleanAddr = String(body.hotel_address ?? '').trim() || 'Mandarin Oriental, Tokyo (Concierge Desk)';
      const etaStr = formatUtcEta(6, 15);
      bag.recovery_flight_number = origFlight;
      bag.recovery_eta = `Courier delivery by ${etaStr}`;
      bag.delivery_address = cleanAddr;
      bag.eink_banner = 'COURIER • HOTEL DELIVERY';
      summary = `Courier dispatched to ${cleanAddr} · ETA: ${etaStr}`;
    }

    bag.passenger_recovery_choice = choice;
    bag.status = 'RECOVERY_IN_PROGRESS';
    bag.updated_at = now;
    bag.events.push({
      id: `evt_${randomUUID().slice(0, 6)}`,
      event_type: 'RECOVERY_IN_PROGRESS',
      timestamp: now,
      location_code: 'PASSENGER-APP',
      station_name: 'Cathay App Recovery Preference',
      scanner_type: 'APP',
      notes: summary,
    });
    saveBags(bags);
    return NextResponse.json(bag);
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 });
}
