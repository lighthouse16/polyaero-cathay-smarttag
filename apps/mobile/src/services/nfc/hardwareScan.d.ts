import type { SmartTagScanResult } from '@polyaero/shared';
export declare function scanPhysicalTag(timeoutMs?: number): Promise<SmartTagScanResult>;
export declare function cancelPhysicalTagScan(): Promise<void>;
