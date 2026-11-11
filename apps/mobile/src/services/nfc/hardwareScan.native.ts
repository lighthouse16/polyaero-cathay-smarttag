/**
 * Native NFC chip detection & NDEF writer for Android/iOS builds.
 *
 * NOTE:
 * - Reads real physical NFC UID and NDEF metadata via ISO 14443-A / NDEF.
 * - Writes versioned compact SmartTag NDEF text payloads (`PA2|...`) to
 *   writable NTAG213/215/216 or NDEF-compatible tags, followed by live RF readback
 *   verification via `NfcManager.ndefHandler.getNdefMessage()`.
 * - Does NOT claim a passive E-ink screen was physically refreshed by the phone
 *   alone; the physical SmartTag display prototype is updated by the ESP32-C6
 *   controller upon tapping the written tag against the Waveshare PN532 reader.
 */
import { Linking, Platform } from 'react-native';
import NfcManager, {
  Ndef,
  NdefStatus,
  NfcError as NativeNfcError,
  NfcTech,
  type TagEvent,
} from 'react-native-nfc-manager';
import {
  MAX_NFC_PAYLOAD_BYTES,
  NfcCancelledError,
  NfcDisabledError,
  NfcError,
  NfcOperationInProgressError,
  NfcTimeoutError,
  NfcUnavailableError,
  type SmartTagScanResult,
} from '@polyaero/shared';

export type NdefWriteStage =
  | 'READY'
  | 'TAG_DETECTED'
  | 'COMPATIBILITY_CHECK'
  | 'WRITING_NDEF'
  | 'READING_BACK'
  | 'VERIFIED';

export interface PhysicalTagScanDetails extends SmartTagScanResult {
  techTypes?: string[];
  ndefText?: string | null;
}

export interface ScanPhysicalTagCallbacks {
  onTagDetected?: () => void;
  onStageChange?: (stage: NdefWriteStage, detail?: string) => void;
}

export interface NfcWriteResult {
  success: boolean;
  bytesWritten: number;
  readbackPayload: string;
  tagUid: string;
  capacityBytes?: number;
  techTypes?: string[];
}

let activeScan = false;
let cancelled = false;
let nfcStarted = false;
let activeCancelReject: ((err: NfcCancelledError) => void) | null = null;

export function isScanInProgress(): boolean {
  return activeScan;
}

export function formatTagUid(rawId: string): string {
  const hex = rawId.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!hex || hex.length % 2 !== 0) {
    return rawId.trim().toUpperCase();
  }
  return hex.match(/.{2}/g)?.join(':') ?? rawId.trim().toUpperCase();
}

function extractExactNdefText(tag: TagEvent | null | undefined): string | null {
  if (!tag?.ndefMessage || tag.ndefMessage.length === 0) return null;
  for (const record of tag.ndefMessage) {
    try {
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
        return Ndef.text.decodePayload(new Uint8Array(record.payload));
      }
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) {
        return Ndef.uri.decodePayload(new Uint8Array(record.payload));
      }
    } catch {
      // Skip malformed record
    }
  }
  return null;
}

function extractNdefSummary(tag: TagEvent): string | null {
  const exact = extractExactNdefText(tag);
  if (exact !== null) return exact;
  if (!tag.ndefMessage || tag.ndefMessage.length === 0) return null;
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
  if (lower.includes('taglost') || lower.includes('tag lost') || lower.includes('transceive failed')) {
    return new NfcError(
      'NFC tag was moved away before the write and readback finished. Hold the phone steady against the tag until verified.',
      'NFC_TAG_REMOVED'
    );
  }
  if (lower.includes('disabled') || lower.includes('not enabled')) return new NfcDisabledError();
  if (lower.includes('not supported') || lower.includes('null')) return new NfcUnavailableError();

  return new NfcError(msg || 'Failed to communicate with NFC chip.', 'NFC_WRITE_FAILED');
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
      try {
        await NfcManager.start();
        nfcStarted = true;
      } catch {
        return false;
      }
    }
    if (typeof NfcManager.isEnabled !== 'function') return false;
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
      try {
        await NfcManager.start();
        nfcStarted = true;
      } catch {
        throw new NfcUnavailableError('Failed to initialize NFC subsystem on this device.');
      }
    }
    if (!(await NfcManager.isEnabled())) {
      throw new NfcDisabledError();
    }

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
    read.catch(() => undefined);

    const cancelPromise = new Promise<never>((_, reject) => {
      activeCancelReject = reject;
    });

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new NfcTimeoutError()), timeoutMs);
    });

    const tag = await Promise.race([read, timeout, cancelPromise]);
    if (cancelled) throw new NfcCancelledError();
    if (!tag || !tag.id || typeof tag.id !== 'string' || !tag.id.trim()) {
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
    await NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 0 }).catch(() => undefined);
    activeScan = false;
  }
}

export async function writeNdefPayloadToTag(
  payloadText: string,
  timeoutMs = 20000,
  callbacks?: ScanPhysicalTagCallbacks
): Promise<NfcWriteResult> {
  if (!payloadText || !payloadText.trim()) {
    throw new NfcError('Cannot write an empty payload to NFC tag.', 'INVALID_PAYLOAD');
  }
  if (payloadText.length > MAX_NFC_PAYLOAD_BYTES) {
    throw new NfcError(
      `Payload length (${payloadText.length} bytes) exceeds ${MAX_NFC_PAYLOAD_BYTES}-byte safe NTAG limit.`,
      'NFC_INSUFFICIENT_CAPACITY'
    );
  }

  const record = Ndef.textRecord(payloadText);
  const ndefBytes = Ndef.encodeMessage([record]);
  if (!ndefBytes || ndefBytes.length === 0) {
    throw new NfcError('Failed to encode NDEF message record.', 'INVALID_PAYLOAD');
  }

  if (activeScan) throw new NfcOperationInProgressError();
  activeScan = true;
  cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    if (!(await isNfcHardwareSupported())) {
      throw new NfcUnavailableError();
    }
    if (!nfcStarted) {
      try {
        await NfcManager.start();
        nfcStarted = true;
      } catch {
        throw new NfcUnavailableError('Failed to initialize NFC subsystem on this device.');
      }
    }
    if (!(await NfcManager.isEnabled())) {
      throw new NfcDisabledError();
    }

    const technologies: NfcTech | NfcTech[] =
      Platform.OS === 'android'
        ? [NfcTech.Ndef, NfcTech.NdefFormatable, NfcTech.MifareClassic, NfcTech.NfcA]
        : NfcTech.Ndef;

    const writeFlow = (async (): Promise<NfcWriteResult> => {
      const connectedTech = await NfcManager.requestTechnology(technologies, {
        alertMessage: 'Hold a writable NTAG213/215/216 tag against your phone to write SmartTag data.',
      });
      if (cancelled) throw new NfcCancelledError();

      callbacks?.onTagDetected?.();
      callbacks?.onStageChange?.('TAG_DETECTED');

      const tag = await NfcManager.getTag({ readNdef: false });
      const tagUid = tag?.id ? formatTagUid(tag.id) : 'UNKNOWN';
      const techTypes = tag?.techTypes ?? [];

      callbacks?.onStageChange?.('COMPATIBILITY_CHECK', `Tech: ${connectedTech ?? techTypes.join(', ')}`);

      const isMifareClassic =
        connectedTech === NfcTech.MifareClassic ||
        techTypes.some((t) => t.toLowerCase().includes('mifareclassic'));
      const isNdefConnected =
        connectedTech === NfcTech.Ndef ||
        (Platform.OS === 'android' && techTypes.some((t) => t.endsWith('.Ndef')) && connectedTech !== NfcTech.NdefFormatable);

      if (isNdefConnected) {
        const ndefStatus = await NfcManager.ndefHandler.getNdefStatus();
        if (ndefStatus.status === NdefStatus.ReadOnly) {
          throw new NfcError(
            'This NFC tag is locked read-only and cannot be overwritten.',
            'NFC_READ_ONLY_TAG'
          );
        }
        if (ndefStatus.status === NdefStatus.NotSupported) {
          throw new NfcError(
            isMifareClassic
              ? 'MIFARE Classic tag detected (such as standard blue PN532 key fobs). Most Android phones cannot write NDEF to MIFARE Classic without proprietary NXP support. Use an NTAG213, NTAG215, or NTAG216 tag.'
              : 'Detected tag does not support writable NDEF.',
            'NFC_UNSUPPORTED_TAG'
          );
        }
        if (ndefStatus.capacity > 0 && ndefStatus.capacity < ndefBytes.length) {
          throw new NfcError(
            `Tag writable capacity (${ndefStatus.capacity} bytes) is smaller than payload (${ndefBytes.length} bytes). Use NTAG213 (137B+) or larger.`,
            'NFC_INSUFFICIENT_CAPACITY'
          );
        }

        if (cancelled) throw new NfcCancelledError();
        callbacks?.onStageChange?.('WRITING_NDEF', `${ndefBytes.length} bytes`);

        await NfcManager.ndefHandler.writeNdefMessage(ndefBytes, {
          reconnectAfterWrite: true,
        });

        if (cancelled) throw new NfcCancelledError();
        callbacks?.onStageChange?.('READING_BACK', 'Verifying written NDEF record over RF...');

        const readbackTag = await NfcManager.ndefHandler.getNdefMessage();
        const readbackText = extractExactNdefText(readbackTag);

        if (!readbackText || readbackText !== payloadText) {
          throw new NfcError(
            `NDEF verification mismatch: wrote "${payloadText.slice(0, 28)}...", read back "${(readbackText ?? 'EMPTY').slice(0, 28)}...".`,
            'NFC_VERIFICATION_MISMATCH'
          );
        }

        callbacks?.onStageChange?.('VERIFIED', `${ndefBytes.length} bytes verified`);

        return {
          success: true,
          bytesWritten: ndefBytes.length,
          readbackPayload: readbackText,
          tagUid,
          capacityBytes: ndefStatus.capacity,
          techTypes,
        };
      }

      if (connectedTech === NfcTech.NdefFormatable && Platform.OS === 'android') {
        callbacks?.onStageChange?.('WRITING_NDEF', `Formatting blank tag (${ndefBytes.length} bytes)`);
        await NfcManager.ndefFormatableHandlerAndroid.formatNdef(ndefBytes, { readOnly: false });
        // Android NdefFormatable handle cannot invoke Ndef.getNdefMessage() without re-connecting as Ndef;
        // enforce truthfulness by asking the user to tap once more to verify readback.
        throw new NfcError(
          'Blank NFC tag was formatted and initial payload written. Tap the tag once more to read back and verify.',
          'NFC_FORMATTED_REVERIFY_REQUIRED'
        );
      }

      if (isMifareClassic) {
        throw new NfcError(
          'MIFARE Classic key fob/card detected. Many Android devices do not support NDEF writing on MIFARE Classic without NXP hardware. Please use a standard NTAG213, NTAG215, or NTAG216 tag.',
          'NFC_UNSUPPORTED_TAG'
        );
      }

      throw new NfcError(
        `Tag (UID ${tagUid}) is not NDEF-writable (${techTypes.join(', ') || connectedTech || 'unknown'}). Use an NTAG213/215/216 tag.`,
        'NFC_UNSUPPORTED_TAG'
      );
    })();
    writeFlow.catch(() => undefined);

    const cancelPromise = new Promise<never>((_, reject) => {
      activeCancelReject = reject;
    });

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new NfcTimeoutError()), timeoutMs);
    });

    const result = await Promise.race([writeFlow, timeout, cancelPromise]);
    if (cancelled) throw new NfcCancelledError();
    return result;
  } catch (error) {
    if (cancelled) throw new NfcCancelledError();
    throw mapNativeScanError(error);
  } finally {
    if (timer) clearTimeout(timer);
    activeCancelReject = null;
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
