import type { SmartTagScanResult } from '@polyaero/shared';

export interface PhysicalTagScanDetails extends SmartTagScanResult {
  techTypes?: string[];
  ndefText?: string | null;
}

export declare function isNfcHardwareSupported(): Promise<boolean>;
export declare function isNfcHardwareEnabled(): Promise<boolean>;
export declare function openNfcSettings(): Promise<boolean>;
export declare function scanPhysicalTag(timeoutMs?: number): Promise<PhysicalTagScanDetails>;
export declare function cancelPhysicalTagScan(): Promise<void>;
export declare function formatTagUid(rawId: string): string;


