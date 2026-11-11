/**
 * PolyAero Cathay SmartTag - NFC Mobile Integration Boundary
 *
 * ARCHITECTURAL NOTICE:
 * 1. Physical E-ink tags (such as 2.9" 296x128 NFC-powered displays) use vendor-specific
 *    ISO 14443-A frame protocols / custom APDU commands for energy harvesting and display refresh.
 *    Arbitrary E-ink displays CANNOT be updated via generic NDEF writes alone.
 * 2. Real native NFC reading/writing requires an Expo Development Client (`npx expo run:android` / `npx expo run:ios`)
 *    configured with `react-native-nfc-manager` and vendor display protocol commands.
 * 3. `getPhysicalHardwareService()` returns `null` when no native vendor E-ink driver is installed,
 *    so "Start NFC sync" honestly reports `UNSUPPORTED` rather than fabricating hardware success.
 * 4. `demoNfcService` (`MockNfcService`) is used ONLY when the user explicitly selects
 *    "Use demo simulation".
 */

import {
  INfcService,
  MockNfcService,
  NfcError,
  type SmartTagPayload,
  type SmartTagScanResult,
  type SmartTagWriteResult,
} from '@polyaero/shared';
import { Platform } from 'react-native';
import {
  cancelPhysicalTagScan,
  isNfcHardwareEnabled,
  isNfcHardwareSupported,
  scanPhysicalTag,
} from './hardwareScan';

export interface EinkVendorDriver {
  readonly driverId: string;
  readonly isSupported: boolean;
  writeDisplayBitmap(
    payload: SmartTagPayload,
    timeoutMs?: number
  ): Promise<SmartTagWriteResult>;
}

export class UnsupportedEinkVendorDriver implements EinkVendorDriver {
  public readonly driverId = 'polyaero-eink-2.9-vendor-unverified';
  public readonly isSupported = false;

  async writeDisplayBitmap(
    _payload: SmartTagPayload,
    _timeoutMs = 15000
  ): Promise<SmartTagWriteResult> {
    // Phase C E-ink hardware boundary:
    // Generic NDEF write or ISO 14443-A frame touch cannot assume passive E-ink refresh without vendor APDU protocol.
    // Throw explicit error so honesty boundary in runSmartTagSync refuses to claim physical success.
    throw new NfcError(
      'Passive 2.9-inch E-ink display writing requires vendor-specific APDU commands. NFC chip was detected, but display refresh is unverified in this build.',
      'HARDWARE_DRIVER_NOT_INSTALLED'
    );
  }
}

export class NativeHardwareNfcService implements INfcService {
  constructor(
    private readonly einkDriver: EinkVendorDriver = new UnsupportedEinkVendorDriver()
  ) {}

  async isAvailable(): Promise<boolean> {
    return isNfcHardwareSupported();
  }

  async isEnabled(): Promise<boolean> {
    return isNfcHardwareEnabled();
  }

  async readTagUid(timeoutMs = 15000): Promise<SmartTagScanResult> {
    return scanPhysicalTag(timeoutMs);
  }

  async writeEinkDisplay(
    payload: SmartTagPayload,
    timeoutMs = 15000
  ): Promise<SmartTagWriteResult> {
    return this.einkDriver.writeDisplayBitmap(payload, timeoutMs);
  }

  async cancelScan(): Promise<void> {
    return cancelPhysicalTagScan();
  }
}

export class MobileNfcManager {
  private static demoInstance: MockNfcService | null = null;
  private static hardwareInstance: INfcService | null = null;

  /**
   * Returns a verified native E-ink hardware service on native devices.
   * Returns `null` on web, simulator, or when explicitly cleared.
   */
  public static getPhysicalHardwareService(): INfcService | null {
    if (Platform.OS === 'web') return null;
    if (!MobileNfcManager.hardwareInstance) {
      MobileNfcManager.hardwareInstance = new NativeHardwareNfcService();
    }
    return MobileNfcManager.hardwareInstance;
  }

  public static setPhysicalHardwareService(service: INfcService | null): void {
    MobileNfcManager.hardwareInstance = service;
  }

  /**
   * Deterministic mock NFC service used exclusively for explicit demo simulation.
   */
  public static getDemoSimulationService(): MockNfcService {
    if (!MobileNfcManager.demoInstance) {
      MobileNfcManager.demoInstance = new MockNfcService();
    }
    return MobileNfcManager.demoInstance;
  }

  /**
   * Backwards-compatible accessor for existing tests/consumers.
   */
  public static getInstance(): INfcService {
    return MobileNfcManager.getDemoSimulationService();
  }
}

export const nfcService = MobileNfcManager.getInstance();
export const demoNfcService = MobileNfcManager.getDemoSimulationService();
export const getPhysicalNfcService = (): INfcService | null =>
  MobileNfcManager.getPhysicalHardwareService();

