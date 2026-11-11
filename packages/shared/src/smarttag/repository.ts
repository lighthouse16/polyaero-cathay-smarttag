/**
 * PolyAero Cathay SmartTag — Passenger Repository, Demo Fixtures & State Store
 *
 * Implements `SmartTagRepository` with an in-memory deterministic store and an
 * optional key-value persistence adapter (used with `localStorage` on web; pure
 * in-memory on React Native without native storage dependencies).
 *
 * Also documents the `SupabaseSmartTagRepository` integration boundary so a
 * live backend can replace the in-memory store without rewriting screens.
 */

import {
  Baggage,
  BaggageStatus,
  Booking,
  Flight,
  RecoveryCase,
  RecoveryCaseStatus,
  SmartTag,
} from '../types/domain';
import { SmartTagPayload } from '../services/nfc';
import {
  BagSetupRecord,
  BaggageJourneyView,
  BookingSmartTagEntryState,
  CreateRecoveryCaseInput,
  JourneyMilestoneState,
  JourneyTimelineItem,
  NfcSyncOutcome,
  OwnedSmartTagDevice,
  PassengerItinerary,
  PassengerRecoveryRecord,
  RecordedBaggageEvent,
  SmartTagDeclarations,
  deriveOperationsState,
  mapRecoveryStatusToProgress,
} from './types';

// ---------------------------------------------------------------------------
// Synthetic Demo Fixture — CX548 HKG → NRT, 21 November 2026, PNR 8K3F7D
// ---------------------------------------------------------------------------

export const DEMO_BOOKING_REFERENCE = '8K3F7D';
export const DEMO_ITINERARY_ID = 'itin-cx548-hkg-nrt';
export const DEMO_PASSENGER_ID = 'pass_demo_cx548';
export const DEMO_FLIGHT_ID = 'flt_cx548_20261121';

export const DEMO_FLIGHT_CX548: Flight = {
  id: DEMO_FLIGHT_ID,
  flightNumber: 'CX548',
  airlineCode: 'CX',
  origin: 'HKG',
  originCity: 'Hong Kong',
  destination: 'NRT',
  destinationCity: 'Tokyo',
  scheduledDeparture: '2026-11-21T08:40:00Z',
  scheduledArrival: '2026-11-21T13:55:00Z',
  terminal: 'Terminal 1',
  gate: 'Gate 24',
  baggageCarousel: 'Carousel 5',
  status: 'CHECK_IN_OPEN',
};

export const DEMO_BOOKING_CX548: Booking = {
  id: 'book_cx548_8k3f7d',
  bookingReference: DEMO_BOOKING_REFERENCE,
  passengerId: DEMO_PASSENGER_ID,
  flightId: DEMO_FLIGHT_ID,
  cabinClass: 'ECONOMY',
  seatNumber: '32A',
  ticketNumber: '160-8801234560',
  createdAt: '2026-11-01T09:00:00Z',
};

export const DEMO_ITINERARY_CX548: PassengerItinerary = {
  id: DEMO_ITINERARY_ID,
  booking: DEMO_BOOKING_CX548,
  flight: DEMO_FLIGHT_CX548,
  travelDateDisplay: 'Fri 21 Nov 2026',
  departureDateIso: '2026-11-21',
  departureTimeDisplay: '08:40',
  arrivalTimeDisplay: '13:55',
  durationDisplay: '4h 15m',
  passengerCount: 1,
  passengerFullName: 'Trinh Hai Dang',
  passengerInitials: 'H.T.',
  checkedBagAllowance: 2,
  checkInReadiness: 'DEMO_CHECK_IN_COMPLETED',
  isSyntheticDemo: true,
};

/**
 * Distinct physical SmartTag devices owned by the passenger in the demo.
 * Each has its own permanent `smartTagCode` (`ST-2048`, `ST-2051`) and its own
 * 7-byte ISO 14443-A `tagUid`. Both start `UNPROGRAMMED` with `lastWrittenAt: null`.
 */
export const DEMO_OWNED_SMARTTAGS: OwnedSmartTagDevice[] = [
  {
    smartTagCode: 'ST-2048',
    smartTag: {
      id: 'tag_st_2048',
      tagUid: '04:A2:3B:4C:5D:6E:70',
      hardwareModel: 'PolyAero-Passive-2.9in',
      powerSource: 'PASSIVE_RF',
      einkDisplayStatus: 'UNPROGRAMMED',
      barcodeSymbology: 'INTERLEAVED_2_OF_5',
      linkedBaggageId: undefined,
      isWriteProtected: false,
      lastWrittenAt: null,
      createdAt: '2026-11-01T00:00:00Z',
    },
  },
  {
    smartTagCode: 'ST-2051',
    smartTag: {
      id: 'tag_st_2051',
      tagUid: '04:B3:7C:1D:9E:2F:81',
      hardwareModel: 'PolyAero-Passive-2.9in',
      powerSource: 'PASSIVE_RF',
      einkDisplayStatus: 'UNPROGRAMMED',
      barcodeSymbology: 'INTERLEAVED_2_OF_5',
      linkedBaggageId: undefined,
      isWriteProtected: false,
      lastWrittenAt: null,
      createdAt: '2026-11-01T00:00:00Z',
    },
  },
];

export const DEFAULT_DECLARATIONS: SmartTagDeclarations = {
  checkInConfirmed: true,
  dangerousGoodsDeclared: true,
  tagSecuredToLuggage: true,
  airportAcceptanceUnderstood: true,
};

/**
 * Deterministic baggage identity allocator.
 * - Bag 1 on CX548 gets display code `CX880123456` and 10-digit IATA license plate `0160123456`
 *   (matching Design 03/04/05 mockups).
 * - Bag 2 gets a distinct display code `CX880123457` and 10-digit IATA license plate `0160123457`.
 * - Any additional bag increments the serial so two bags never share a barcode.
 */
export function allocateBaggageIdentity(
  flightNumber: string,
  bagIndex: number
): { displayBagCode: string; licensePlate10Digit: string } {
  const baseSerial = 123456 + Math.max(0, bagIndex - 1);
  const serial6 = String(baseSerial).padStart(6, '0').slice(-6);
  const cleanFlightPrefix = flightNumber.toUpperCase().startsWith('CX') ? 'CX880' : 'CX881';
  return {
    displayBagCode: `${cleanFlightPrefix}${serial6}`,
    licensePlate10Digit: `0160${serial6}`,
  };
}

export function areDeclarationsComplete(decl: SmartTagDeclarations): boolean {
  return (
    decl.checkInConfirmed &&
    decl.dangerousGoodsDeclared &&
    decl.tagSecuredToLuggage &&
    decl.airportAcceptanceUnderstood
  );
}

export function buildNfcPayloadForBag(
  itinerary: PassengerItinerary,
  bag: BagSetupRecord
): SmartTagPayload {
  return {
    tagUid: bag.smartTag.tagUid,
    baggageTagNumber: bag.baggage.tagNumber,
    flightNumber: itinerary.flight.flightNumber,
    originAirport: itinerary.flight.origin,
    destinationAirport: itinerary.flight.destination,
    passengerInitials: itinerary.passengerInitials,
    departureDate: itinerary.departureDateIso,
    barcodeSymbology: bag.smartTag.barcodeSymbology,
  };
}

// ---------------------------------------------------------------------------
// My Bookings Entry State Resolver (Screen 01)
// ---------------------------------------------------------------------------

export function resolveBookingSmartTagEntry(
  itinerary: PassengerItinerary,
  bags: BagSetupRecord[]
): BookingSmartTagEntryState {
  if (itinerary.checkInReadiness === 'CHECK_IN_PENDING') {
    return {
      actionKind: 'COMPLETE_PREREQUISITE',
      primaryCtaLabel: 'Set up SmartTag',
      secondaryCtaLabel: 'View baggage journey',
      statusBadgeLabel: 'Check-in required',
      statusBadgeTone: 'amber',
      supportingCopy:
        'Check-in must be completed before preparing your reusable SmartTag.',
      isSimulatedSetup: false,
      missingPrerequisiteMessage:
        'Online check-in is not yet completed for this booking. Complete check-in to continue.',
      targetRoute: 'prepare',
    };
  }

  const primaryBag = bags[0];
  if (!primaryBag || primaryBag.setupState === 'UNREGISTERED') {
    return {
      actionKind: 'SET_UP_SMARTTAG',
      primaryCtaLabel: 'Set up SmartTag',
      secondaryCtaLabel: 'View baggage journey',
      statusBadgeLabel: null,
      statusBadgeTone: 'neutral',
      supportingCopy:
        'Set up your reusable digital baggage tag before heading to the airport.',
      isSimulatedSetup: false,
      missingPrerequisiteMessage: null,
      targetRoute: 'prepare',
    };
  }

  if (primaryBag.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED') {
    return {
      actionKind: 'VIEW_SMARTTAG',
      primaryCtaLabel: 'View SmartTag',
      secondaryCtaLabel: 'View baggage journey',
      statusBadgeLabel: `${primaryBag.smartTagCode} • Synced`,
      statusBadgeTone: 'jade',
      supportingCopy: `Bag ID ${primaryBag.displayBagCode} is written to SmartTag ${primaryBag.smartTagCode}.`,
      isSimulatedSetup: false,
      missingPrerequisiteMessage: null,
      targetRoute: 'result',
    };
  }

  if (primaryBag.setupState === 'SIMULATED_WRITE_COMPLETED') {
    return {
      actionKind: 'VIEW_SMARTTAG',
      primaryCtaLabel: 'View SmartTag',
      secondaryCtaLabel: 'View baggage journey',
      statusBadgeLabel: `${primaryBag.smartTagCode} • Synced`,
      statusBadgeTone: 'jade',
      supportingCopy: `Bag ID ${primaryBag.displayBagCode} is written to SmartTag ${primaryBag.smartTagCode}.`,
      isSimulatedSetup: false,
      missingPrerequisiteMessage: null,
      targetRoute: 'result',
    };
  }

  if (primaryBag.setupState === 'WRITE_FAILED') {
    return {
      actionKind: 'CONTINUE_SETUP',
      primaryCtaLabel: 'Continue setup',
      secondaryCtaLabel: 'View baggage journey',
      statusBadgeLabel: 'Sync failed — retry needed',
      statusBadgeTone: 'red',
      supportingCopy:
        'Baggage identity is prepared, but the last NFC display write did not complete.',
      isSimulatedSetup: false,
      missingPrerequisiteMessage: null,
      targetRoute: 'sync',
    };
  }

  // LINKED or PENDING_PHYSICAL_WRITE
  return {
    actionKind: 'CONTINUE_SETUP',
    primaryCtaLabel: 'Continue setup',
    secondaryCtaLabel: 'View baggage journey',
    statusBadgeLabel: 'Awaiting NFC sync',
    statusBadgeTone: 'amber',
    supportingCopy: `Bag ID ${primaryBag.displayBagCode} is prepared for ${primaryBag.smartTagCode}. Complete NFC sync to update the tag.`,
    isSimulatedSetup: false,
    missingPrerequisiteMessage: null,
    targetRoute: 'sync',
  };
}

// ---------------------------------------------------------------------------
// Baggage Journey Timeline Builder (Screen 05)
// ---------------------------------------------------------------------------

function formatShortTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function buildBaggageJourneyView(
  itinerary: PassengerItinerary,
  bag: BagSetupRecord,
  events: RecordedBaggageEvent[],
  recovery: PassengerRecoveryRecord | null
): BaggageJourneyView {
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const opsState = deriveOperationsState(sortedEvents);
  const isSynced =
    bag.setupState === 'SIMULATED_WRITE_COMPLETED' ||
    bag.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED';
  const isSimulated =
    bag.lastWrite?.mode === 'SIMULATED_DEMO' ||
    sortedEvents.some((e) => e.isSimulated) ||
    itinerary.isSyntheticDemo;

  const findEvent = (...types: BaggageStatus[]): RecordedBaggageEvent | undefined =>
    sortedEvents.find((e) => types.includes(e.eventType));

  const checkInEvt = findEvent('CHECKED_IN', 'SECURITY_CLEARED', 'SORTED');
  const loadedEvt = findEvent('LOADED', 'IN_FLIGHT');
  const arrivedEvt = findEvent('UNLOADED', 'ON_CAROUSEL');
  const collectedEvt = findEvent('CLAIMED');
  const exceptionEvt = findEvent('MISROUTED', 'MISSING');

  // Determine which milestone is currently active so future ones remain pending.
  const syncDone = isSynced;
  const acceptedDone = Boolean(checkInEvt);
  const loadedDone = Boolean(loadedEvt);
  const arrivedDone = Boolean(arrivedEvt);
  const collectedDone = Boolean(collectedEvt);

  const items: JourneyTimelineItem[] = [];

  // 1. Tag synced
  const syncSubtitle = !syncDone
    ? bag.preparedAt
      ? `Prepared for ${bag.smartTagCode} • Awaiting NFC sync`
      : 'Complete SmartTag setup to generate bag identity'
    : 'Completed at home';

  items.push({
    key: 'tag_synced',
    title: 'Tag synced',
    subtitle: syncSubtitle,
    state: syncDone ? 'completed' : bag.preparedAt ? 'current' : 'pending',
    timestamp: bag.lastWrite?.timestamp ?? bag.preparedAt,
    locationCode: itinerary.flight.origin,
    sourceLabel: syncDone ? 'NFC sync' : null,
    isSimulated: false,
  });

  // 2. Bag accepted
  const acceptTime = checkInEvt ? formatShortTime(checkInEvt.timestamp) : null;
  const acceptState: JourneyMilestoneState = acceptedDone
    ? 'completed'
    : syncDone && !exceptionEvt
      ? 'current'
      : 'pending';
  items.push({
    key: 'bag_accepted',
    title: 'Bag accepted',
    subtitle: acceptedDone
      ? `${itinerary.flight.originCity} self bag-drop${acceptTime ? ` • ${acceptTime}` : ''}`
      : `${itinerary.flight.originCity} self bag-drop • Awaiting drop-off`,
    state: acceptState,
    timestamp: checkInEvt?.timestamp ?? null,
    locationCode: checkInEvt?.locationCode ?? itinerary.flight.origin,
    sourceLabel: checkInEvt
      ? checkInEvt.isSimulated
        ? 'Simulated airport scan'
        : 'Airport bag-drop'
      : null,
    isSimulated: Boolean(checkInEvt?.isSimulated),
  });

  // 3. Loaded onto aircraft
  const loadedState: JourneyMilestoneState = loadedDone
    ? 'completed'
    : acceptedDone && !arrivedDone && !exceptionEvt
      ? 'current'
      : 'pending';
  items.push({
    key: 'loaded_aircraft',
    title: 'Loaded onto aircraft',
    subtitle: loadedDone
      ? `${itinerary.flight.flightNumber} • Confirmed`
      : `${itinerary.flight.flightNumber} • Pending ramp loading`,
    state: loadedState,
    timestamp: loadedEvt?.timestamp ?? null,
    locationCode: loadedEvt?.locationCode ?? itinerary.flight.origin,
    sourceLabel: loadedEvt
      ? loadedEvt.isSimulated
        ? 'Simulated ramp scan'
        : 'Ramp handling'
      : null,
    isSimulated: Boolean(loadedEvt?.isSimulated),
  });

  // 4. Arrived in destination (Note: flight landing alone never marks this completed)
  let arrivedState: JourneyMilestoneState = 'pending';
  let arrivedSubtitle = `${itinerary.flight.destination} • Pending arrival scan`;
  if (exceptionEvt) {
    arrivedState = exceptionEvt.eventType === 'MISSING' ? 'exception' : 'delayed';
    arrivedSubtitle =
      exceptionEvt.notes ||
      `${itinerary.flight.destination} • Delayed / requires baggage assistance`;
  } else if (arrivedDone) {
    arrivedState = collectedDone ? 'completed' : 'completed';
    arrivedSubtitle = `${itinerary.flight.destination} • Awaiting collection`;
  } else if (loadedDone) {
    arrivedState = 'current';
    arrivedSubtitle = `In transit to ${itinerary.flight.destinationCity} (${itinerary.flight.destination})`;
  }

  items.push({
    key: 'arrived_destination',
    title: `Arrived in ${itinerary.flight.destinationCity}`,
    subtitle: arrivedSubtitle,
    state: arrivedState,
    timestamp: (exceptionEvt ?? arrivedEvt)?.timestamp ?? null,
    locationCode: (exceptionEvt ?? arrivedEvt)?.locationCode ?? itinerary.flight.destination,
    sourceLabel: exceptionEvt
      ? 'Baggage exception'
      : arrivedEvt
        ? arrivedEvt.isSimulated
          ? 'Simulated arrival scan'
          : 'Destination baggage hall'
        : null,
    isSimulated: Boolean((exceptionEvt ?? arrivedEvt)?.isSimulated),
  });

  // 5. Collected
  items.push({
    key: 'collected',
    title: 'Collected',
    subtitle: collectedDone ? 'Collected by passenger' : 'Not yet completed',
    state: collectedDone ? 'completed' : 'pending',
    timestamp: collectedEvt?.timestamp ?? null,
    locationCode: collectedEvt?.locationCode ?? itinerary.flight.destination,
    sourceLabel: collectedEvt ? 'Passenger confirmation' : null,
    isSimulated: Boolean(collectedEvt?.isSimulated),
  });

  // Status badge at top of Summary Card
  let statusBadgeLabel = 'Not synced';
  let statusBadgeTone: 'jade' | 'amber' | 'red' | 'neutral' = 'neutral';

  if (recovery && recovery.progressState !== 'RESOLVED') {
    statusBadgeLabel = 'Recovery open';
    statusBadgeTone = 'amber';
  } else if (opsState === 'EXCEPTION') {
    statusBadgeLabel = 'Delayed';
    statusBadgeTone = 'red';
  } else if (opsState === 'COLLECTED') {
    statusBadgeLabel = 'Collected';
    statusBadgeTone = 'jade';
  } else if (
    opsState === 'ACCEPTED' ||
    opsState === 'LOADED' ||
    opsState === 'IN_TRANSIT' ||
    opsState === 'ARRIVED'
  ) {
    statusBadgeLabel = 'In journey';
    statusBadgeTone = 'jade';
  } else if (isSynced) {
    statusBadgeLabel = 'Awaiting bag-drop';
    statusBadgeTone = 'jade';
  } else if (bag.preparedAt) {
    statusBadgeLabel = 'Awaiting sync';
    statusBadgeTone = 'amber';
  }

  const lastEventTime =
    sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].timestamp : null;

  return {
    bag,
    itinerary,
    operationsState: opsState,
    statusBadgeLabel,
    statusBadgeTone,
    lastUpdatedAt: lastEventTime ?? bag.lastWrite?.timestamp ?? bag.preparedAt,
    isSimulated,
    items,
    recovery,
  };
}

// ---------------------------------------------------------------------------
// Repository Contract & Storage Adapter
// ---------------------------------------------------------------------------

export interface KeyValueStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  isPersistedToDisk?(key: string): boolean;
  getLastStorageError?(): string | null;
  readonly isMemoryOnlyFallback?: boolean;
}

export interface PersistenceCommitResult {
  committed: boolean;
  persisted: boolean;
  error: string | null;
}

export class StoragePersistenceError extends Error {
  public readonly code = 'STORAGE_WRITE_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'StoragePersistenceError';
  }
}

export interface NdefRevisionState {
  lastCommittedRev: number;
  lastCommittedTimestamp: string;
  lastCommittedBagId?: string;
  lastCommittedContentSignature?: string;
  lastCommittedPayload?: string;
  lastCommittedPhysicalUid?: string;
}

export interface SmartTagRepositorySnapshot {
  version: number;
  itineraries: PassengerItinerary[];
  ownedTags: OwnedSmartTagDevice[];
  bagSetupsByItinerary: Record<string, BagSetupRecord[]>;
  eventsByBagId: Record<string, RecordedBaggageEvent[]>;
  recoveryByBagSetupId: Record<string, PassengerRecoveryRecord>;
  ndefRevisionsByTagKey?: Record<string, NdefRevisionState>;
  activeItineraryId: string | null;
  activeBagSetupId: string | null;
}

export type SmartTagStoreListener = () => void;

export type SmartTagScreenRoute =
  | 'bookings'
  | 'prepare'
  | 'sync'
  | 'result'
  | 'journey'
  | 'report';

export interface SmartTagNavigationState {
  currentRoute: SmartTagScreenRoute;
  history: SmartTagScreenRoute[];
}

export class SmartTagFlowNavigator {
  private state: SmartTagNavigationState = {
    currentRoute: 'bookings',
    history: [],
  };
  private listeners = new Set<() => void>();

  constructor(initialRoute: SmartTagScreenRoute = 'bookings') {
    if (initialRoute !== 'bookings') {
      this.state = { currentRoute: initialRoute, history: ['bookings'] };
    }
  }

  public getState(): SmartTagNavigationState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  public navigateTo(
    route: SmartTagScreenRoute,
    options?: { replace?: boolean }
  ): SmartTagNavigationState {
    if (route === 'bookings') {
      this.state = { currentRoute: 'bookings', history: [] };
    } else if (options?.replace) {
      this.state = {
        currentRoute: route,
        history: this.state.history.length > 0 ? this.state.history : ['bookings'],
      };
    } else if (this.state.currentRoute !== route) {
      this.state = {
        currentRoute: route,
        history: [...this.state.history, this.state.currentRoute],
      };
    }
    this.emit();
    return this.state;
  }

  public goBack(): boolean {
    if (this.state.currentRoute === 'bookings') {
      return false;
    }
    const nextHistory = [...this.state.history];
    const previous = nextHistory.pop() ?? 'bookings';
    this.state = {
      currentRoute: previous,
      history: nextHistory,
    };
    this.emit();
    return true;
  }

  public reset(): void {
    this.state = { currentRoute: 'bookings', history: [] };
    this.emit();
  }
}

export interface SmartTagRepository {
  getSnapshot(): SmartTagRepositorySnapshot;
  subscribe(listener: SmartTagStoreListener): () => void;

  // Bookings & check-in
  listItineraries(): PassengerItinerary[];
  getItinerary(itineraryId: string): PassengerItinerary | undefined;
  addDemoItinerary(): PassengerItinerary;
  lookupAndAddBookingByRef(referenceOrTicket: string): {
    itinerary?: PassengerItinerary;
    errorMessage?: string;
  };
  setCheckInReadiness(
    itineraryId: string,
    readiness: PassengerItinerary['checkInReadiness']
  ): void;

  // Selection
  setActiveContext(itineraryId: string, bagSetupId?: string | null): void;

  // SmartTag preparation & sync
  getOwnedSmartTags(): OwnedSmartTagDevice[];
  getBagsForItinerary(itineraryId: string): BagSetupRecord[];
  getBagSetup(bagSetupId: string): BagSetupRecord | undefined;
  prepareBagsForItinerary(params: {
    itineraryId: string;
    bagCount: number;
    declarations: SmartTagDeclarations;
    selectedSmartTagCode?: string;
  }): { bags: BagSetupRecord[]; validationError?: string };
  pairPhysicalTagToBag(bagSetupId: string, physicalTagUid: string): BagSetupRecord;
  recordSyncOutcome(bagSetupId: string, outcome: NfcSyncOutcome): BagSetupRecord;

  // Baggage events & demo progression
  getEventsForBag(baggageId: string): RecordedBaggageEvent[];
  getJourneyView(itineraryId: string, bagSetupId?: string): BaggageJourneyView | null;
  seedDemoJourneyMilestonePreset(
    bagSetupId: string,
    preset: 'AWAITING_DROP' | 'ACCEPTED' | 'LOADED' | 'ARRIVED_TOKYO' | 'COLLECTED' | 'DELAYED'
  ): void;

  // Recovery
  getRecoveryForBag(bagSetupId: string): PassengerRecoveryRecord | null;
  createRecoveryCase(input: CreateRecoveryCaseInput): {
    record?: PassengerRecoveryRecord;
    validationError?: string;
  };
  advanceRecoveryProgress(
    bagSetupId: string,
    nextStatus: RecoveryCaseStatus,
    staffNote?: string
  ): PassengerRecoveryRecord | null;

  // Demo reset (developer-only control)
  resetDemoState(options?: { populateDemoBooking?: boolean }): void;

  // NDEF Revision Monotonic Persistence (P0)
  getNdefRevisionState(tagKey: string): NdefRevisionState | null;
  getNextNdefRevision(params: {
    smartTagCode: string;
    physicalUid?: string | null;
    bagId: string;
    flight: string;
    from: string;
    to: string;
    status: string;
  }): number;
  commitVerifiedNdefWrite(params: {
    smartTagCode: string;
    physicalUid?: string | null;
    bagId: string;
    flight: string;
    from: string;
    to: string;
    status: string;
    rev: number;
    payloadText: string;
  }): { success: boolean; error?: string };
  reconcileObservedTagRevision(params: {
    smartTagCode: string;
    physicalUid?: string | null;
    observedRev: number;
  }): number;

  // Persistence health & verification
  getLastPersistenceResult?(): PersistenceCommitResult;
}

const STORAGE_KEY = 'polyaero.smarttag.passenger.v2';

function createInitialBagSetup(
  itinerary: PassengerItinerary,
  bagIndex: number,
  ownedDevice: OwnedSmartTagDevice,
  declarations: SmartTagDeclarations,
  preparedAt: string | null,
  setupState: BagSetupRecord['setupState']
): BagSetupRecord {
  const { displayBagCode, licensePlate10Digit } = allocateBaggageIdentity(
    itinerary.flight.flightNumber,
    bagIndex
  );
  const baggageId = `bag_${itinerary.id}_${bagIndex}`;
  const smartTag: SmartTag = {
    ...ownedDevice.smartTag,
    einkDisplayStatus: 'UNPROGRAMMED',
    linkedBaggageId: setupState === 'UNREGISTERED' ? undefined : baggageId,
    lastWrittenAt: null,
  };
  const baggage: Baggage = {
    id: baggageId,
    tagNumber: licensePlate10Digit,
    smartTagId: ownedDevice.smartTag.id,
    bookingReference: itinerary.booking.bookingReference,
    passengerId: itinerary.booking.passengerId,
    flightId: itinerary.flight.id,
    weightKg: 0, // Measured at airport bag-drop scale, never by SmartTag
    currentStatus: 'TAGGED',
    lastKnownLocation: `${itinerary.flight.origin}-APP`,
    lastScannedAt: preparedAt ?? itinerary.booking.createdAt,
    carouselAssigned: itinerary.flight.baggageCarousel,
    isRushBag: false,
  };
  return {
    id: `bagsetup_${itinerary.id}_${bagIndex}`,
    itineraryId: itinerary.id,
    bagIndex,
    smartTagCode: ownedDevice.smartTagCode,
    smartTag,
    baggage,
    displayBagCode,
    setupState,
    declarations: { ...declarations },
    preparedAt,
    lastWrite: null,
    lastError: null,
    pairedPhysicalUid: null,
  };
}

export class InMemorySmartTagRepository implements SmartTagRepository {
  private state: SmartTagRepositorySnapshot;
  private listeners = new Set<SmartTagStoreListener>();
  private storage: KeyValueStorageAdapter | null;
  private caseCounter = 840;

  constructor(options?: {
    storage?: KeyValueStorageAdapter | null;
    populateDemoBookingOnInit?: boolean;
  }) {
    this.storage = options?.storage ?? null;
    const restored = this.loadFromStorage();
    if (restored) {
      this.state = restored;
    } else {
      this.state = this.buildCleanState(Boolean(options?.populateDemoBookingOnInit));
    }
  }

  private buildCleanState(populateDemoBooking: boolean): SmartTagRepositorySnapshot {
    const ownedTags: OwnedSmartTagDevice[] = DEMO_OWNED_SMARTTAGS.map((d) => ({
      smartTagCode: d.smartTagCode,
      smartTag: { ...d.smartTag },
    }));

    if (!populateDemoBooking) {
      return {
        version: 1,
        itineraries: [],
        ownedTags,
        bagSetupsByItinerary: {},
        eventsByBagId: {},
        recoveryByBagSetupId: {},
        ndefRevisionsByTagKey: {},
        activeItineraryId: null,
        activeBagSetupId: null,
      };
    }

    const itinerary: PassengerItinerary = {
      ...DEMO_ITINERARY_CX548,
      booking: { ...DEMO_BOOKING_CX548 },
      flight: { ...DEMO_FLIGHT_CX548 },
    };
    const initialBag = createInitialBagSetup(
      itinerary,
      1,
      ownedTags[0],
      DEFAULT_DECLARATIONS,
      null,
      'UNREGISTERED'
    );

    return {
      version: 1,
      itineraries: [itinerary],
      ownedTags,
      bagSetupsByItinerary: {
        [itinerary.id]: [initialBag],
      },
      eventsByBagId: {},
      recoveryByBagSetupId: {},
      ndefRevisionsByTagKey: {},
      activeItineraryId: itinerary.id,
      activeBagSetupId: initialBag.id,
    };
  }

  private loadFromStorage(): SmartTagRepositorySnapshot | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SmartTagRepositorySnapshot;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.itineraries)) {
        return null;
      }
      return {
        ...parsed,
        ndefRevisionsByTagKey: parsed.ndefRevisionsByTagKey ?? {},
      };
    } catch {
      return null;
    }
  }

  private lastCommitResult: PersistenceCommitResult = {
    committed: true,
    persisted: false,
    error: null,
  };

  public getLastPersistenceResult(): PersistenceCommitResult {
    return this.lastCommitResult;
  }

  private commit(
    next: SmartTagRepositorySnapshot,
    options?: { requireDurablePersistence?: boolean }
  ): PersistenceCommitResult {
    const prevState = this.state;
    const candidateState: SmartTagRepositorySnapshot = {
      ...next,
      version: this.state.version + 1,
    };

    if (!this.storage || this.storage.isMemoryOnlyFallback) {
      this.state = candidateState;
      this.lastCommitResult = { committed: true, persisted: false, error: null };
      this.listeners.forEach((listener) => listener());
      return this.lastCommitResult;
    }

    let persisted = true;
    let storageError: string | null = null;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(candidateState));
      if (typeof this.storage.isPersistedToDisk === 'function') {
        persisted = this.storage.isPersistedToDisk(STORAGE_KEY);
      }
      const reportedError = this.storage.getLastStorageError?.();
      if (reportedError) {
        persisted = false;
        storageError = reportedError;
      } else if (!persisted) {
        storageError = 'PERSISTENT_STORAGE_WRITE_VERIFICATION_FAILED';
      }
    } catch (err) {
      persisted = false;
      storageError = err instanceof Error ? err.message : String(err);
    }

    if (!persisted && options?.requireDurablePersistence) {
      this.state = prevState;
      this.lastCommitResult = {
        committed: false,
        persisted: false,
        error: storageError ?? 'PERSISTENT_STORAGE_WRITE_FAILED',
      };
      return this.lastCommitResult;
    }

    this.state = candidateState;
    this.lastCommitResult = {
      committed: true,
      persisted,
      error: storageError,
    };
    this.listeners.forEach((listener) => listener());
    return this.lastCommitResult;
  }

  public getSnapshot(): SmartTagRepositorySnapshot {
    return this.state;
  }

  public subscribe(listener: SmartTagStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public listItineraries(): PassengerItinerary[] {
    return this.state.itineraries;
  }

  public getItinerary(itineraryId: string): PassengerItinerary | undefined {
    return this.state.itineraries.find((i) => i.id === itineraryId);
  }

  public addDemoItinerary(): PassengerItinerary {
    const existing = this.state.itineraries.find((i) => i.id === DEMO_ITINERARY_ID);
    if (existing) {
      this.setActiveContext(existing.id);
      return existing;
    }

    const itinerary: PassengerItinerary = {
      ...DEMO_ITINERARY_CX548,
      booking: { ...DEMO_BOOKING_CX548 },
      flight: { ...DEMO_FLIGHT_CX548 },
    };
    const initialBag = createInitialBagSetup(
      itinerary,
      1,
      this.state.ownedTags[0],
      DEFAULT_DECLARATIONS,
      null,
      'UNREGISTERED'
    );

    this.commit({
      ...this.state,
      itineraries: [itinerary, ...this.state.itineraries],
      bagSetupsByItinerary: {
        ...this.state.bagSetupsByItinerary,
        [itinerary.id]: [initialBag],
      },
      activeItineraryId: itinerary.id,
      activeBagSetupId: initialBag.id,
    });
    return itinerary;
  }

  public lookupAndAddBookingByRef(referenceOrTicket: string): {
    itinerary?: PassengerItinerary;
    errorMessage?: string;
  } {
    const cleaned = referenceOrTicket.trim().toUpperCase().replace(/\s+/g, '');
    if (cleaned.length < 6) {
      return {
        errorMessage: 'Please enter a valid 6-character booking reference or 13-digit e-ticket number.',
      };
    }

    const matchesDemo =
      cleaned === DEMO_BOOKING_REFERENCE ||
      cleaned === '1608801234560' ||
      cleaned === '160-8801234560' ||
      cleaned === 'CX548';

    if (!matchesDemo) {
      return {
        errorMessage: `No booking found for "${referenceOrTicket.trim()}". Please enter booking reference ${DEMO_BOOKING_REFERENCE} (flight CX548 HKG to NRT).`,
      };
    }

    const itinerary = this.addDemoItinerary();
    return { itinerary };
  }

  public setCheckInReadiness(
    itineraryId: string,
    readiness: PassengerItinerary['checkInReadiness']
  ): void {
    const itineraries = this.state.itineraries.map((i) =>
      i.id === itineraryId ? { ...i, checkInReadiness: readiness } : i
    );
    this.commit({ ...this.state, itineraries });
  }

  public setActiveContext(itineraryId: string, bagSetupId?: string | null): void {
    const bags = this.state.bagSetupsByItinerary[itineraryId] ?? [];
    const resolvedBagId = bagSetupId ?? bags[0]?.id ?? null;
    if (
      this.state.activeItineraryId === itineraryId &&
      this.state.activeBagSetupId === resolvedBagId
    ) {
      return;
    }
    this.commit({
      ...this.state,
      activeItineraryId: itineraryId,
      activeBagSetupId: resolvedBagId,
    });
  }

  public getOwnedSmartTags(): OwnedSmartTagDevice[] {
    return this.state.ownedTags;
  }

  public getBagsForItinerary(itineraryId: string): BagSetupRecord[] {
    return this.state.bagSetupsByItinerary[itineraryId] ?? [];
  }

  public getBagSetup(bagSetupId: string): BagSetupRecord | undefined {
    for (const bags of Object.values(this.state.bagSetupsByItinerary)) {
      const found = bags.find((b) => b.id === bagSetupId);
      if (found) return found;
    }
    return undefined;
  }

  public prepareBagsForItinerary(params: {
    itineraryId: string;
    bagCount: number;
    declarations: SmartTagDeclarations;
    selectedSmartTagCode?: string;
  }): { bags: BagSetupRecord[]; validationError?: string } {
    const { itineraryId, bagCount, declarations, selectedSmartTagCode } = params;
    const itinerary = this.getItinerary(itineraryId);
    if (!itinerary) {
      return { bags: [], validationError: 'Booking could not be found.' };
    }
    if (itinerary.checkInReadiness !== 'DEMO_CHECK_IN_COMPLETED') {
      return {
        bags: [],
        validationError: 'Complete or simulate flight check-in before preparing your SmartTag.',
      };
    }
    if (!areDeclarationsComplete(declarations)) {
      return {
        bags: [],
        validationError:
          'Please confirm the dangerous goods and baggage attachment acknowledgements before continuing.',
      };
    }

    const clampedCount = Math.max(1, Math.min(bagCount, this.state.ownedTags.length));
    const existingBags = this.getBagsForItinerary(itineraryId);
    const nowIso = new Date().toISOString();

    const orderedDevices = [...this.state.ownedTags];
    if (selectedSmartTagCode) {
      orderedDevices.sort((a, b) =>
        a.smartTagCode === selectedSmartTagCode ? -1 : b.smartTagCode === selectedSmartTagCode ? 1 : 0
      );
    }

    const nextBags: BagSetupRecord[] = [];
    for (let idx = 1; idx <= clampedCount; idx++) {
      const device = orderedDevices[idx - 1] ?? orderedDevices[0];
      const prev = existingBags.find((b) => b.bagIndex === idx);
      const alreadySynced =
        prev &&
        (prev.setupState === 'SIMULATED_WRITE_COMPLETED' ||
          prev.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED') &&
        prev.smartTagCode === device.smartTagCode;

      if (alreadySynced && prev) {
        nextBags.push({
          ...prev,
          declarations: { ...declarations },
        });
      } else {
        const fresh = createInitialBagSetup(
          itinerary,
          idx,
          device,
          declarations,
          nowIso,
          'PENDING_PHYSICAL_WRITE'
        );
        nextBags.push(fresh);
      }
    }

    this.commit({
      ...this.state,
      bagSetupsByItinerary: {
        ...this.state.bagSetupsByItinerary,
        [itineraryId]: nextBags,
      },
      activeItineraryId: itineraryId,
      activeBagSetupId: nextBags[0]?.id ?? null,
    });

    return { bags: nextBags };
  }

  public pairPhysicalTagToBag(bagSetupId: string, physicalTagUid: string): BagSetupRecord {
    const existing = this.getBagSetup(bagSetupId);
    if (!existing) {
      throw new Error(`Bag setup ${bagSetupId} not found.`);
    }

    const cleanUid = physicalTagUid.trim().toUpperCase();
    const updatedSmartTag: SmartTag = {
      ...existing.smartTag,
      tagUid: cleanUid,
    };

    const updatedBag: BagSetupRecord = {
      ...existing,
      smartTag: updatedSmartTag,
      pairedPhysicalUid: cleanUid,
    };

    const list = this.getBagsForItinerary(existing.itineraryId).map((b) =>
      b.id === bagSetupId ? updatedBag : b
    );

    const commitResult = this.commit(
      {
        ...this.state,
        bagSetupsByItinerary: {
          ...this.state.bagSetupsByItinerary,
          [existing.itineraryId]: list,
        },
      },
      { requireDurablePersistence: true }
    );

    if (!commitResult.committed) {
      throw new StoragePersistenceError(
        commitResult.error ?? 'Failed to persist physical NFC pairing to durable storage.'
      );
    }

    return updatedBag;
  }

  // ---------------------------------------------------------------------------
  // NDEF Revision Monotonic Persistence (P0)
  // ---------------------------------------------------------------------------

  private getTagKeys(smartTagCode: string, physicalUid?: string | null): string[] {
    const keys: string[] = [];
    if (smartTagCode && smartTagCode.trim()) {
      keys.push(`TAG:${smartTagCode.trim().toUpperCase()}`);
    }
    if (physicalUid && physicalUid.trim()) {
      keys.push(`UID:${physicalUid.trim().toUpperCase()}`);
    }
    return keys;
  }

  public getNdefRevisionState(tagKey: string): NdefRevisionState | null {
    const store = this.state.ndefRevisionsByTagKey ?? {};
    return store[tagKey] ?? null;
  }

  public getNextNdefRevision(params: {
    smartTagCode: string;
    physicalUid?: string | null;
    bagId: string;
    flight: string;
    from: string;
    to: string;
    status: string;
  }): number {
    const store = this.state.ndefRevisionsByTagKey ?? {};
    const keys = this.getTagKeys(params.smartTagCode, params.physicalUid);

    let maxCommittedRev = 0;
    let matchedSignatureRev: number | null = null;
    const contentSig = [
      params.smartTagCode.trim().toUpperCase(),
      params.bagId.trim(),
      params.flight.trim().toUpperCase(),
      params.from.trim().toUpperCase(),
      params.to.trim().toUpperCase(),
      params.status.trim().toUpperCase().replace(/\s+/g, '_'),
    ].join('|');

    for (const key of keys) {
      const state = store[key];
      if (state) {
        if (state.lastCommittedRev > maxCommittedRev) {
          maxCommittedRev = state.lastCommittedRev;
        }
        if (state.lastCommittedContentSignature === contentSig) {
          matchedSignatureRev = state.lastCommittedRev;
        }
      }
    }

    if (maxCommittedRev === 0) {
      return 1;
    }

    // If identical content was already committed, keep the same revision (avoids needless E-paper flicker)
    if (matchedSignatureRev !== null && matchedSignatureRev === maxCommittedRev) {
      return matchedSignatureRev;
    }

    // Any content change (status, bagId, flight, etc.) monotonically increments beyond highest committed
    return maxCommittedRev + 1;
  }

  public commitVerifiedNdefWrite(params: {
    smartTagCode: string;
    physicalUid?: string | null;
    bagId: string;
    flight: string;
    from: string;
    to: string;
    status: string;
    rev?: number;
    revision?: number;
    payloadText?: string;
  }): { success: boolean; error?: string } {
    const store = { ...(this.state.ndefRevisionsByTagKey ?? {}) };
    const keys = this.getTagKeys(params.smartTagCode, params.physicalUid);
    const contentSig = [
      params.smartTagCode.trim().toUpperCase(),
      params.bagId.trim(),
      params.flight.trim().toUpperCase(),
      params.from.trim().toUpperCase(),
      params.to.trim().toUpperCase(),
      params.status.trim().toUpperCase().replace(/\s+/g, '_'),
    ].join('|');

    const effectiveRev = params.rev ?? params.revision ?? 1;
    const nextRevState: NdefRevisionState = {
      lastCommittedRev: effectiveRev,
      lastCommittedTimestamp: new Date().toISOString(),
      lastCommittedBagId: params.bagId.trim(),
      lastCommittedContentSignature: contentSig,
      lastCommittedPayload: params.payloadText ?? '',
      lastCommittedPhysicalUid: params.physicalUid ? params.physicalUid.trim().toUpperCase() : undefined,
    };

    for (const key of keys) {
      store[key] = nextRevState;
    }

    const commitRes = this.commit(
      {
        ...this.state,
        ndefRevisionsByTagKey: store,
      },
      { requireDurablePersistence: true }
    );

    if (!commitRes.committed) {
      return {
        success: false,
        error: commitRes.error ?? 'FAILED_TO_PERSIST_NDEF_REVISION',
      };
    }

    return { success: true };
  }

  public reconcileObservedTagRevision(params: {
    smartTagCode: string;
    physicalUid?: string | null;
    observedRev?: number;
    observedRevision?: number;
  }): number {
    const effObservedRev = params.observedRev ?? params.observedRevision ?? 1;
    if (effObservedRev <= 0) return 1;
    const store = { ...(this.state.ndefRevisionsByTagKey ?? {}) };
    const keys = this.getTagKeys(params.smartTagCode, params.physicalUid);

    let maxRev = effObservedRev;
    for (const key of keys) {
      const cur = store[key];
      if (cur && cur.lastCommittedRev > maxRev) {
        maxRev = cur.lastCommittedRev;
      }
    }

    const updatedState: NdefRevisionState = {
      lastCommittedRev: maxRev,
      lastCommittedTimestamp: new Date().toISOString(),
      lastCommittedPhysicalUid: params.physicalUid ? params.physicalUid.trim().toUpperCase() : undefined,
    };

    for (const key of keys) {
      store[key] = { ...(store[key] ?? {}), ...updatedState };
    }

    this.commit(
      {
        ...this.state,
        ndefRevisionsByTagKey: store,
      },
      { requireDurablePersistence: true }
    );

    return maxRev;
  }

  public recordSyncOutcome(bagSetupId: string, outcome: NfcSyncOutcome): BagSetupRecord {
    const existing = this.getBagSetup(bagSetupId);
    if (!existing) {
      throw new Error(`Bag setup ${bagSetupId} not found.`);
    }

    const isSuccess =
      outcome.setupState === 'SIMULATED_WRITE_COMPLETED' ||
      outcome.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED';

    const updatedSmartTag: SmartTag = {
      ...existing.smartTag,
      einkDisplayStatus: isSuccess
        ? 'SYNCHRONIZED'
        : outcome.setupState === 'WRITE_FAILED'
          ? 'WRITE_FAILED'
          : 'UNPROGRAMMED',
      linkedBaggageId: existing.baggage.id,
      lastWrittenAt:
        outcome.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED' && outcome.writeRecord
          ? outcome.writeRecord.timestamp
          : existing.smartTag.lastWrittenAt,
    };

    const updatedBag: BagSetupRecord = {
      ...existing,
      smartTag: updatedSmartTag,
      setupState: outcome.setupState,
      preparedAt: existing.preparedAt ?? new Date().toISOString(),
      lastWrite: outcome.writeRecord ?? existing.lastWrite,
      lastError: outcome.failure,
    };

    const list = this.getBagsForItinerary(existing.itineraryId).map((b) =>
      b.id === bagSetupId ? updatedBag : b
    );

    const existingEvents = this.state.eventsByBagId[existing.baggage.id] ?? [];
    let nextEvents = existingEvents;

    // On first successful sync, record a TAGGED event if none exists yet.
    if (isSuccess && !existingEvents.some((e) => e.eventType === 'TAGGED')) {
      const taggedEvt: RecordedBaggageEvent = {
        id: `evt_tagged_${existing.baggage.id}`,
        baggageId: existing.baggage.id,
        eventType: 'TAGGED',
        timestamp: outcome.writeRecord?.timestamp ?? new Date().toISOString(),
        locationCode: 'HKG-APP',
        stationName: 'Cathay Mobile App SmartTag Provisioning',
        scannerType: 'NFC_TAP',
        notes:
          outcome.setupState === 'SIMULATED_WRITE_COMPLETED'
            ? `Simulated SmartTag ${existing.smartTagCode} provisioned for ${existing.displayBagCode}`
            : `Verified SmartTag ${existing.smartTagCode} provisioned for ${existing.displayBagCode}`,
        source: 'PASSENGER_APP',
        isSimulated: outcome.setupState === 'SIMULATED_WRITE_COMPLETED',
      };
      nextEvents = [taggedEvt, ...existingEvents];
    }

    this.commit({
      ...this.state,
      bagSetupsByItinerary: {
        ...this.state.bagSetupsByItinerary,
        [existing.itineraryId]: list,
      },
      eventsByBagId: {
        ...this.state.eventsByBagId,
        [existing.baggage.id]: nextEvents,
      },
    });

    return updatedBag;
  }

  public getEventsForBag(baggageId: string): RecordedBaggageEvent[] {
    return this.state.eventsByBagId[baggageId] ?? [];
  }

  public getJourneyView(itineraryId: string, bagSetupId?: string): BaggageJourneyView | null {
    const itinerary = this.getItinerary(itineraryId);
    if (!itinerary) return null;
    const bags = this.getBagsForItinerary(itineraryId);
    const bag = (bagSetupId ? bags.find((b) => b.id === bagSetupId) : bags[0]) ?? bags[0];
    if (!bag) return null;
    const events = this.getEventsForBag(bag.baggage.id);
    const recovery = this.getRecoveryForBag(bag.id);
    return buildBaggageJourneyView(itinerary, bag, events, recovery);
  }

  public seedDemoJourneyMilestonePreset(
    bagSetupId: string,
    preset: 'AWAITING_DROP' | 'ACCEPTED' | 'LOADED' | 'ARRIVED_TOKYO' | 'COLLECTED' | 'DELAYED'
  ): void {
    const bag = this.getBagSetup(bagSetupId);
    if (!bag) return;
    const itinerary = this.getItinerary(bag.itineraryId);
    if (!itinerary) return;

    // Ensure tag is marked at least simulated-synced when seeding airport milestones
    let updatedBag: BagSetupRecord = bag;
    if (
      bag.setupState !== 'SIMULATED_WRITE_COMPLETED' &&
      bag.setupState !== 'PHYSICALLY_WRITTEN_AND_VERIFIED'
    ) {
      const ts = '2026-11-21T06:15:00Z';
      updatedBag = {
        ...bag,
        preparedAt: bag.preparedAt ?? ts,
        setupState: 'SIMULATED_WRITE_COMPLETED',
        lastWrite: {
          mode: 'SIMULATED_DEMO',
          timestamp: ts,
          bytesWritten: 4736,
          tagUid: bag.smartTag.tagUid,
          verifiedHardwareReadback: false,
        },
      };
    }

    const bagId = bag.baggage.id;
    const events: RecordedBaggageEvent[] = [
      {
        id: `evt_${bagId}_tagged`,
        baggageId: bagId,
        eventType: 'TAGGED',
        timestamp: '2026-11-21T06:15:00Z',
        locationCode: 'HKG-APP',
        stationName: 'Completed at home',
        scannerType: 'NFC_TAP',
        source: 'PASSENGER_APP',
        isSimulated: true,
      },
    ];

    if (
      preset === 'ACCEPTED' ||
      preset === 'LOADED' ||
      preset === 'ARRIVED_TOKYO' ||
      preset === 'COLLECTED' ||
      preset === 'DELAYED'
    ) {
      events.push({
        id: `evt_${bagId}_accepted`,
        baggageId: bagId,
        eventType: 'CHECKED_IN',
        timestamp: '2026-11-21T10:42:00Z',
        locationCode: 'HKG-T1-DROP',
        stationName: 'Hong Kong self bag-drop',
        scannerType: 'OPTICAL_BARCODE',
        notes: 'Weight measured at airport scale: 21.8 kg',
        source: 'AIRPORT_KIOSK_SIMULATED',
        isSimulated: true,
      });
    }

    if (
      preset === 'LOADED' ||
      preset === 'ARRIVED_TOKYO' ||
      preset === 'COLLECTED' ||
      preset === 'DELAYED'
    ) {
      events.push({
        id: `evt_${bagId}_loaded`,
        baggageId: bagId,
        eventType: 'LOADED',
        timestamp: '2026-11-21T11:20:00Z',
        locationCode: 'HKG-GATE-24',
        stationName: 'CX548 • Confirmed',
        scannerType: 'NFC_TAP',
        source: 'STAFF_PORTAL_SIMULATED',
        isSimulated: true,
      });
    }

    if (preset === 'ARRIVED_TOKYO' || preset === 'COLLECTED') {
      events.push({
        id: `evt_${bagId}_arrived`,
        baggageId: bagId,
        eventType: 'ON_CAROUSEL',
        timestamp: '2026-11-21T14:15:00Z',
        locationCode: 'NRT-T2-CAROUSEL-5',
        stationName: 'NRT • Awaiting collection',
        scannerType: 'RFID_GATE',
        source: 'STAFF_PORTAL_SIMULATED',
        isSimulated: true,
      });
    }

    if (preset === 'COLLECTED') {
      events.push({
        id: `evt_${bagId}_collected`,
        baggageId: bagId,
        eventType: 'CLAIMED',
        timestamp: '2026-11-21T14:32:00Z',
        locationCode: 'NRT-T2-ARRIVALS',
        stationName: 'Collected by passenger',
        scannerType: 'NFC_TAP',
        source: 'PASSENGER_APP',
        isSimulated: true,
      });
    }

    if (preset === 'DELAYED') {
      events.push({
        id: `evt_${bagId}_delayed`,
        baggageId: bagId,
        eventType: 'MISSING',
        timestamp: '2026-11-21T14:25:00Z',
        locationCode: 'NRT-T2-BAGGAGE-HALL',
        stationName: 'Not scanned at NRT carousel — tracing initiated',
        scannerType: 'MANUAL_OVERRIDE',
        notes: 'NRT • Delayed — please report a baggage issue for recovery support',
        source: 'STAFF_PORTAL_SIMULATED',
        isSimulated: true,
      });
    }

    const latestStatus = events[events.length - 1].eventType;
    updatedBag = {
      ...updatedBag,
      baggage: {
        ...updatedBag.baggage,
        currentStatus: latestStatus,
        lastKnownLocation: events[events.length - 1].locationCode,
        lastScannedAt: events[events.length - 1].timestamp,
        weightKg: preset === 'AWAITING_DROP' ? 0 : 21.8,
      },
    };

    const list = this.getBagsForItinerary(bag.itineraryId).map((b) =>
      b.id === bagSetupId ? updatedBag : b
    );

    this.commit({
      ...this.state,
      bagSetupsByItinerary: {
        ...this.state.bagSetupsByItinerary,
        [bag.itineraryId]: list,
      },
      eventsByBagId: {
        ...this.state.eventsByBagId,
        [bagId]: events,
      },
    });
  }

  public getRecoveryForBag(bagSetupId: string): PassengerRecoveryRecord | null {
    return this.state.recoveryByBagSetupId[bagSetupId] ?? null;
  }

  public createRecoveryCase(input: CreateRecoveryCaseInput): {
    record?: PassengerRecoveryRecord;
    validationError?: string;
  } {
    const bag = this.getBagSetup(input.bagSetupId);
    if (!bag) {
      return { validationError: 'Selected baggage identity could not be found.' };
    }
    const trimmedDesc = input.description.trim();
    if (trimmedDesc.length < 8) {
      return {
        validationError: 'Please provide a short description of at least 8 characters.',
      };
    }
    const trimmedEmail = input.contactEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return {
        validationError: 'Please provide a valid contact email address for recovery updates.',
      };
    }

    this.caseCounter += 1;
    const now = new Date().toISOString();
    const caseNumber = `REC-2026-${String(this.caseCounter).padStart(4, '0')}`;

    const recoveryCase: RecoveryCase = {
      id: `rec_${bag.id}_${this.caseCounter}`,
      caseNumber,
      baggageId: bag.baggage.id,
      passengerId: bag.baggage.passengerId,
      priority: input.issueType === 'NOT_LOCATED' ? 'HIGH' : 'MEDIUM',
      status: 'OPEN',
      reportedLocation: input.lastSeenLocation?.trim() || bag.baggage.lastKnownLocation || 'NRT',
      currentLocation: 'Pending baggage tracing review',
      staffNotes: `Passenger report (${input.issueType}): ${trimmedDesc}`,
      createdAt: now,
      updatedAt: now,
    };

    const record: PassengerRecoveryRecord = {
      recoveryCase,
      itineraryId: input.itineraryId,
      bagSetupId: input.bagSetupId,
      issueType: input.issueType,
      passengerDescription: trimmedDesc,
      contactEmail: trimmedEmail,
      contactPhone: input.contactPhone?.trim() || undefined,
      progressState: 'CASE_SUBMITTED',
      isSimulatedDemo: true,
    };

    this.commit({
      ...this.state,
      recoveryByBagSetupId: {
        ...this.state.recoveryByBagSetupId,
        [input.bagSetupId]: record,
      },
    });

    return { record };
  }

  public advanceRecoveryProgress(
    bagSetupId: string,
    nextStatus: RecoveryCaseStatus,
    staffNote?: string
  ): PassengerRecoveryRecord | null {
    const existing = this.state.recoveryByBagSetupId[bagSetupId];
    if (!existing) return null;

    const locationByStatus: Record<RecoveryCaseStatus, string> = {
      OPEN: existing.recoveryCase.currentLocation ?? 'Report submitted',
      INVESTIGATING: 'Baggage tracing team reviewing scan history',
      LOCATED: 'Bag located via SmartTag UID scan at transfer staging',
      ON_FORWARDING_FLIGHT: 'Assigned to next flight to NRT',
      READY_FOR_COLLECTION: 'NRT Terminal 2 Baggage Service Counter',
      COURIER_DISPATCHED: 'Local courier arranged to passenger address',
      RESOLVED: 'Baggage returned to passenger',
    };

    const updatedCase: RecoveryCase = {
      ...existing.recoveryCase,
      status: nextStatus,
      currentLocation: locationByStatus[nextStatus],
      staffNotes: staffNote ?? existing.recoveryCase.staffNotes,
      updatedAt: new Date().toISOString(),
    };

    const updatedRecord: PassengerRecoveryRecord = {
      ...existing,
      recoveryCase: updatedCase,
      progressState: mapRecoveryStatusToProgress(nextStatus),
    };

    this.commit({
      ...this.state,
      recoveryByBagSetupId: {
        ...this.state.recoveryByBagSetupId,
        [bagSetupId]: updatedRecord,
      },
    });

    return updatedRecord;
  }

  public resetDemoState(options?: { populateDemoBooking?: boolean }): void {
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    this.commit(this.buildCleanState(Boolean(options?.populateDemoBooking)));
  }
}

export const DemoSmartTagRepository = InMemorySmartTagRepository;

export interface FastApiBackendConfig {
  baseUrl?: string;
}

export interface BackendIntegrationStatus {
  baseUrl: string;
  isConfigured: boolean;
  isDeviceCompatible: boolean;
  /** True ONLY if live authenticated HTTP calls are actively made by the application layer. */
  hasActiveAppHttpCalls: boolean;
  activeMode: 'STANDALONE_DEMO' | 'LIVE_BACKEND';
  implementedAuthRoutes: readonly string[];
  unimplementedBusinessRoutes: readonly string[];
}

/**
 * FastAPI backend boundary for PolyAero SmartTag.
 * On origin/main: /api/v1/auth/* and /health are implemented, while
 * /api/v1/baggage/* and /api/v1/tags/* return HTTP 501 Not Implemented.
 * Never silently spoofs unimplemented remote writes as successful.
 */
export class ApiSmartTagRepository {
  public readonly baseUrl: string;
  public readonly implementedRoutes = [
    '/health',
    '/api/v1/auth/signup/initiate',
    '/api/v1/auth/signup/verify',
    '/api/v1/auth/signin',
    '/api/v1/auth/signin/verify',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/auth/me',
  ] as const;
  public readonly unimplementedRoutes = [
    '/api/v1/baggage',
    '/api/v1/tags',
  ] as const;

  constructor(config?: FastApiBackendConfig) {
    const raw =
      config?.baseUrl ??
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined) ??
      '';
    this.baseUrl = raw.trim().replace(/\/+$/, '');
  }

  public isConfiguredForDevice(): boolean {
    if (!this.baseUrl) return false;
    return !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(this.baseUrl);
  }

  public getIntegrationStatus(): BackendIntegrationStatus {
    const isConfigured = Boolean(this.baseUrl);
    const isDeviceCompatible = this.isConfiguredForDevice();
    return {
      baseUrl: this.baseUrl,
      isConfigured,
      isDeviceCompatible,
      // Honest boundary: mobile passenger SmartTag workflow runs via DemoSmartTagRepository;
      // no live HTTP calls are made for baggage/tags since those endpoints return HTTP 501.
      hasActiveAppHttpCalls: false,
      activeMode: 'STANDALONE_DEMO',
      implementedAuthRoutes: this.implementedRoutes,
      unimplementedBusinessRoutes: this.unimplementedRoutes,
    };
  }

  /**
   * Real HTTP client method for backend health endpoint.
   */
  public async healthCheck(): Promise<{ ok: boolean; status?: string; error?: string }> {
    if (!this.baseUrl) {
      return { ok: false, error: 'No backend API URL configured.' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) {
        return { ok: false, error: `Health check responded with HTTP ${res.status}` };
      }
      const data = (await res.json()) as { status?: string };
      return { ok: true, status: data.status ?? 'ok' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Real HTTP client method for authenticated current user endpoint.
   */
  public async fetchCurrentUser(accessToken: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    if (!this.baseUrl) {
      return { ok: false, error: 'No backend API URL configured.' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        return { ok: false, error: `Auth me responded with HTTP ${res.status}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public assertEndpointImplemented(path: string): void {
    if (path.startsWith('/api/v1/baggage') || path.startsWith('/api/v1/tags')) {
      throw new Error(
        `FastAPI endpoint ${path} returns HTTP 501 Not Implemented on origin/main; use DemoSmartTagRepository in explicit demo mode.`
      );
    }
  }
}
