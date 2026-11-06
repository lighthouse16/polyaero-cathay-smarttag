import { describe, it, expect } from 'vitest';
import {
  MockNfcService,
  mockPassenger,
  mockFlights,
  mockBaggageList,
  mockSmartTag,
  SmartTagPayload,
} from '../index';

describe('PolyAero Shared Domain Contracts', () => {
  it('validates mock passenger schema', () => {
    expect(mockPassenger.id).toBe('pass_01');
    expect(mockPassenger.tierStatus).toBe('DIAMOND');
    expect(mockPassenger.bookingReference).toBe('CX7K9M');
  });

  it('validates mock flights schema', () => {
    expect(mockFlights.length).toBeGreaterThan(0);
    const flight = mockFlights[0];
    expect(flight.flightNumber).toBe('CX888');
    expect(flight.origin).toBe('HKG');
    expect(flight.destination).toBe('YVR');
  });

  it('validates mock baggage tracking records', () => {
    const bag = mockBaggageList.find((b) => b.id === 'bag_01');
    expect(bag).toBeDefined();
    expect(bag?.currentStatus).toBe('LOADED');
    expect(bag?.smartTagId).toBe(mockSmartTag.id);
  });
});

describe('MockNfcService', () => {
  it('supports scanning and reports enabled', async () => {
    const nfc = new MockNfcService();
    expect(await nfc.isSupported()).toBe(true);
    expect(await nfc.isEnabled()).toBe(true);
  });

  it('scans mock tag with realistic payload', async () => {
    const nfc = new MockNfcService();
    const result = await nfc.startScan(50); // fast scan for test
    expect(result.status).toBe('SUCCESS');
    expect(result.tagUid).toBe('04:A2:3B:4C:5D:6E:70');
    expect(result.payload?.flightNumber).toBe('CX888');
    expect(result.payload?.destinationAirport).toBe('YVR');
  });

  it('writes and updates payload on mock tag', async () => {
    const nfc = new MockNfcService();
    const newPayload: SmartTagPayload = {
      tagUid: '04:A2:3B:4C:5D:6E:70',
      baggageTagNumber: '0160899999',
      flightNumber: 'CX250',
      destinationAirport: 'LHR',
      passengerInitials: 'T.C.',
      departureDate: '2026-11-12',
      securityHash: 'fedcba9876543210',
    };

    const writeResult = await nfc.writeSmartTag(newPayload, 50);
    expect(writeResult.status).toBe('SUCCESS');
    expect(writeResult.payload?.flightNumber).toBe('CX250');

    const scanResult = await nfc.startScan(50);
    expect(scanResult.payload?.flightNumber).toBe('CX250');
    expect(scanResult.payload?.baggageTagNumber).toBe('0160899999');
  });
});
