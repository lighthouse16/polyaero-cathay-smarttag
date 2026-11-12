/**
 * Native NFC Service using react-native-nfc-manager
 * Works on physical iOS/Android devices (Expo Dev Client required)
 */

import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
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
  NfcOperationInProgressError
} from '@polyaero/shared';
import { syncBookingToCopilot } from '../copilotBridge';

export class NativeNfcService implements INfcService {
  private initialized = false;
  private isScanning = false;
  private cancelCurrentScan: (() => void) | null = null;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      await NfcManager.start();
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
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.initialized) return false;

    try {
      const supported = await NfcManager.isSupported();
      return supported;
    } catch (err) {
      console.error('[NativeNfcService] isAvailable error:', err);
      return false;
    }
  }

  async isEnabled(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.initialized) return false;

    try {
      const enabled = await NfcManager.isEnabled();
      return enabled;
    } catch (err) {
      console.error('[NativeNfcService] isEnabled error:', err);
      return false;
    }
  }

  async readTagUid(timeoutMs = 3000): Promise<SmartTagScanResult> {
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

    this.isScanning = true;

    return new Promise<SmartTagScanResult>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.isScanning = false;
        this.cancelCurrentScan = null;
        NfcManager.unregisterTagEvent().catch(() => {});
      };

      this.cancelCurrentScan = () => {
        cleanup();
        reject(new NfcCancelledError());
      };

      // Register for tag events
      NfcManager.registerTagEvent()
        .then(() => {
          console.log('[NativeNfcService] Tag event registered');
        })
        .catch((err) => {
          cleanup();
          reject(new NfcError(err.message || 'Failed to register tag event', 'REGISTER_FAILED'));
        });

      // Set up the tag listener (using event emitter pattern)
      // const subscription = NfcManager.addListener('onTagDiscovered', ...);
      // Not used in this simplified polling approach

      // We'll use the promise-based approach with a timeout
      timer = setTimeout(() => {
        cleanup();
        reject(new NfcTimeoutError());
      }, timeoutMs);

      // Poll for tag using getTag (this is a simplified approach)
      const pollForTag = async () => {
        try {
          const tag = await NfcManager.getTag();
          if (!tag) {
            if (this.isScanning) {
              setTimeout(pollForTag, 100);
            }
            return;
          }
          console.log('[NativeNfcService] Tag detected:', tag);
          cleanup();
          resolve({
            tagUid: tag.id || '',
            payload: undefined, // We don't parse the payload here
            isMockSimulation: false,
          });
        } catch {
          // Retry until timeout
          if (this.isScanning) {
            setTimeout(pollForTag, 100);
          }
        }
      };

      pollForTag();
    });
  }

  async writeEinkDisplay(
    payload: SmartTagPayload,
    timeoutMs = 4000
  ): Promise<SmartTagWriteResult> {
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

    return new Promise<SmartTagWriteResult>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.isScanning = false;
        NfcManager.cancelTechnologyRequest().catch(() => {});
      };

      // Write NDEF with the SmartTag payload
      const writeNdef = async () => {
        try {
          await NfcManager.requestTechnology(NfcTech.Ndef);
          
          // Encode the payload as JSON string in an NDEF record
          const payloadJson = JSON.stringify(payload);
          const ndefMessage = Ndef.encodeMessage([
            Ndef.textRecord(payloadJson, 'en', 'UTF-8'),
          ]);

          await NfcManager.writeNdefMessage(ndefMessage);
          await NfcManager.cancelTechnologyRequest();

          cleanup();
          const writeTimestamp = new Date().toISOString();
          resolve({
            success: true,
            tagUid: payload.tagUid,
            bytesWritten: new Blob([payloadJson]).size,
            timestamp: writeTimestamp,
            isMockSimulation: false,
            verifiedReadback: false,
          });
        } catch (err: any) {
          cleanup();
          reject(new NfcWriteError(err.message || 'Write failed'));
        }
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new NfcTimeoutError());
      }, timeoutMs);

      writeNdef();
    });
  }

  async cancelScan(): Promise<void> {
    if (this.cancelCurrentScan) {
      this.cancelCurrentScan();
    }
    await NfcManager.unregisterTagEvent().catch(() => {});
    this.isScanning = false;
  }

  // Extended method for SmartTag sync
  async writeSmartTagSync(_bookingId: string): Promise<SmartTagWriteResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get the NDEF record from the API using the existing sync function
      // Note: We need booking info to call syncBookingToCopilot
      // This is a simplified version - in practice you'd fetch booking details first
      const syncResult = await syncBookingToCopilot({
        // These would come from the booking context
        flightNumber: 'CX888', // Placeholder
        origin: 'HKG',
        destination: 'YVR',
        initialStatus: 'TAGGED',
      });

      if (!syncResult || !syncResult.tag_number) {
        throw new NfcWriteError('Failed to get sync result from API');
      }

      // Create SmartTagPayload from the sync result
      const payload: SmartTagPayload = {
        tagUid: syncResult.tag_code || '',
        baggageTagNumber: syncResult.tag_number || '',
        flightNumber: syncResult.flight_number || '',
        originAirport: syncResult.departure_airport || '',
        destinationAirport: syncResult.arrival_airport || '',
        passengerInitials: syncResult.passenger_name?.split('/').map(s => s[0]).join('') || '',
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
    if (this.isScanning) {
      this.cancelScan();
    }
  }
}

export const nativeNfcService = new NativeNfcService();