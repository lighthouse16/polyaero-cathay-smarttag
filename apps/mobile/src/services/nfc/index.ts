/**
 * PolyAero Cathay SmartTag - NFC Mobile Integration Boundary
 *
 * ARCHITECTURAL NOTICE:
 * 1. Physical E-ink tags (such as 2.9" 296x128 NFC-powered displays) use vendor-specific
 *    ISO 14443-A frame protocols / custom APDU commands for energy harvesting and display refresh.
 *    Arbitrary E-ink displays CANNOT be updated via generic NDEF writes alone.
 * 2. Real native NFC reading/writing requires an Expo Development Client (`npx expo run:android` / `npx expo run:ios`)
 *    configured with `react-native-nfc-manager` and vendor display protocol commands.
 * 3. `getPhysicalHardwareService()` returns a NativeNfcService when running in a Dev Client
 *    with the native module installed. Returns `null` in Expo Go / Web / simulator.
 * 4. `demoNfcService` (`MockNfcService`) is used ONLY when the user explicitly selects
 *    "Use demo simulation".
 */

import { INfcService, MockNfcService } from '@polyaero/shared';
import { isNativeNfcModuleAvailable, nativeNfcService } from './NativeNfcService';
import { Platform } from 'react-native';

export class MobileNfcManager {
  private static demoInstance: MockNfcService | null = null;
  private static hardwareInstance: INfcService | null = null;

  /**
   * Returns a verified native E-ink hardware service when running in a Dev Client / APK
   * with react-native-nfc-manager linked. Returns `null` in Expo Go / Web / simulator.
   */
  public static getPhysicalHardwareService(): INfcService | null {
    if (MobileNfcManager.hardwareInstance) {
      return MobileNfcManager.hardwareInstance;
    }

    // Only initialize native service on physical platforms when native NfcManager module is linked
    if (Platform.OS !== 'web' && isNativeNfcModuleAvailable()) {
      MobileNfcManager.hardwareInstance = nativeNfcService;
      return MobileNfcManager.hardwareInstance;
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
    return MobileNfcManager.getPhysicalHardwareService() ?? MobileNfcManager.getDemoSimulationService();
  }
}

export const nfcService = MobileNfcManager.getInstance();
export const demoNfcService = MobileNfcManager.getDemoSimulationService();
export const getPhysicalNfcService = (): INfcService | null =>
  MobileNfcManager.getPhysicalHardwareService();
