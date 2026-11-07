import { ImageSourcePropType } from 'react-native';
import { SmartTag, Baggage } from '@polyaero/shared';

export type CathayTabId = 'home' | 'book' | 'trips' | 'profile' | 'tools';

export interface UserAuthProfile {
  isLoggedIn: boolean;
  title: 'Mr' | 'Ms' | 'Mrs' | 'Miss';
  familyName: string;
  givenName: string;
  email: string;
  mobile: string;
  membershipNumber: string;
  tierStatus: 'Green' | 'Silver' | 'Gold' | 'Diamond';
  memberSince: string;
  statusPoints: number;
  asiaMiles: number;
  pointsToNextTier: number;
}

export interface FlightBooking {
  id: string;
  pnr: string;
  ticketNumber: string;
  flightNumber: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabin: string;
  terminal: string;
  gate: string;
  seat: string;
  status: 'Confirmed' | 'Checked In' | 'Boarding';
  smartTag?: SmartTag;
  baggage?: Baggage;
}

export interface RecentSearch {
  id: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  dates: string;
  price: string;
}

export interface DestinationOffer {
  id: string;
  city: string;
  cabin: string;
  currency: string;
  price: string;
  image: ImageSourcePropType;
  isExploreAll?: boolean;
}

export interface PromotionOffer {
  id: string;
  title: string;
  category: string;
  badge?: string;
  badgeColor?: string;
  validUntil?: string;
  discountText?: string;
  image: ImageSourcePropType;
}

export interface InspirationArticle {
  id: string;
  title: string;
  location: string;
  image: ImageSourcePropType;
}

export interface NewsItem {
  id: string;
  title: string;
  image: ImageSourcePropType;
}

export const INITIAL_USER_PROFILE: UserAuthProfile = {
  isLoggedIn: false,
  title: 'Mr',
  familyName: 'Trinh',
  givenName: 'Hai Dang',
  email: 'haidang.trinh@gmail.com',
  mobile: '+852 70516618',
  membershipNumber: '190 662 0194',
  tierStatus: 'Green',
  memberSince: '2025',
  statusPoints: 0,
  asiaMiles: 0,
  pointsToNextTier: 300,
};

export const INITIAL_BOOKING: FlightBooking = {
  id: 'bk-cx304-01',
  pnr: '7Y9K2M',
  ticketNumber: '160-8291048291',
  flightNumber: 'CX304',
  origin: 'HKG',
  originCity: 'Hong Kong',
  destination: 'NKG',
  destinationCity: 'Nanjing',
  departureDate: 'Sun 08 Nov 2026',
  departureTime: '19:25',
  arrivalTime: '21:50',
  duration: '2h 25m',
  cabin: 'Economy',
  terminal: 'Terminal 1',
  gate: 'Gate 23',
  seat: '18A',
  status: 'Confirmed',
  smartTag: {
    id: 'tag-cx-882910',
    tagUid: '04:A1:B2:C3:D4:E5:F6',
    hardwareModel: 'PolyAero-Passive-2.9in',
    powerSource: 'PASSIVE_RF',
    batteryLevel: 94,
    einkDisplayStatus: 'SYNCHRONIZED',
    barcodeSymbology: 'INTERLEAVED_2_OF_5',
    linkedBaggageId: 'bag-cx-882910',
    isWriteProtected: false,
    lastWrittenAt: new Date().toISOString(),
    createdAt: '2026-11-01T00:00:00Z',
  },
  baggage: {
    id: 'bag-cx-882910',
    tagNumber: 'CX882910',
    smartTagId: '04:A1:B2:C3:D4:E5:F6',
    bookingReference: '7Y9K2M',
    passengerId: 'pax-trinh-01',
    flightId: 'CX304',
    weightKg: 21.4,
    currentStatus: 'CHECKED_IN',
    lastKnownLocation: 'HKG_T1_SORT_B',
    lastScannedAt: new Date().toISOString(),
    isRushBag: false,
  },
};
