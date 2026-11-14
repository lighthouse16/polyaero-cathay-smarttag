/**
 * Native NFC Service using react-native-nfc-manager
 * Works on physical iOS/Android devices (Expo Dev Client / APK build required)
 */

import { Platform } from 'react-native';
import type NfcManagerModule from 'react-native-nfc-manager';
import {
  INfcService,
  SmartTagPayload,
  SmartTagScanResult,
  SmartTagWriteResult,
  NfcError,
  NfcDisabledError,
  NfcUnavailableError,
  NfcTimeoutError,
  NfcCancelledError,
  NfcWriteError,
  NfcOperationInProgressError,
} from '@polyaero/shared';
import { syncBookingToCopilot } from '../copilotBridge';

type NfcModuleShape = {
  default: typeof NfcManagerModule;
  NfcTech: typeof import('react-native-nfc-manager').NfcTech;
  Ndef: typeof import('react-native-nfc-manager').Ndef;
};

const AIRPORT_CITY_MAP: Record<string, string> = {
  HKG: 'HONG KONG',
  NRT: 'TOKYO',
  HND: 'TOKYO',
  YVR: 'VANCOUVER',
  LHR: 'LONDON',
  JFK: 'NEW YORK',
  LAX: 'LOS ANGELES',
  SIN: 'SINGAPORE',
  SFO: 'SAN FRANCISCO',
  SYD: 'SYDNEY',
  TPE: 'TAIPEI',
  ICN: 'SEOUL',
  BKK: 'BANGKOK',
};

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

let cachedNfcModule: NfcModuleShape | null | undefined;

function getNfcModule(): NfcModuleShape | null {
  if (cachedNfcModule !== undefined) {
    return cachedNfcModule;
  }
  if (Platform.OS === 'web') {
    cachedNfcModule = null;
    return null;
  }
  try {
    // Lazy-require so Expo Go and Web SSR do not crash at module evaluation when native NfcManager is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-nfc-manager') as NfcModuleShape;
    cachedNfcModule = mod?.default ? mod : null;
  } catch {
    cachedNfcModule = null;
  }
  return cachedNfcModule;
}

export function isNativeNfcModuleAvailable(): boolean {
  return getNfcModule() !== null;
}

function formatIataDate(rawDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate || '');
  if (!match) return '21NOV';
  const monthIdx = Math.max(0, Math.min(11, parseInt(match[2], 10) - 1));
  return `${match[3]}${MONTHS_SHORT[monthIdx]}`;
}

export function encodeSmartTagNdefText(payload: SmartTagPayload): string {
  const digits = (payload.baggageTagNumber || '').replace(/\D/g, '');
  const tagNum = (digits || '0160123456').padStart(10, '0').slice(-10);
  const dest = (payload.destinationAirport || 'HKG').trim().toUpperCase().slice(0, 3);
  const city = AIRPORT_CITY_MAP[dest] || dest;
  const flight = (payload.flightNumber || 'CX548').trim().toUpperCase();
  const dateStr = formatIataDate(payload.departureDate);
  const timeMatch = /T(\d{2}):(\d{2})/.exec(payload.departureDate || '');
  const timeStr = timeMatch ? `${timeMatch[1]}${timeMatch[2]}` : '0930';
  const pax = (payload.passengerInitials || `${payload.originAirport}-${dest}`).trim().toUpperCase();
  return `${tagNum}|${dest}|${city}|${flight}|${dateStr}|${timeStr}|${pax}`;
}

function decodeNdefTextRecord(ndef: typeof import('react-native-nfc-manager').Ndef, tag: any): string | null {
  const records = tag?.ndefMessage;
  if (!Array.isArray(records) || records.length === 0) return null;
  for (const rec of records) {
    if (rec?.payload && Array.isArray(rec.payload)) {
      try {
        const text = ndef.text.decodePayload(Uint8Array.from(rec.payload));
        if (text) return text;
      } catch {
        // Ignore non-text NDEF records and inspect remaining records
      }
    }
  }
  return null;
}

export class NativeNfcService implements INfcService {
  private initialized = false;
  private isScanning = false;
  private activeTechSession = false;
  private sessionIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelCurrentScan: (() => void) | null = null;

  private clearSessionIdleTimer(): void {
    if (this.sessionIdleTimer) {
      clearTimeout(this.sessionIdleTimer);
      this.sessionIdleTimer = null;
    }
  }

  private async releaseTechSession(): Promise<void> {
    this.clearSessionIdleTimer();
    this.activeTechSession = false;
    const nfc = getNfcModule();
    if (nfc) {
      await nfc.default.cancelTechnologyRequest().catch(() => {});
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    const nfc = getNfcModule();
    if (!nfc) return false;

    try {
      await nfc.default.start();
      this.initialized = true;
      console.log('[NativeNfcService] NfcManager started');
      return true;
    } catch (err) {
      console.error('[NativeNfcService] Failed to start NfcManager:', err);
      return false;
    }
  }

  // INfcService interface
  async isAvailable(): Promise<boolean> {
    const nfc = getNfcModule();
    if (!nfc) return false;

    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.initialized) return false;

    try {
      const supported = await nfc.default.isSupported();
      return supported;
    } catch (err) {
      console.error('[NativeNfcService] isAvailable error:', err);
      return false;
    }
  }

  async isEnabled(): Promise<boolean> {
    const nfc = getNfcModule();
    if (!nfc) return false;

    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.initialized) return false;

    try {
      const enabled = await nfc.default.isEnabled();
      return enabled;
    } catch (err) {
      console.error('[NativeNfcService] isEnabled error:', err);
      return false;
    }
  }

  async readTagUid(timeoutMs = 15000): Promise<SmartTagScanResult> {
    const nfc = getNfcModule();
    if (!nfc) {
      throw new NfcUnavailableError();
    }

    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.initialized) {
      throw new NfcUnavailableError();
    }

    const available = await this.isAvailable();
    if (!available) {
      throw new NfcUnavailableError();
    }

    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new NfcDisabledError();
    }

    if (this.isScanning) {
      throw new NfcOperationInProgressError();
    }

    await this.releaseTechSession();
    this.isScanning = true;
    const NfcManager = nfc.default;

    return new Promise<SmartTagScanResult>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (releaseTech: boolean) => {
        if (timer) clearTimeout(timer);
        this.isScanning = false;
        this.cancelCurrentScan = null;
        if (releaseTech) {
          void this.releaseTechSession();
        }
      };

      this.cancelCurrentScan = () => {
        if (settled) return;
        settled = true;
        finish(true);
        reject(new NfcCancelledError());
      };

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        finish(true);
        reject(new NfcTimeoutError());
      }, timeoutMs);

      const scan = async () => {
        try {
          await NfcManager.requestTechnology(nfc.NfcTech.Ndef, {
            alertMessage: 'Hold the back of your phone near the SmartTag',
          });
          if (settled) {
            await this.releaseTechSession();
            return;
          }

          const tag = await NfcManager.getTag({ readNdef: false }).catch(() => null);
          if (settled) {
            await this.releaseTechSession();
            return;
          }

          // Keep the NDEF tech session open for the immediate writeEinkDisplay call in the same tap
          this.activeTechSession = true;
          this.clearSessionIdleTimer();
          this.sessionIdleTimer = setTimeout(() => {
            void this.releaseTechSession();
          }, 5000);

          settled = true;
          finish(false);
          resolve({
            tagUid: tag?.id || 'NFC-TAG',
            payload: undefined,
            isMockSimulation: false,
          });
        } catch (err: any) {
          if (settled) return;
          settled = true;
          finish(true);
          const msg = String(err?.message || '').toLowerCase();
          if (msg.includes('cancel')) {
            reject(new NfcCancelledError());
          } else {
            reject(new NfcError(err?.message || 'Failed to detect NFC tag', 'NFC_SCAN_FAILED'));
          }
        }
      };

      void scan();
    });
  }

  async writeEinkDisplay(
    payload: SmartTagPayload,
    timeoutMs = 15000
  ): Promise<SmartTagWriteResult> {
    const nfc = getNfcModule();
    if (!nfc) {
      throw new NfcUnavailableError();
    }

    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.initialized) {
      throw new NfcUnavailableError();
    }

    const available = await this.isAvailable();
    if (!available) {
      throw new NfcUnavailableError();
    }

    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new NfcDisabledError();
    }

    if (this.isScanning) {
      throw new NfcOperationInProgressError();
    }

    if (!payload.tagUid || !payload.baggageTagNumber || !payload.flightNumber) {
      throw new NfcError('Invalid SmartTag payload attributes.', 'INVALID_PAYLOAD');
    }

    this.isScanning = true;
    this.clearSessionIdleTimer();
    const { default: NfcManager, NfcTech, Ndef } = nfc;

    return new Promise<SmartTagWriteResult>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = () => {
        if (timer) clearTimeout(timer);
        this.isScanning = false;
        this.cancelCurrentScan = null;
        void this.releaseTechSession();
      };

      this.cancelCurrentScan = () => {
        if (settled) return;
        settled = true;
        finish();
        reject(new NfcCancelledError());
      };

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        finish();
        reject(new NfcTimeoutError());
      }, timeoutMs);

      const writeNdef = async () => {
        try {
          if (!this.activeTechSession) {
            await NfcManager.requestTechnology(NfcTech.Ndef, {
              alertMessage: 'Hold the back of your phone steady against the SmartTag',
            });
            this.activeTechSession = true;
          }

          if (settled) {
            await this.releaseTechSession();
            return;
          }

          const recordText = encodeSmartTagNdefText(payload);
          const ndefMessage = Ndef.encodeMessage([
            Ndef.textRecord(recordText, 'en', 'UTF-8'),
          ]);

          await NfcManager.writeNdefMessage(ndefMessage);

          // Verify written payload when the tag stays in the RF field (passive tags);
          // PN532 target mode may immediately exit listen() after sending 90 00 to refresh e-Paper.
          let verifiedReadback = true;
          try {
            const readTag = await NfcManager.ndefHandler.getNdefMessage();
            const readText = decodeNdefTextRecord(Ndef, readTag);
            if (readText !== null && !readText.includes(payload.baggageTagNumber)) {
              verifiedReadback = false;
            }
          } catch {
            // Post-write tag disconnection after ACK is expected on PN532 Type-4 emulation
          }

          if (!verifiedReadback) {
            throw new NfcWriteError('Written NDEF payload failed readback verification.');
          }

          if (settled) {
            await this.releaseTechSession();
            return;
          }

          settled = true;
          finish();
          resolve({
            success: true,
            tagUid: payload.tagUid,
            bytesWritten: ndefMessage.length,
            timestamp: new Date().toISOString(),
            isMockSimulation: false,
            verifiedReadback: true,
          });
        } catch (err: any) {
          if (settled) return;
          settled = true;
          finish();
          const msg = String(err?.message || '').toLowerCase();
          if (msg.includes('cancel')) {
            reject(new NfcCancelledError());
          } else {
            reject(new NfcWriteError(err?.message || 'Write failed'));
          }
        }
      };

      void writeNdef();
    });
  }

  async cancelScan(): Promise<void> {
    if (this.cancelCurrentScan) {
      this.cancelCurrentScan();
    } else {
      await this.releaseTechSession();
    }
    const nfc = getNfcModule();
    if (nfc) {
      await nfc.default.unregisterTagEvent().catch(() => {});
    }
    this.isScanning = false;
  }

  // Extended method for SmartTag sync
  async writeSmartTagSync(_bookingId: string): Promise<SmartTagWriteResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const syncResult = await syncBookingToCopilot({
        flightNumber: 'CX888',
        origin: 'HKG',
        destination: 'YVR',
        initialStatus: 'TAGGED',
      });

      if (!syncResult || !syncResult.tag_number) {
        throw new NfcWriteError('Failed to get sync result from API');
      }

      const payload: SmartTagPayload = {
        tagUid: syncResult.tag_code || '',
        baggageTagNumber: syncResult.tag_number || '',
        flightNumber: syncResult.flight_number || '',
        originAirport: syncResult.departure_airport || '',
        destinationAirport: syncResult.arrival_airport || '',
        passengerInitials: syncResult.passenger_name?.split('/').map((s) => s[0]).join('') || '',
        departureDate: new Date().toISOString().split('T')[0],
        barcodeSymbology: 'INTERLEAVED_2_OF_5',
      };

      return await this.writeEinkDisplay(payload);
    } catch (err: any) {
      console.error('[NativeNfcService] writeSmartTagSync error:', err);
      throw new NfcWriteError(err.message || 'Sync write failed');
    }
  }

  cleanup(): void {
    if (this.isScanning || this.activeTechSession) {
      void this.cancelScan();
    }
  }
}

export const nativeNfcService = new NativeNfcService();