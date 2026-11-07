/**
 * PolyAero Cathay SmartTag - NFC Abstraction Layer
 * Defines contracts and mock implementation for NFC interactions with passive E-ink tags.
 */

import { BarcodeSymbology } from '../types/domain';

export class NfcError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'NfcError';
  }
}

export class NfcDisabledError extends NfcError {
  constructor(message = 'NFC is disabled on this device.') {
    super(message, 'NFC_DISABLED');
    this.name = 'NfcDisabledError';
  }
}

export class NfcUnavailableError extends NfcError {
  constructor(message = 'NFC hardware is not supported or unavailable on this platform.') {
    super(message, 'NFC_UNAVAILABLE');
    this.name = 'NfcUnavailableError';
  }
}

export class NfcTimeoutError extends NfcError {
  constructor(message = 'NFC session timed out before a tag was detected.') {
    super(message, 'NFC_TIMEOUT');
    this.name = 'NfcTimeoutError';
  }
}

export class NfcCancelledError extends NfcError {
  constructor(message = 'NFC operation was cancelled.') {
    super(message, 'NFC_CANCELLED');
    this.name = 'NfcCancelledError';
  }
}

export class NfcWriteError extends NfcError {
  constructor(message = 'Failed to transmit E-ink display buffer via NFC RF field.') {
    super(message, 'NFC_WRITE_FAILED');
    this.name = 'NfcWriteError';
  }
}

export class NfcOperationInProgressError extends NfcError {
  constructor(message = 'Another NFC operation is currently in progress.') {
    super(message, 'NFC_OPERATION_IN_PROGRESS');
    this.name = 'NfcOperationInProgressError';
  }
}

export interface SmartTagPayload {
  tagUid: string;
  baggageTagNumber: string; // 10-digit IATA license plate
  flightNumber: string;
  originAirport: string;
  destinationAirport: string;
  passengerInitials: string;
  departureDate: string;
  barcodeSymbology: BarcodeSymbology;
  authorizationToken?: string;
}

export interface SmartTagWriteResult {
  success: boolean;
  tagUid: string;
  bytesWritten: number;
  timestamp: string;
  isMockSimulation: boolean;
}

export interface SmartTagScanResult {
  tagUid: string;
  payload?: SmartTagPayload;
  isMockSimulation: boolean;
}

export interface INfcService {
  isAvailable(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  readTagUid(timeoutMs?: number): Promise<SmartTagScanResult>;
  writeEinkDisplay(payload: SmartTagPayload, timeoutMs?: number): Promise<SmartTagWriteResult>;
  cancelScan(): Promise<void>;
}

/**
 * MockNfcService
 * Deterministic in-memory simulation for simulator, automated testing, and development.
 */
export class MockNfcService implements INfcService {
  private isScanning = false;
  private cancelCurrentScan: (() => void) | null = null;
  private isNfcEnabled = true;
  private isNfcAvailable = true;
  private simulateTimeout = false;
  private simulateWriteFailure = false;
  private lastWrittenAt: string | null = null;

  private currentTag: SmartTagPayload = {
    tagUid: '04:A2:3B:4C:5D:6E:70',
    baggageTagNumber: '0160892012',
    flightNumber: 'CX888',
    originAirport: 'HKG',
    destinationAirport: 'YVR',
    passengerInitials: 'T.C.',
    departureDate: '2026-11-10',
    barcodeSymbology: 'INTERLEAVED_2_OF_5',
    authorizationToken: 'auth_token_mock_signed_998127',
  };

  async isAvailable(): Promise<boolean> {
    return this.isNfcAvailable;
  }

  async isEnabled(): Promise<boolean> {
    return this.isNfcEnabled;
  }

  async readTagUid(timeoutMs = 3000): Promise<SmartTagScanResult> {
    if (!this.isNfcAvailable) {
      throw new NfcUnavailableError();
    }
    if (!this.isNfcEnabled) {
      throw new NfcDisabledError();
    }
    if (this.isScanning) {
      throw new NfcOperationInProgressError();
    }

    this.isScanning = true;

    return new Promise<SmartTagScanResult>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.isScanning = false;
        this.cancelCurrentScan = null;
      };

      this.cancelCurrentScan = () => {
        cleanup();
        reject(new NfcCancelledError());
      };

      if (this.simulateTimeout) {
        timer = setTimeout(() => {
          cleanup();
          reject(new NfcTimeoutError());
        }, Math.min(timeoutMs, 200));
        return;
      }

      // Simulate normal NFC RF touch latency (150ms)
      timer = setTimeout(() => {
        cleanup();
        resolve({
          tagUid: this.currentTag.tagUid,
          payload: { ...this.currentTag },
          isMockSimulation: true,
        });
      }, 150);
    });
  }

  async writeEinkDisplay(
    payload: SmartTagPayload,
    timeoutMs = 4000
  ): Promise<SmartTagWriteResult> {
    if (!this.isNfcAvailable) {
      throw new NfcUnavailableError();
    }
    if (!this.isNfcEnabled) {
      throw new NfcDisabledError();
    }
    if (this.isScanning) {
      throw new NfcOperationInProgressError();
    }
    if (!payload.tagUid || !payload.baggageTagNumber || !payload.flightNumber) {
      throw new NfcError('Invalid SmartTag payload attributes.', 'INVALID_PAYLOAD');
    }
    if (this.simulateWriteFailure) {
      throw new NfcWriteError('RF coupling lost during E-ink frame transmission.');
    }

    this.isScanning = true;

    return new Promise<SmartTagWriteResult>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.isScanning = false;
        this.cancelCurrentScan = null;
      };

      this.cancelCurrentScan = () => {
        cleanup();
        reject(new NfcCancelledError());
      };

      if (this.simulateTimeout) {
        timer = setTimeout(() => {
          cleanup();
          reject(new NfcTimeoutError());
        }, Math.min(timeoutMs, 200));
        return;
      }

      // Simulate RF energy harvesting transmission time (approx 300ms)
      timer = setTimeout(() => {
        const writeTimestamp = new Date().toISOString();
        cleanup();
        this.currentTag = { ...payload };
        this.lastWrittenAt = writeTimestamp;
        resolve({
          success: true,
          tagUid: payload.tagUid,
          bytesWritten: 4736, // 296x128 1-bit E-ink display buffer size
          timestamp: writeTimestamp,
          isMockSimulation: true,
        });
      }, 300);
    });
  }

  async cancelScan(): Promise<void> {
    if (this.cancelCurrentScan) {
      this.cancelCurrentScan();
    }
    this.isScanning = false;
  }

  // Test & Simulation Hooks
  setMockTag(tag: SmartTagPayload): void {
    this.currentTag = { ...tag };
  }

  setMockEnabled(enabled: boolean): void {
    this.isNfcEnabled = enabled;
  }

  setMockAvailable(available: boolean): void {
    this.isNfcAvailable = available;
  }

  setSimulateTimeout(simulate: boolean): void {
    this.simulateTimeout = simulate;
  }

  setSimulateWriteFailure(simulate: boolean): void {
    this.simulateWriteFailure = simulate;
  }

  getLastWrittenAt(): string | null {
    return this.lastWrittenAt;
  }
}
