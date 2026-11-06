import { describe, it, expect } from 'vitest';
import {
  MockNfcService,
  mockPassenger,
  mockFlights,
  mockBaggageList,
  mockSmartTag,
  findFlightById,
  SmartTagPayload,
  NfcTimeoutError,
  NfcCancelledError,
  NfcDisabledError,
  NfcWriteError,
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

  it('validates mock baggage tracking records and associates correct flight', () => {
    const bag1 = mockBaggageList.find((b) => b.id === 'bag_01');
    expect(bag1).toBeDefined();
    expect(bag1?.currentStatus).toBe('LOADED');
    expect(bag1?.smartTagId).toBe(mockSmartTag.id);

    const flight1 = findFlightById(bag1!.flightId);
    expect(flight1).toBeDefined();
    expect(flight1?.flightNumber).toBe('CX888');

    const bag3 = mockBaggageList.find((b) => b.id === 'bag_03');
    expect(bag3).toBeDefined();
    const flight3 = findFlightById(bag3!.flightId);
    expect(flight3).toBeDefined();
    expect(flight3?.flightNumber).toBe('CX250');
  });

  it('confirms SmartTag hardware model is passive RF battery-free', () => {
    expect(mockSmartTag.powerSource).toBe('PASSIVE_RF');
    expect(mockSmartTag.batteryLevel).toBeUndefined();
    expect(mockSmartTag.barcodeSymbology).toBe('INTERLEAVED_2_OF_5');
  });
});

describe('MockNfcService - Functional & Error Scenarios', () => {
  it('reads tag UID successfully with explicit simulation flag', async () => {
    const nfc = new MockNfcService();
    const result = await nfc.readTagUid();
    expect(result.tagUid).toBe('04:A2:3B:4C:5D:6E:70');
    expect(result.isMockSimulation).toBe(true);
    expect(result.payload?.flightNumber).toBe('CX888');
    expect(result.payload?.barcodeSymbology).toBe('INTERLEAVED_2_OF_5');
  });

  it('writes E-ink display bitmap payload successfully', async () => {
    const nfc = new MockNfcService();
    const newPayload: SmartTagPayload = {
      tagUid: '04:A2:3B:4C:5D:6E:70',
      baggageTagNumber: '0160899999',
      flightNumber: 'CX250',
      originAirport: 'LHR',
      destinationAirport: 'HKG',
      passengerInitials: 'T.C.',
      departureDate: '2026-11-12',
      barcodeSymbology: 'INTERLEAVED_2_OF_5',
    };

    const writeResult = await nfc.writeEinkDisplay(newPayload);
    expect(writeResult.success).toBe(true);
    expect(writeResult.bytesWritten).toBe(4736);
    expect(writeResult.isMockSimulation).toBe(true);

    const scanResult = await nfc.readTagUid();
    expect(scanResult.payload?.flightNumber).toBe('CX250');
    expect(scanResult.payload?.baggageTagNumber).toBe('0160899999');
  });

  it('handles NFC disabled error gracefully', async () => {
    const nfc = new MockNfcService();
    nfc.setMockEnabled(false);

    await expect(nfc.readTagUid()).rejects.toThrow(NfcDisabledError);
  });

  it('handles NFC timeout scenario', async () => {
    const nfc = new MockNfcService();
    nfc.setSimulateTimeout(true);

    await expect(nfc.readTagUid(100)).rejects.toThrow(NfcTimeoutError);
  });

  it('handles user cancellation during active scan', async () => {
    const nfc = new MockNfcService();
    const scanPromise = nfc.readTagUid(5000);

    // Cancel scan shortly after starting
    setTimeout(() => {
      nfc.cancelScan();
    }, 20);

    await expect(scanPromise).rejects.toThrow(NfcCancelledError);
  });

  it('handles write failure when RF coupling is lost', async () => {
    const nfc = new MockNfcService();
    nfc.setSimulateWriteFailure(true);

    const payload: SmartTagPayload = {
      tagUid: '04:A2:3B:4C:5D:6E:70',
      baggageTagNumber: '0160892012',
      flightNumber: 'CX888',
      originAirport: 'HKG',
      destinationAirport: 'YVR',
      passengerInitials: 'T.C.',
      departureDate: '2026-11-10',
      barcodeSymbology: 'INTERLEAVED_2_OF_5',
    };

    await expect(nfc.writeEinkDisplay(payload)).rejects.toThrow(NfcWriteError);
  });
});
