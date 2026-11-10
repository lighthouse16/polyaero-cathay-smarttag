import type {
  Baggage,
  BaggageEvent,
  BaggageStatus,
  RecoveryCase,
  ScanMethod,
} from '@polyaero/shared';

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

/** True if this bag already has a recovery case that isn't resolved. */
export function hasOpenCase(cases: RecoveryCase[], baggageId: string): boolean {
  return cases.some((c) => c.baggageId === baggageId && c.status !== 'RESOLVED');
}

/** Opens a high-priority recovery case for a bag that has gone missing. */
export function openRecoveryCase(
  bag: Baggage,
  reportedLocation: string,
  now: Date = new Date()
): RecoveryCase {
  const timestamp = now.toISOString();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));

  return {
    id: crypto.randomUUID(),
    caseNumber: `REC-${now.getUTCFullYear()}-${suffix}`,
    baggageId: bag.id,
    passengerId: bag.passengerId,
    priority: 'HIGH',
    status: 'OPEN',
    reportedLocation,
    staffNotes: 'Opened automatically when bag was marked MISSING.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * What the passive E-ink tag would show for a status.
 * Returns null when the tag shows its normal route display.
 */
export function tagDisplayMessage(status: BaggageStatus): string | null {
  if (status === 'MISSING') return 'RECOVERY IN PROGRESS';
  if (status === 'MISROUTED') return 'PRIORITY TRANSFER';
  return null;
}
