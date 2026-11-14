/**
 * PolyAero Cathay SmartTag - NFC Mobile Integration Boundary
 *
 * ARCHITECTURAL NOTICE:
 * 1. Physical sync supports the ESP32-C6 MicroPython PN532 bridge's PA1 protocol,
 *    not arbitrary passive E-ink tags or the Arduino bridge.
 * 2. Native NFC requires an Expo Development Client and updated bridge firmware.
 * 3. `getPhysicalHardwareService()` returns a NativeNfcService when running in a Dev Client
 *    with the native module installed. Web and missing modules return `null`;
 *    the service checks device availability before scanning.
 * 4. `demoNfcService` (`MockNfcService`) is used ONLY when the user explicitly selects
 *    "Use demo simulation".
 */

import { INfcService, MockNfcService } from '@polyaero/shared';
import { Platform } from 'react-native';

export class MobileNfcManager {
  private static demoInstance: MockNfcService | null = null;
  private static hardwareInstance: INfcService | null = null;

  /**
   * Returns the MicroPython bridge service when running in a Dev Client
   * with react-native-nfc-manager installed. Web and missing modules return `null`.
   */
  public static getPhysicalHardwareService(): INfcService | null {
    if (MobileNfcManager.hardwareInstance) {
      return MobileNfcManager.hardwareInstance;
    }

    // Only initialize native service on physical platforms (not web)
    if (Platform.OS !== 'web') {
      try {
        /* eslint-disable @typescript-eslint/no-require-imports -- Keep the native module out of web startup. */
        const nativeModule =
          require('./NativeNfcService') as typeof import('./NativeNfcService');
        /* eslint-enable @typescript-eslint/no-require-imports */
        MobileNfcManager.hardwareInstance = nativeModule.nativeNfcService;
        return MobileNfcManager.hardwareInstance;
      } catch {
        return null;
      }
    }

    return null;
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
   * Backwards-compatible accessor for existing tests/Consumers.
   */
  public static getInstance(): INfcService {
    // Prefer native service on physical devices, fallback to demo
    return (
      MobileNfcManager.getPhysicalHardwareService() ??
      MobileNfcManager.getDemoSimulationService()
    );
  }
}

export const nfcService = MobileNfcManager.getInstance();
export const demoNfcService = MobileNfcManager.getDemoSimulationService();
export const getPhysicalNfcService = (): INfcService | null =>
  MobileNfcManager.getPhysicalHardwareService();
