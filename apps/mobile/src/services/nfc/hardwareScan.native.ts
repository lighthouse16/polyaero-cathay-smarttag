/**
 * Native NFC chip detection for Android/iOS builds.
 *
 * NOTE: This reads real physical NFC UID and NDEF metadata via ISO 14443-A / NDEF.
 * It does NOT update a vendor-specific passive E-ink display or mark baggage
 * as physically synchronized. Native NFC requires an APK/dev-client build (unavailable
 * in Expo Go or Web).
 */
import { Linking, Platform } from 'react-native';
import NfcManager, {
  Ndef,
  NfcError as NativeNfcError,
  NfcTech,
  type TagEvent,
} from 'react-native-nfc-manager';
import {
  NfcCancelledError,
  NfcDisabledError,
  NfcError,
  NfcOperationInProgressError,
  NfcTimeoutError,
  NfcUnavailableError,
  type SmartTagScanResult,
} from '@polyaero/shared';

export interface PhysicalTagScanDetails extends SmartTagScanResult {
  techTypes?: string[];
  ndefText?: string | null;
}

export interface ScanPhysicalTagCallbacks {
  onTagDetected?: () => void;
}

let activeScan = false;
let cancelled = false;
let nfcStarted = false;
let activeCancelReject: ((err: NfcCancelledError) => void) | null = null;

export function formatTagUid(rawId: string): string {
  const hex = rawId.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!hex || hex.length % 2 !== 0) {
    return rawId.trim().toUpperCase();
  }
  return hex.match(/.{2}/g)?.join(':') ?? rawId.trim().toUpperCase();
}

function extractNdefSummary(tag: TagEvent): string | null {
  if (!tag.ndefMessage || tag.ndefMessage.length === 0) return null;
  for (const record of tag.ndefMessage) {
    try {
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
        return Ndef.text.decodePayload(new Uint8Array(record.payload));
      }
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) {
        return Ndef.uri.decodePayload(new Uint8Array(record.payload));
      }
    } catch {
      // Ignore malformed NDEF payload bytes and keep UID scan alive.
    }
  }
  return `${tag.ndefMessage.length} NDEF record(s)`;
}

function mapNativeScanError(error: unknown): NfcError {
  if (error instanceof NfcError) return error;
  if (error instanceof NativeNfcError.UserCancel) return new NfcCancelledError();
  if (error instanceof NativeNfcError.Timeout) return new NfcTimeoutError();
  if (error instanceof NativeNfcError.RadioDisabled) return new NfcDisabledError();
  if (error instanceof NativeNfcError.UnsupportedFeature) return new NfcUnavailableError();

  const msg = error instanceof Error ? error.message : String(error ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('cancel')) return new NfcCancelledError();
  if (lower.includes('timeout')) return new NfcTimeoutError();
  if (lower.includes('disabled') || lower.includes('not enabled')) return new NfcDisabledError();
  if (lower.includes('not supported') || lower.includes('null')) return new NfcUnavailableError();

  return new NfcError(msg || 'Failed to read NFC chip.', 'NFC_SCAN_FAILED');
}

export async function isNfcHardwareSupported(): Promise<boolean> {
  try {
    if (!NfcManager || typeof NfcManager.isSupported !== 'function') return false;
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function isNfcHardwareEnabled(): Promise<boolean> {
  try {
    if (!(await isNfcHardwareSupported())) return false;
    if (!nfcStarted) {
      await NfcManager.start();
      nfcStarted = true;
    }
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

export async function openNfcSettings(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && typeof NfcManager.goToNfcSetting === 'function') {
      return await NfcManager.goToNfcSetting();
    }
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

export async function scanPhysicalTag(
  timeoutMs = 15000,
  callbacks?: ScanPhysicalTagCallbacks
): Promise<PhysicalTagScanDetails> {
  if (activeScan) throw new NfcOperationInProgressError();
  activeScan = true;
  cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    if (!(await isNfcHardwareSupported())) {
      throw new NfcUnavailableError();
    }
    if (!nfcStarted) {
      await NfcManager.start();
      nfcStarted = true;
    }
    if (!(await NfcManager.isEnabled())) {
      throw new NfcDisabledError();
    }

    // Android: allow ISO 14443-A (NfcA), ISO-DEP, NDEF, or ISO 15693 so standard cards & luggage tags respond.
    // iOS: CoreNFC requires NDEF session.
    const technologies: NfcTech | NfcTech[] =
      Platform.OS === 'android'
        ? [NfcTech.NfcA, NfcTech.IsoDep, NfcTech.Ndef, NfcTech.NfcV]
        : NfcTech.Ndef;

    const read = (async () => {
      await NfcManager.requestTechnology(technologies, {
        alertMessage: 'Hold the top or back of your phone near your SmartTag NFC chip.',
      });
      if (cancelled) throw new NfcCancelledError();
      callbacks?.onTagDetected?.();
      return NfcManager.getTag({ readNdef: true });
    })();
    // Prevent unhandled rejection if timeout or cancellation wins the race first.
    read.catch(() => undefined);

    const cancelPromise = new Promise<never>((_, reject) => {
      activeCancelReject = reject;
    });

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new NfcTimeoutError()), timeoutMs);
    });

    const tag = await Promise.race([read, timeout, cancelPromise]);
    if (cancelled) throw new NfcCancelledError();
    if (!tag || !tag.id) {
      throw new NfcError(
        'NFC tag detected, but it does not expose a readable UID or supported technology.',
        'NFC_UNSUPPORTED_TAG'
      );
    }

    return {
      tagUid: formatTagUid(tag.id),
      techTypes: tag.techTypes,
      ndefText: extractNdefSummary(tag),
      isMockSimulation: false,
    };
  } catch (error) {
    if (cancelled) throw new NfcCancelledError();
    throw mapNativeScanError(error);
  } finally {
    if (timer) clearTimeout(timer);
    activeCancelReject = null;
    // Always terminate native NFC technology session to free radio hardware without unnecessary debounce.
    await NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 0 }).catch(() => undefined);
    activeScan = false;
  }
}

export async function cancelPhysicalTagScan(): Promise<void> {
  cancelled = true;
  if (activeCancelReject) {
    activeCancelReject(new NfcCancelledError());
    activeCancelReject = null;
  }
  await NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 0 }).catch(() => undefined);
}
