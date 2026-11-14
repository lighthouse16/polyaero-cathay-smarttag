import { API_BASE_URL } from './apiConfig';

export const COPILOT_API_BASE = API_BASE_URL;

let activePassengerTagNumber = '0160892012';
let activePassengerTagCode = '04:A2:3B:4C:5D:6E:70';
let activePassengerName = 'TRINH/HAI DANG';

export function getActivePassengerTag(): string {
  return activePassengerTagNumber;
}

export function setActivePassengerTag(tagNumber: string, tagCode?: string) {
  if (tagNumber) {
    activePassengerTagNumber = tagNumber.replace(/\s+/g, '');
  }
  if (tagCode) {
    activePassengerTagCode = tagCode;
  }
}

export function setActivePassengerIdentity(params: {
  familyName?: string;
  givenName?: string;
  membershipNumber?: string;
  tagNumber?: string;
  tagCode?: string;
}) {
  const family = (params.familyName || 'TRINH').trim().toUpperCase();
  const given = (params.givenName || 'HAI DANG').trim().toUpperCase();
  activePassengerName = `${family}/${given}`;

  if (params.tagNumber) {
    activePassengerTagNumber = params.tagNumber.replace(/\s+/g, '');
  } else if (params.membershipNumber) {
    activePassengerTagNumber = params.membershipNumber.replace(/\s+/g, '');
  }
  if (params.tagCode) {
    activePassengerTagCode = params.tagCode;
  }
  return {
    tagNumber: activePassengerTagNumber,
    tagCode: activePassengerTagCode,
    passengerName: activePassengerName,
  };
}

export interface LiveCopilotBag {
  tag_number: string;
  tag_code: string;
  booking_reference: string;
  passenger_name: string;
  tier_status: string;
  cabin_class: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  weight_kg: number;
  connection_minutes?: number;
  status: string;
  is_tag_synced?: boolean;
  carousel_assigned?: string;
  is_rush_bag: boolean;
  risk_score: number;
  risk_level: string;
  risk_factors?: string[];
  passenger_risk_summary?: string;
  predicted_arrival_time?: string;
  model_version?: string;
  recommended_action: string;
  passenger_recovery_choice?: string | null;
  recovery_flight_number?: string | null;
  recovery_eta?: string | null;
  delivery_address?: string | null;
  eink_banner: string;
  events: Array<{
    id: string;
    event_type: string;
    timestamp: string;
    station_name: string;
    notes?: string;
  }>;
}

export async function syncBookingToCopilot(params: {
  tagNumber?: string;
  tagCode?: string;
  passengerName?: string;
  flightNumber: string;
  origin: string;
  destination: string;
  cabinClass?: string;
  connectionMinutes?: number;
  initialStatus?: 'AWAITING_SYNC' | 'TAGGED';
}): Promise<LiveCopilotBag | null> {
  if (params.tagNumber) {
    setActivePassengerTag(params.tagNumber, params.tagCode);
  }
  try {
    const res = await fetch(`${COPILOT_API_BASE}/baggage/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_number: activePassengerTagNumber,
        tag_code: activePassengerTagCode,
        passenger_name: (params.passengerName || activePassengerName).toUpperCase(),
        flight_number: params.flightNumber,
        departure_airport: params.origin,
        arrival_airport: params.destination,
        cabin_class: params.cabinClass || 'BUSINESS',
        weight_kg: 22.4,
        connection_minutes: params.connectionMinutes ?? 80,
        initial_status: params.initialStatus || 'AWAITING_SYNC',
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLiveCopilotBag(tagNumber?: string): Promise<LiveCopilotBag | null> {
  const target = (tagNumber || activePassengerTagNumber).replace(/\s+/g, '');
  try {
    const res = await fetch(`${COPILOT_API_BASE}/baggage/${target}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function choosePassengerRecovery(
  choice: 'EXPRESS_NEXT_FLIGHT' | 'DIRECT_HOTEL_DELIVERY',
  hotelAddress?: string,
  tagNumber?: string
): Promise<LiveCopilotBag | null> {
  const target = (tagNumber || activePassengerTagNumber).replace(/\s+/g, '');
  try {
    const res = await fetch(`${COPILOT_API_BASE}/baggage/${target}/passenger/choice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        choice,
        hotel_address: hotelAddress || null,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface SmartTagTapPayload {
  tagUid: string;
  baggageTagNumber: string;
  flightNumber: string;
  originAirport: string;
  destinationAirport: string;
  passengerInitials: string;
  departureDate: string;
  status: string;
  timestamp: number;
}

export async function postSmartTagTap(
  tagUid: string,
  payload: SmartTagTapPayload,
  readerId = 'MOBILE-APP',
  locationCode = 'HKG-CHECKIN'
): Promise<{ success: boolean; display?: any }> {
  try {
    const ndefPayload = JSON.stringify({
      v: 1,
      tag_code: tagUid,
      booking: 'unknown',
      flight: payload.flightNumber,
      route: `${payload.originAirport}-${payload.destinationAirport}`,
      barcode: payload.baggageTagNumber,
      status: payload.status,
      at: payload.timestamp,
    });

    const res = await fetch(`${COPILOT_API_BASE}/tags/${tagUid}/tap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reader_id: readerId,
        location_code: locationCode,
        ndef_payload: ndefPayload,
      }),
    });

    if (!res.ok) {
      console.error('[SmartTagTap] API error:', res.status, await res.text());
      return { success: false };
    }

    const data = await res.json();
    return { success: true, display: data.display };
  } catch (err) {
    console.error('[SmartTagTap] Network error:', err);
    return { success: false };
  }
}
