import type { Baggage, Flight, BaggageStatus } from '@polyaero/shared';

// Status codes the tag shows. Other statuses use their own name.
const TAG_STATUS_CODES: Partial<Record<BaggageStatus, string>> = {
  MISSING: 'RECOVERY_IN_PROGRESS',
  MISROUTED: 'PRIORITY_TRANSFER',
};

export function tagStatusCode(status: BaggageStatus): string {
  return TAG_STATUS_CODES[status] ?? status;
}

/** The short message the handheld writes to the tag. Keep it small. */
export interface TagPayload {
  bagId: string;
  route: string;
  statusCode: string;
  lastUpdated: string;
}

export function buildTagPayload(
  bag: Baggage,
  flight: Flight | undefined,
  now: Date = new Date()
): TagPayload {
  return {
    bagId: bag.tagNumber,
    route: flight ? `${flight.origin} → ${flight.destination}` : 'UNKNOWN ROUTE',
    statusCode: tagStatusCode(bag.currentStatus),
    lastUpdated: now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  };
}

/**
 * Stands in for a real NFC write. A real tap takes a short moment,
 * so we wait a bit to show the "writing" state in the UI.
 */
export function simulateTapWrite(delayMs = 1200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
