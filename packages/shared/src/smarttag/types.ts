/**
 * PolyAero Cathay SmartTag — Passenger Flow Domain & State Contracts (Phase 2)
 *
 * Separates the four independent state dimensions required by the specification:
 *   1. Booking / check-in readiness (`CheckInReadiness`)
 *   2. SmartTag & E-ink provisioning (`SmartTagSetupState`)
 *   3. Airport baggage operations (`BaggageOperationsState`)
 *   4. Baggage recovery (`RecoveryProgressState`)
 *
 * Reuses core domain contracts from `../types/domain` (`Booking`, `Flight`,
 * `SmartTag`, `Baggage`, `BaggageEvent`, `RecoveryCase`, `BaggageStatus`,
 * `RecoveryCaseStatus`).
 */

import {
  Booking,
  Flight,
  SmartTag,
  Baggage,
  BaggageEvent,
  RecoveryCase,
  BaggageStatus,
  RecoveryCaseStatus,
} from '../types/domain';
import { SmartTagPayload } from '../services/nfc';

// ---------------------------------------------------------------------------
// 1. Booking / Check-in Readiness Dimension
// ---------------------------------------------------------------------------

export type CheckInReadiness =
  | 'CHECK_IN_PENDING'
  | 'DEMO_CHECK_IN_COMPLETED';

export interface PassengerItinerary {
  id: string;
  booking: Booking;
  flight: Flight;
  /** Formatted display date matching Cathay mobile cards, e.g. "Fri 21 Nov 2026" */
  travelDateDisplay: string;
  /** Short ISO departure date for NFC payload, e.g. "2026-11-21" */
  departureDateIso: string;
  departureTimeDisplay: string;
  arrivalTimeDisplay: string;
  durationDisplay: string;
  passengerCount: number;
  passengerFullName: string;
  passengerInitials: string;
  checkedBagAllowance: number;
  checkInReadiness: CheckInReadiness;
  isSyntheticDemo: boolean;
}

// ---------------------------------------------------------------------------
// 2. SmartTag & E-ink Provisioning Dimension
// ---------------------------------------------------------------------------

export type SmartTagSetupState =
  | 'UNREGISTERED'
  | 'LINKED'
  | 'PENDING_PHYSICAL_WRITE'
  | 'SIMULATED_WRITE_COMPLETED'
  | 'PHYSICALLY_WRITTEN_AND_VERIFIED'
  | 'WRITE_FAILED';

export type SyncExecutionMode = 'SIMULATED_DEMO' | 'PHYSICAL_HARDWARE';

export interface SmartTagDeclarations {
  /** Check-in prerequisite acknowledged / completed in demo */
  checkInConfirmed: boolean;
  /** Dangerous goods declaration & baggage rules acknowledged (prototype acknowledgement only) */
  dangerousGoodsDeclared: boolean;
  /** Passenger confirms tag will remain securely attached until collection */
  tagSecuredToLuggage: boolean;
  /** Passenger understands acceptance & weighing occur at the airport self bag-drop */
  airportAcceptanceUnderstood: boolean;
}

export interface SmartTagWriteRecord {
  mode: SyncExecutionMode;
  timestamp: string;
  bytesWritten: number;
  tagUid: string;
  verifiedHardwareReadback: boolean;
}

/**
 * Distinct permanent SmartTag hardware device owned by a passenger.
 * `smartTagCode` (e.g. "ST-2048") is the permanent human-readable device ID printed on
 * the reusable tag enclosure; `tagUid` is the ISO 14443-A 7-byte UID.
 * Neither may be confused with `baggageLicensePlate` / `displayBagCode`, which are
 * per-journey baggage identities.
 */
export interface OwnedSmartTagDevice {
  smartTagCode: string; // e.g. "ST-2048"
  smartTag: SmartTag;
}

/**
 * Per-bag journey setup record. Each checked bag gets its own unique baggage identity
 * and its own SmartTag device assignment — multiple bags never share a barcode.
 */
export interface BagSetupRecord {
  id: string;
  itineraryId: string;
  bagIndex: number; // 1-based index within the booking (Bag 1, Bag 2)
  /** Permanent reusable SmartTag device code, e.g. "ST-2048" */
  smartTagCode: string;
  /** Underlying shared SmartTag domain entity */
  smartTag: SmartTag;
  /** Underlying shared Baggage domain entity (holds 10-digit IATA `tagNumber`) */
  baggage: Baggage;
  /**
   * Journey-specific Cathay display bag code shown on passenger screens
   * (e.g. "CX880123456" for Bag 1). Paired 1:1 with the 10-digit IATA license plate
   * in `baggage.tagNumber` (e.g. "0160123456").
   */
  displayBagCode: string;
  setupState: SmartTagSetupState;
  declarations: SmartTagDeclarations;
  preparedAt: string | null;
  lastWrite: SmartTagWriteRecord | null;
  lastError: SmartTagFailureInfo | null;
}

// ---------------------------------------------------------------------------
// 3. Airport Baggage Operations Dimension
// ---------------------------------------------------------------------------

export type BaggageOperationsState =
  | 'AWAITING_BAG_DROP'
  | 'ACCEPTED'
  | 'LOADED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'COLLECTED'
  | 'EXCEPTION';

export type BaggageEventSource =
  | 'PASSENGER_APP'
  | 'AIRPORT_KIOSK_SIMULATED'
  | 'STAFF_PORTAL_SIMULATED'
  | 'LIVE_BACKEND';

export interface RecordedBaggageEvent extends BaggageEvent {
  source: BaggageEventSource;
  isSimulated: boolean;
}

// ---------------------------------------------------------------------------
// 4. Recovery Dimension
// ---------------------------------------------------------------------------

export type RecoveryProgressState =
  | 'NO_ISSUE'
  | 'CASE_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'BAGGAGE_LOCATED'
  | 'RECOVERY_ARRANGED'
  | 'RESOLVED';

export type BaggageIssueType =
  | 'DELAYED'
  | 'NOT_LOCATED'
  | 'TAG_DAMAGED_OR_UNREADABLE'
  | 'GENERAL_ASSISTANCE';

export interface CreateRecoveryCaseInput {
  itineraryId: string;
  bagSetupId: string;
  issueType: BaggageIssueType;
  description: string;
  contactEmail: string;
  contactPhone?: string;
  lastSeenLocation?: string;
}

export interface PassengerRecoveryRecord {
  recoveryCase: RecoveryCase;
  itineraryId: string;
  bagSetupId: string;
  issueType: BaggageIssueType;
  passengerDescription: string;
  contactEmail: string;
  contactPhone?: string;
  progressState: RecoveryProgressState;
  isSimulatedDemo: boolean;
}

// ---------------------------------------------------------------------------
// 5. NFC State Machine (Screen 03)
// ---------------------------------------------------------------------------

export type NfcSyncMachineState =
  | 'IDLE'
  | 'CHECKING_AVAILABILITY'
  | 'READY_TO_SCAN'
  | 'SCANNING'
  | 'TAG_DETECTED'
  | 'WRITING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNSUPPORTED';

export type SmartTagErrorCode =
  | 'NFC_UNAVAILABLE'
  | 'NFC_DISABLED'
  | 'NFC_TIMEOUT'
  | 'NFC_CANCELLED'
  | 'NFC_WRITE_FAILED'
  | 'NFC_WRONG_TAG'
  | 'NFC_UNVERIFIED_READBACK'
  | 'NFC_OPERATION_IN_PROGRESS'
  | 'INVALID_PAYLOAD'
  | 'HARDWARE_DRIVER_NOT_INSTALLED';

export interface SmartTagFailureInfo {
  code: SmartTagErrorCode;
  title: string;
  message: string;
  recoveryHint: string;
  canRetry: boolean;
  canSwitchToDemo: boolean;
  canOpenSettings: boolean;
}

export interface NfcSyncStepUpdate {
  state: NfcSyncMachineState;
  statusMessage: string;
  isSimulated: boolean;
  detectedUid?: string;
  failure?: SmartTagFailureInfo;
}

export interface NfcSyncOutcome {
  finalState: NfcSyncMachineState;
  setupState: SmartTagSetupState;
  mode: SyncExecutionMode;
  writeRecord: SmartTagWriteRecord | null;
  failure: SmartTagFailureInfo | null;
  payload: SmartTagPayload;
}

// ---------------------------------------------------------------------------
// 6. Journey Timeline Model (Screen 05)
// ---------------------------------------------------------------------------

export type JourneyMilestoneState =
  | 'completed'
  | 'current'
  | 'pending'
  | 'delayed'
  | 'exception';

export interface JourneyTimelineItem {
  key: string;
  title: string;
  subtitle: string;
  state: JourneyMilestoneState;
  timestamp: string | null;
  locationCode: string | null;
  sourceLabel: string | null;
  isSimulated: boolean;
}

export interface BaggageJourneyView {
  bag: BagSetupRecord;
  itinerary: PassengerItinerary;
  operationsState: BaggageOperationsState;
  statusBadgeLabel: string;
  statusBadgeTone: 'jade' | 'amber' | 'red' | 'neutral';
  lastUpdatedAt: string | null;
  isSimulated: boolean;
  items: JourneyTimelineItem[];
  recovery: PassengerRecoveryRecord | null;
}

// ---------------------------------------------------------------------------
// 7. My Bookings Entry Resolution (Screen 01)
// ---------------------------------------------------------------------------

export type BookingEntryActionKind =
  | 'SET_UP_SMARTTAG'
  | 'CONTINUE_SETUP'
  | 'VIEW_SMARTTAG'
  | 'COMPLETE_PREREQUISITE';

export interface BookingSmartTagEntryState {
  actionKind: BookingEntryActionKind;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  statusBadgeLabel: string | null;
  statusBadgeTone: 'jade' | 'amber' | 'red' | 'neutral';
  supportingCopy: string;
  isSimulatedSetup: boolean;
  missingPrerequisiteMessage: string | null;
  targetRoute: 'prepare' | 'sync' | 'result' | 'journey';
}

export const NFC_STATE_MESSAGES: Record<NfcSyncMachineState, string> = {
  IDLE: 'Ready to start NFC synchronization',
  CHECKING_AVAILABILITY: 'Checking NFC availability…',
  READY_TO_SCAN: 'Ready to scan',
  SCANNING: 'Hold your phone near the tag',
  TAG_DETECTED: 'SmartTag detected',
  WRITING: 'Updating display…',
  VERIFYING: 'Verifying tag…',
  SUCCESS: 'SmartTag updated',
  FAILED: 'Could not update SmartTag',
  CANCELLED: 'NFC synchronization cancelled',
  UNSUPPORTED: 'Physical E-ink NFC driver unavailable in this build',
};

export function mapRecoveryStatusToProgress(status: RecoveryCaseStatus): RecoveryProgressState {
  switch (status) {
    case 'OPEN':
      return 'CASE_SUBMITTED';
    case 'INVESTIGATING':
      return 'UNDER_REVIEW';
    case 'LOCATED':
      return 'BAGGAGE_LOCATED';
    case 'ON_FORWARDING_FLIGHT':
    case 'READY_FOR_COLLECTION':
    case 'COURIER_DISPATCHED':
      return 'RECOVERY_ARRANGED';
    case 'RESOLVED':
      return 'RESOLVED';
  }
}

export function deriveOperationsState(events: RecordedBaggageEvent[]): BaggageOperationsState {
  if (events.length === 0) return 'AWAITING_BAG_DROP';
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const latest = sorted[sorted.length - 1].eventType;
  return mapBaggageStatusToOps(latest);
}

export function mapBaggageStatusToOps(status: BaggageStatus): BaggageOperationsState {
  switch (status) {
    case 'TAGGED':
      return 'AWAITING_BAG_DROP';
    case 'CHECKED_IN':
    case 'SECURITY_CLEARED':
    case 'SORTED':
      return 'ACCEPTED';
    case 'LOADED':
      return 'LOADED';
    case 'IN_FLIGHT':
      return 'IN_TRANSIT';
    case 'UNLOADED':
    case 'ON_CAROUSEL':
      return 'ARRIVED';
    case 'CLAIMED':
      return 'COLLECTED';
    case 'MISROUTED':
    case 'MISSING':
      return 'EXCEPTION';
  }
}
