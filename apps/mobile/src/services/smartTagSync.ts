import type { NfcSyncOutcome, SmartTagPayload } from '@polyaero/shared';
import { apiRequest, SmartTagPreparation, TripCard } from './api';

export interface OwnedSyncBag {
  id: string;
  tag_id: string;
  tag_number: string;
  tag_code: string;
  flight_id: string;
  booking_reference: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  passenger_name: string;
  weight_kg: number;
  status: string;
  is_tag_synced: boolean;
  events: { id: string; timestamp: string; event_type: string }[];
}

export function buildOwnedBagPayload(bag: OwnedSyncBag): SmartTagPayload {
  if (!bag || !bag.id || !bag.tag_id || !Array.isArray(bag.events) || !Number.isFinite(bag.weight_kg) || bag.weight_kg < 0 || !/^\d{10}$/.test(bag.tag_number) || !/^(?:[0-9A-F]{2}:){6}[0-9A-F]{2}$/i.test(bag.tag_code) ||
      !bag.flight_id || !bag.booking_reference || typeof bag.passenger_name !== 'string' || !bag.passenger_name.trim() || !bag.flight_number || !/^[A-Z]{3}$/.test(bag.departure_airport) ||
      !/^[A-Z]{3}$/.test(bag.arrival_airport) || !Number.isFinite(Date.parse(bag.departure_time))) {
    throw new Error('This booking needs a registered physical SmartTag and server-issued 10-digit baggage barcode.');
  }
  return {
    tagUid: bag.tag_code,
    baggageTagNumber: bag.tag_number,
    flightNumber: bag.flight_number,
    originAirport: bag.departure_airport,
    destinationAirport: bag.arrival_airport,
    passengerInitials: bag.passenger_name.split(/[\s/]+/).filter(Boolean).map((part) => part[0]).join(''),
    departureDate: bag.departure_time.slice(0, 10),
    barcodeSymbology: 'INTERLEAVED_2_OF_5',
  };
}

export function selectOwnedSyncBag(rows: OwnedSyncBag[], prepared: SmartTagPreparation, trip: TripCard): OwnedSyncBag {
  if (!prepared.ready || !prepared.tag_id || prepared.booking_id !== trip.booking_id || prepared.pnr !== trip.pnr) {
    throw new Error('Complete check-in and bind a registered SmartTag to this booking first.');
  }
  if (!Array.isArray(rows)) throw new Error('Server returned invalid baggage records.');
  const matches = rows.filter((bag) => bag?.tag_id === prepared.tag_id && bag.booking_reference === prepared.pnr &&
    bag.flight_number === trip.flight_number && bag.departure_airport === trip.origin_code &&
    bag.arrival_airport === trip.destination_code && Date.parse(bag.departure_time) === Date.parse(trip.departure_time));
  if (matches.length !== 1) throw new Error('A unique owned baggage record is required. Ask staff to check this booking’s tag binding.');
  buildOwnedBagPayload(matches[0]);
  return matches[0];
}

export async function acknowledgePhysicalSync(outcome: NfcSyncOutcome, bag: OwnedSyncBag, signal?: AbortSignal): Promise<OwnedSyncBag> {
  if (signal?.aborted) throw new Error('SmartTag screen left before server confirmation.');
  const ownedPayload = buildOwnedBagPayload(bag);
  const payload = outcome.payload;
  if (outcome.finalState !== 'SUCCESS' || outcome.mode !== 'PHYSICAL_HARDWARE' ||
      outcome.setupState !== 'PHYSICALLY_WRITTEN_AND_VERIFIED' || !outcome.writeRecord?.verifiedHardwareReadback ||
      outcome.writeRecord.tagUid.toUpperCase() !== bag.tag_code.toUpperCase() ||
      payload.tagUid.toUpperCase() !== bag.tag_code.toUpperCase() || payload.baggageTagNumber !== bag.tag_number ||
      payload.flightNumber !== bag.flight_number || payload.originAirport !== bag.departure_airport ||
      payload.destinationAirport !== bag.arrival_airport || payload.departureDate !== bag.departure_time.slice(0, 10) ||
      payload.passengerInitials !== ownedPayload.passengerInitials || payload.barcodeSymbology !== ownedPayload.barcodeSymbology) {
    throw new Error('Only a verified physical write matching this owned baggage can be saved.');
  }
  const saved = await apiRequest<OwnedSyncBag>('/baggage/sync', {
    method: 'POST',
    body: JSON.stringify({ tag_code: bag.tag_code, tag_number: bag.tag_number, flight_id: bag.flight_id,
      weight_kg: bag.weight_kg, sync_status: 'SYNCHRONIZED' }),
  }, true);
  if (signal?.aborted) throw new Error('SmartTag screen left before server confirmation.');
  const latest = saved?.events?.[saved.events.length - 1];
  if (!saved || saved.id !== bag.id || saved.tag_id !== bag.tag_id || saved.tag_code?.toUpperCase() !== bag.tag_code.toUpperCase() || saved.tag_number !== bag.tag_number ||
      saved.flight_id !== bag.flight_id || saved.booking_reference !== bag.booking_reference || saved.is_tag_synced !== true ||
      saved.flight_number !== bag.flight_number || saved.departure_airport !== bag.departure_airport ||
      saved.arrival_airport !== bag.arrival_airport || Date.parse(saved.departure_time) !== Date.parse(bag.departure_time) ||
      !['TAGGED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'ON_CAROUSEL', 'COLLECTED', 'MISROUTED', 'MISSING', 'RECOVERY_IN_PROGRESS'].includes(saved.status) ||
      latest?.event_type !== 'SYNCHRONIZED' || !latest.id || !Number.isFinite(Date.parse(latest.timestamp)) ||
      bag.events.some((event) => event.id === latest.id)) {
    throw new Error('Server did not confirm this SmartTag sync. Retry saving; no new NFC write is needed.');
  }
  return saved;
}

export async function getOwnedSyncBag(tagCode: string, tagNumber: string): Promise<OwnedSyncBag> {
  const bag = await apiRequest<OwnedSyncBag>(`/baggage/${encodeURIComponent(tagCode)}`, {}, true);
  buildOwnedBagPayload(bag);
  if (bag.tag_code?.toUpperCase() !== tagCode.toUpperCase() || bag.tag_number !== tagNumber) {
    throw new Error('Server baggage identity differs from the selected SmartTag. Open the live booking instead.');
  }
  return bag;
}
