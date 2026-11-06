/**
 * PolyAero Cathay SmartTag - NFC Mobile Integration Boundary
 *
 * ARCHITECTURAL NOTICE:
 * 1. Physical E-ink tags (such as 2.9" or 4.2" NFC-powered displays) use vendor-specific
 *    ISO 14443-A frame protocols / custom APDU commands for energy harvesting and display refresh.
 *    Arbitrary E-ink displays CANNOT be updated via generic NDEF writes alone.
 * 2. Real native NFC reading/writing requires an Expo Development Client (`npx expo run:android` / `npx expo run:ios`)
 *    configured with `react-native-nfc-manager` and native entitlements.
 * 3. In Phase 0 and simulator/Expo Go environments, this service defaults to `MockNfcService`
 *    to guarantee uninterrupted developer workflow without crashing native bridges.
 */

import { INfcService, MockNfcService } from '@polyaero/shared';

export class MobileNfcManager {
  private static instance: INfcService | null = null;

  public static getInstance(): INfcService {
    if (!MobileNfcManager.instance) {
      // Future enhancement: detect Expo Development Build native NFC availability
      // if (hasNativeNfcModule()) {
      //   MobileNfcManager.instance = new NativeNfcService();
      // }
      MobileNfcManager.instance = new MockNfcService();
    }
    return MobileNfcManager.instance;
  }
}

export const nfcService = MobileNfcManager.getInstance();
