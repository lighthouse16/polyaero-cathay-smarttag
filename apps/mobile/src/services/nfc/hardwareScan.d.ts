import type { SmartTagScanResult } from '@polyaero/shared';

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

export declare function isNfcHardwareSupported(): Promise<boolean>;
export declare function isNfcHardwareEnabled(): Promise<boolean>;
export declare function openNfcSettings(): Promise<boolean>;
export declare function scanPhysicalTag(
  timeoutMs?: number,
  callbacks?: ScanPhysicalTagCallbacks
): Promise<PhysicalTagScanDetails>;
export declare function writeNdefPayloadToTag(
  payloadText: string,
  timeoutMs?: number,
  callbacks?: ScanPhysicalTagCallbacks
): Promise<NfcWriteResult>;
export declare function cancelPhysicalTagScan(): Promise<void>;
export declare function isScanInProgress(): boolean;
export declare function formatTagUid(rawId: string): string;
