import { ImageSourcePropType } from 'react-native';
import { SmartTag, Baggage } from '@polyaero/shared';

export type CathayTabId = 'home' | 'book' | 'trips' | 'profile' | 'tools';

export interface UserAuthProfile {
  isLoggedIn: boolean;
  title: string;
  familyName: string;
  givenName: string;
  email: string;
  mobile: string;
  membershipNumber: string;
  tierStatus: 'Green' | 'Silver' | 'Gold' | 'Diamond';
  memberSince: string;
  statusPoints: number;
  asiaMiles: number | null;
  pointsToNextTier: number | null;
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
  id: 'bk-cx548-01',
  pnr: '8K3F7D',
  ticketNumber: '160-8801234560',
  flightNumber: 'CX548',
  origin: 'HKG',
  originCity: 'Hong Kong',
  destination: 'NRT',
  destinationCity: 'Tokyo',
  departureDate: 'Fri 21 Nov 2026',
  departureTime: '08:40',
  arrivalTime: '13:55',
  duration: '4h 15m',
  cabin: 'Economy',
  terminal: 'Terminal 1',
  gate: 'Gate 24',
  seat: '32A',
  status: 'Confirmed',
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
  baggage: {
    id: 'bag_itin-cx548-hkg-nrt_1',
    tagNumber: '0160123456',
    smartTagId: 'tag_st_2048',
    bookingReference: '8K3F7D',
    passengerId: 'pass_demo_cx548',
    flightId: 'flt_cx548_20261121',
    weightKg: 0,
    currentStatus: 'TAGGED',
    lastKnownLocation: 'HKG-APP',
    lastScannedAt: '2026-11-01T09:00:00Z',
    isRushBag: false,
  },
};
