import type { Baggage, BaggageEvent, BaggageStatus, ScanMethod } from '@polyaero/shared';

export interface StatusChangeInput {
  status: BaggageStatus;
  staffId: string;
  stationName: string;
  scanner: ScanMethod;
  notes?: string;
}

/**
 * Applies a status change and returns the updated bag plus its audit event.
 * Pure function: it does not mutate the input bag.
 * When the FastAPI endpoints are live, only this layer should need to change.
 */
export function applyStatusChange(
  bag: Baggage,
  input: StatusChangeInput,
  now: Date = new Date()
): { bag: Baggage; event: BaggageEvent } {
  const timestamp = now.toISOString();

  const updatedBag: Baggage = {
    ...bag,
    currentStatus: input.status,
    lastScannedAt: timestamp,
  };

  const event: BaggageEvent = {
    id: crypto.randomUUID(),
    baggageId: bag.id,
    eventType: input.status,
    timestamp,
    locationCode: bag.lastKnownLocation,
    stationName: input.stationName,
    handledByStaffId: input.staffId,
    scannerType: input.scanner,
    notes: input.notes,
  };

  return { bag: updatedBag, event };
}

/** Returns one bag's history, newest first. */
export function eventsForBag(events: BaggageEvent[], baggageId: string): BaggageEvent[] {
  return events
    .filter((e) => e.baggageId === baggageId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
