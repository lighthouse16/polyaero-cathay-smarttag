/**
 * PolyAero Cathay SmartTag Domain Models
 * Core shared types across Mobile App, Staff Portal, and Supabase Backend.
 */

export type CathayTier = 'GREEN' | 'SILVER' | 'GOLD' | 'DIAMOND';

export interface Passenger {
  id: string;
  bookingReference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  membershipNumber?: string;
  tierStatus: CathayTier;
  createdAt: string;
}

export type FlightStatus =
  | 'SCHEDULED'
  | 'CHECK_IN_OPEN'
  | 'BOARDING'
  | 'DEPARTED'
  | 'IN_AIR'
  | 'ARRIVED'
  | 'DELAYED'
  | 'CANCELLED';

export interface Flight {
  id: string;
  flightNumber: string; // e.g. "CX888"
  airlineCode: string;  // "CX"
  origin: string;       // "HKG"
  originCity: string;   // "Hong Kong"
  destination: string;  // "YVR"
  destinationCity: string; // "Vancouver"
  scheduledDeparture: string;
  scheduledArrival: string;
  estimatedDeparture?: string;
  terminal?: string;
  gate?: string;
  baggageCarousel?: string;
  status: FlightStatus;
}

export type CabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

export interface Booking {
  id: string;
  bookingReference: string; // 6-character PNR e.g. "CX7K9M"
  passengerId: string;
  flightId: string;
  cabinClass: CabinClass;
  seatNumber: string;
  ticketNumber: string;
  createdAt: string;
}

export type EinkStatus = 'READY' | 'SYNCHRONIZING' | 'UPDATED' | 'LOW_POWER' | 'ERROR';

export interface SmartTag {
  id: string;
  tagUid: string;            // NFC chip UID e.g. "04:A2:3B:4C:5D:6E:70"
  hardwareVersion: string;   // "E-INK-2.9-V2"
  firmwareVersion: string;   // "1.2.4"
  batteryLevel: number;      // 0 - 100 (%)
  einkDisplayStatus: EinkStatus;
  linkedBaggageId?: string;
  isNfcLocked: boolean;
  lastSyncAt: string;
  createdAt: string;
}

export type BaggageStatus =
  | 'TAGGED'           // Tag linked via passenger mobile app
  | 'CHECKED_IN'       // Dropped at bag drop
  | 'SECURITY_CLEARED' // Screened by airport security
  | 'SORTED'           // Directed to flight sorting lane
  | 'LOADED'           // Loaded into ULD/aircraft hold
  | 'IN_FLIGHT'        // Aircraft in transit
  | 'UNLOADED'         // Offloaded at destination
  | 'ON_CAROUSEL'      // Placed on baggage reclaim carousel
  | 'CLAIMED'          // Claimed by passenger
  | 'MISROUTED'        // Routed to wrong flight/transfer
  | 'MISSING';         // Not detected at expected milestone

export interface Baggage {
  id: string;
  tagNumber: string;         // IATA 10-digit barcode string e.g. "0160892012"
  smartTagId?: string;       // Linked physical SmartTag UID
  bookingReference: string;
  passengerId: string;
  flightId: string;
  weightKg: number;
  currentStatus: BaggageStatus;
  lastKnownLocation: string; // Airport code or gate e.g. "HKG-T1-BAGGAGE-MAKEUP"
  lastScannedAt: string;
  carouselAssigned?: string;
  isRushBag: boolean;
  notes?: string;
}

export type ScanMethod = 'NFC_TAP' | 'OPTICAL_BARCODE' | 'RFID_GATE' | 'MANUAL_OVERRIDE';

export interface BaggageEvent {
  id: string;
  baggageId: string;
  eventType: BaggageStatus;
  timestamp: string;
  locationCode: string;
  stationName: string;
  handledByStaffId?: string;
  scannerType: ScanMethod;
  notes?: string;
}

export type RecoveryCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RecoveryCaseStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'LOCATED'
  | 'ON_FORWARDING_FLIGHT'
  | 'READY_FOR_COLLECTION'
  | 'COURIER_DISPATCHED'
  | 'RESOLVED';

export interface RecoveryCase {
  id: string;
  caseNumber: string;        // e.g. "REC-2026-0812"
  baggageId: string;
  passengerId: string;
  priority: RecoveryCasePriority;
  status: RecoveryCaseStatus;
  reportedLocation: string;
  currentLocation?: string;
  forwardingFlightNumber?: string;
  deliveryAddress?: string;
  staffNotes: string;
  createdAt: string;
  updatedAt: string;
}
