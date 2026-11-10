/** Web preview cannot access native NFC; never silently simulate hardware. */
import { NfcUnavailableError, type SmartTagScanResult } from '@polyaero/shared';

export async function scanPhysicalTag(_timeoutMs = 15000): Promise<SmartTagScanResult> {
  throw new NfcUnavailableError('Physical NFC scanning requires the Android/iOS app on an NFC-capable device.');
}

export async function cancelPhysicalTagScan(): Promise<void> {
  // No active native NFC session on web.
}
