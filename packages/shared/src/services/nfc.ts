/**
 * PolyAero Cathay SmartTag - NFC Abstraction Layer
 * Defines clean boundary between high-level SmartTag actions and physical NFC hardware.
 */

export interface SmartTagPayload {
  tagUid: string;
  baggageTagNumber: string;
  flightNumber: string;
  destinationAirport: string;
  passengerInitials: string;
  departureDate: string;
  securityHash: string;
}

export type NfcOperationStatus = 'SUCCESS' | 'TAG_LOST' | 'UNSUPPORTED' | 'PERMISSION_DENIED' | 'TIMEOUT';

export interface NfcScanResult {
  status: NfcOperationStatus;
  tagUid?: string;
  payload?: SmartTagPayload;
  errorMessage?: string;
}

export interface INfcService {
  isSupported(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  startScan(delayMs?: number): Promise<NfcScanResult>;
  cancelScan(): Promise<void>;
  writeSmartTag(payload: SmartTagPayload, delayMs?: number): Promise<NfcScanResult>;
}

/**
 * MockNfcService
 * Used for local simulator development, testing, and web fallback.
 * Allows simulating real NFC taps with E-ink update delays.
 */
export class MockNfcService implements INfcService {
  private isScanning = false;
  private currentTag: SmartTagPayload | null = {
    tagUid: '04:A2:3B:4C:5D:6E:70',
    baggageTagNumber: '0160892012',
    flightNumber: 'CX888',
    destinationAirport: 'YVR',
    passengerInitials: 'T.C.',
    departureDate: '2026-11-10',
    securityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  async isSupported(): Promise<boolean> {
    return true;
  }

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async startScan(delayMs = 600): Promise<NfcScanResult> {
    this.isScanning = true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    if (!this.isScanning) {
      return { status: 'TIMEOUT', errorMessage: 'Scan cancelled by user.' };
    }

    this.isScanning = false;
    return {
      status: 'SUCCESS',
      tagUid: this.currentTag?.tagUid || '04:A2:3B:4C:5D:6E:70',
      payload: this.currentTag ?? undefined,
    };
  }

  async cancelScan(): Promise<void> {
    this.isScanning = false;
  }

  async writeSmartTag(payload: SmartTagPayload, delayMs = 800): Promise<NfcScanResult> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    this.currentTag = { ...payload };
    return {
      status: 'SUCCESS',
      tagUid: payload.tagUid,
      payload: this.currentTag,
    };
  }

  // Simulator helper: inject a custom tag or reset state
  setMockTag(tag: SmartTagPayload | null): void {
    this.currentTag = tag;
  }
}
