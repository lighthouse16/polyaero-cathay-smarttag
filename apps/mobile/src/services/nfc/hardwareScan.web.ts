/** Web preview cannot access native NFC; never silently simulate hardware. */
import { NfcUnavailableError, type SmartTagScanResult } from '@polyaero/shared';

export interface PhysicalTagScanDetails extends SmartTagScanResult {
  techTypes?: string[];
  ndefText?: string | null;
}

export function formatTagUid(rawId: string): string {
  const hex = rawId.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!hex || hex.length % 2 !== 0) return rawId.trim().toUpperCase();
  return hex.match(/.{2}/g)?.join(':') ?? rawId.trim().toUpperCase();
}

export async function isNfcHardwareSupported(): Promise<boolean> {
  return false;
}

export async function isNfcHardwareEnabled(): Promise<boolean> {
  return false;
}

export async function openNfcSettings(): Promise<boolean> {
  return false;
}

export async function scanPhysicalTag(_timeoutMs = 15000): Promise<PhysicalTagScanDetails> {
  throw new NfcUnavailableError('Physical NFC scanning requires the Android/iOS app on an NFC-capable device.');
}

export async function cancelPhysicalTagScan(): Promise<void> {
  // No active native NFC session on web.
}
