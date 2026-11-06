import {
  Passenger,
  Flight,
  Booking,
  SmartTag,
  Baggage,
  BaggageEvent,
  RecoveryCase,
} from '../types/domain';

export const mockPassenger: Passenger = {
  id: 'pass_01',
  authUserId: 'usr_auth_01',
  bookingReference: 'CX7K9M',
  firstName: 'Timothy',
  lastName: 'Chan',
  email: 'timothy.chan@polyaero.test',
  phone: '+852 9123 4567',
  membershipNumber: 'CX-88392019',
  tierStatus: 'DIAMOND',
  createdAt: '2026-01-15T08:00:00Z',
};

export const mockFlights: Flight[] = [
  {
    id: 'flt_cx888',
    flightNumber: 'CX888',
    airlineCode: 'CX',
    origin: 'HKG',
    originCity: 'Hong Kong',
    destination: 'YVR',
    destinationCity: 'Vancouver',
    scheduledDeparture: '2026-11-10T16:30:00Z',
    scheduledArrival: '2026-11-10T12:45:00Z',
    terminal: 'T1',
    gate: '36',
    baggageCarousel: 'Carousel 7',
    status: 'BOARDING',
  },
  {
    id: 'flt_cx250',
    flightNumber: 'CX250',
    airlineCode: 'CX',
    origin: 'LHR',
    originCity: 'London Heathrow',
    destination: 'HKG',
    destinationCity: 'Hong Kong',
    scheduledDeparture: '2026-11-11T18:00:00Z',
    scheduledArrival: '2026-11-12T14:15:00Z',
    terminal: 'T3',
    gate: '12',
    baggageCarousel: 'Carousel 4',
    status: 'SCHEDULED',
  },
];

export const mockBooking: Booking = {
  id: 'book_01',
  bookingReference: 'CX7K9M',
  passengerId: 'pass_01',
  flightId: 'flt_cx888',
  cabinClass: 'BUSINESS',
  seatNumber: '12A',
  ticketNumber: '160-2918274019',
  createdAt: '2026-10-01T10:00:00Z',
};

// Programmed & synchronized active tag
export const mockSmartTag: SmartTag = {
  id: 'tag_01',
  tagUid: '04:A2:3B:4C:5D:6E:70',
  hardwareModel: 'PolyAero-Passive-2.9in',
  powerSource: 'PASSIVE_RF',
  einkDisplayStatus: 'SYNCHRONIZED',
  barcodeSymbology: 'INTERLEAVED_2_OF_5',
  linkedBaggageId: 'bag_01',
  isWriteProtected: true,
  lastWrittenAt: '2026-11-06T12:00:00Z',
  createdAt: '2026-03-01T00:00:00Z',
};

// Newly registered / unprogrammed tag prior to first NFC provisioning
export const mockUnprogrammedSmartTag: SmartTag = {
  id: 'tag_02',
  tagUid: '04:B3:7C:1D:9E:2F:81',
  hardwareModel: 'PolyAero-Passive-2.9in',
  powerSource: 'PASSIVE_RF',
  einkDisplayStatus: 'UNPROGRAMMED',
  barcodeSymbology: 'INTERLEAVED_2_OF_5',
  linkedBaggageId: undefined,
  isWriteProtected: false,
  lastWrittenAt: null, // Truthful initial state: NULL prior to first physical write
  createdAt: '2026-11-06T09:00:00Z',
};

export const mockBaggageList: Baggage[] = [
  {
    id: 'bag_01',
    tagNumber: '0160892012',
    smartTagId: 'tag_01',
    bookingReference: 'CX7K9M',
    passengerId: 'pass_01',
    flightId: 'flt_cx888',
    weightKg: 22.4,
    currentStatus: 'LOADED',
    lastKnownLocation: 'HKG-T1-GATE-36-ULD-AK7291',
    lastScannedAt: '2026-11-06T15:45:00Z',
    carouselAssigned: 'Carousel 7',
    isRushBag: false,
    notes: 'Priority Business bag loaded into container AK7291 for CX888',
  },
  {
    id: 'bag_02',
    tagNumber: '0160892013',
    bookingReference: 'CX9L2R',
    passengerId: 'pass_02',
    flightId: 'flt_cx888',
    weightKg: 18.2,
    currentStatus: 'SECURITY_CLEARED',
    lastKnownLocation: 'HKG-T1-BAGGAGE-SORT-BAY-B',
    lastScannedAt: '2026-11-06T15:10:00Z',
    isRushBag: false,
  },
  {
    id: 'bag_03',
    tagNumber: '0160892014',
    bookingReference: 'CX4M1P',
    passengerId: 'pass_03',
    flightId: 'flt_cx250',
    weightKg: 28.5,
    currentStatus: 'MISROUTED',
    lastKnownLocation: 'HKG-TRANSFER-STAGING-AREA',
    lastScannedAt: '2026-11-06T14:30:00Z',
    isRushBag: true,
    notes: 'Transferred from CX101 without container link. Flagged for ramp inspection.',
  },
];

export const mockBaggageEvents: BaggageEvent[] = [
  {
    id: 'evt_01',
    baggageId: 'bag_01',
    eventType: 'TAGGED',
    timestamp: '2026-11-06T11:00:00Z',
    locationCode: 'HKG-APP',
    stationName: 'Cathay Mobile App SmartTag Provisioning',
    scannerType: 'NFC_TAP',
    notes: 'Passive SmartTag 04:A2:3B:4C:5D:6E:70 provisioned for CX888',
  },
  {
    id: 'evt_02',
    baggageId: 'bag_01',
    eventType: 'CHECKED_IN',
    timestamp: '2026-11-06T14:15:00Z',
    locationCode: 'HKG-T1-AISLE-B-DROP-04',
    stationName: 'Self Bag Drop Counter 4',
    scannerType: 'OPTICAL_BARCODE',
    notes: 'Weight measured at scale: 22.4 kg',
  },
  {
    id: 'evt_03',
    baggageId: 'bag_01',
    eventType: 'SECURITY_CLEARED',
    timestamp: '2026-11-06T14:35:00Z',
    locationCode: 'HKG-BHS-SCANNER-03',
    stationName: 'Inline Baggage Security Screening',
    scannerType: 'RFID_GATE',
  },
  {
    id: 'evt_04',
    baggageId: 'bag_01',
    eventType: 'LOADED',
    timestamp: '2026-11-06T15:45:00Z',
    locationCode: 'HKG-GATE-36-RAMP',
    stationName: 'Baggage Makeup Ramp Gate 36',
    handledByStaffId: 'STF-8821',
    scannerType: 'NFC_TAP',
    notes: 'Loaded into Container AK7291 for CX888',
  },
];

export const mockRecoveryCases: RecoveryCase[] = [
  {
    id: 'rec_01',
    caseNumber: 'REC-2026-0812',
    baggageId: 'bag_03',
    passengerId: 'pass_03',
    priority: 'HIGH',
    status: 'INVESTIGATING',
    reportedLocation: 'HKG-TRANSFER-STAGING-AREA',
    currentLocation: 'HKG Ground Recovery Bay 2',
    forwardingFlightNumber: 'CX888',
    staffNotes: 'Bag located at transfer staging. Assigned to expedited re-routing.',
    createdAt: '2026-11-06T14:40:00Z',
    updatedAt: '2026-11-06T15:15:00Z',
  },
];

export function findFlightById(flightId: string): Flight | undefined {
  return mockFlights.find((f) => f.id === flightId);
}
