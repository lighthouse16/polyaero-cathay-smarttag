/**
 * Native NFC chip detection for Android/iOS preview builds.
 *
 * NOTE: This reads a real NFC UID; it does NOT update the vendor-specific
 * E-ink display or mark baggage as physically synchronized.
 * Native NFC is unavailable in Expo Go and on the web.
 */
import { Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import {
  NfcCancelledError,
  NfcDisabledError,
  NfcError,
  NfcOperationInProgressError,
  NfcTimeoutError,
  NfcUnavailableError,
  type SmartTagScanResult,
} from '@polyaero/shared';

let activeScan = false;
let cancelled = false;

export async function scanPhysicalTag(timeoutMs = 15000): Promise<SmartTagScanResult> {
  if (activeScan) throw new NfcOperationInProgressError();
  activeScan = true;
  cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    if (!(await NfcManager.isSupported())) throw new NfcUnavailableError();
    await NfcManager.start();
    if (!(await NfcManager.isEnabled())) throw new NfcDisabledError();

    // NFC-A can read the ISO 14443-A chip UID even without an NDEF payload.
    // iOS relies on the supported NDEF reader session.
    const technology = Platform.OS === 'android' ? NfcTech.NfcA : NfcTech.Ndef;
    const read = (async () => {
      await NfcManager.requestTechnology(technology);
      return NfcManager.getTag();
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new NfcTimeoutError()), timeoutMs);
    });

    const tag = await Promise.race([read, timeout]);
    if (cancelled) throw new NfcCancelledError();
    if (!tag?.id) {
      throw new NfcError('NFC chip detected, but its UID could not be read.', 'NFC_UID_UNAVAILABLE');
    }

    return {
      tagUid: tag.id.toUpperCase(),
      isMockSimulation: false,
    };
  } catch (error) {
    if (cancelled) throw new NfcCancelledError();
    if (error instanceof NfcError) throw error;
    throw new NfcError(
      error instanceof Error ? error.message : 'Failed to read NFC chip.',
      'NFC_SCAN_FAILED'
    );
  } finally {
    if (timer) clearTimeout(timer);
    // Always terminate the native NFC session after success, timeout or failure.
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
    activeScan = false;
  }
}

export async function cancelPhysicalTagScan(): Promise<void> {
  cancelled = true;
  await NfcManager.cancelTechnologyRequest().catch(() => undefined);
}
