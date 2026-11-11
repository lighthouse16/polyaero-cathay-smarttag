/**
 * PolyAero Cathay SmartTag — NFC Sync State Machine & Honesty Boundary
 *
 * Implements the 11 distinguishable states for Screen 03 (`Sync SmartTag`):
 *   IDLE → CHECKING_AVAILABILITY → READY_TO_SCAN → SCANNING → TAG_DETECTED →
 *   WRITING → VERIFYING → SUCCESS | FAILED | CANCELLED | UNSUPPORTED
 *
 * Honesty rules enforced here:
 *   1. If `mode === 'PHYSICAL_HARDWARE'` and no native vendor E-ink driver is
 *      supplied (`service === null`), the state machine transitions through
 *      `CHECKING_AVAILABILITY` to `UNSUPPORTED` with an explicit prompt to use
 *      demo simulation. It never silently falls back to `MockNfcService`.
 *   2. If a hardware service is supplied, `setupState` becomes
 *      `PHYSICALLY_WRITTEN_AND_VERIFIED` ONLY when `!writeResult.isMockSimulation`
 *      AND `writeResult.verifiedReadback === true` AND the scanned UID matches
 *      the expected SmartTag UID.
 *   3. A generic NFC scan or unverified write never marks the physical E-ink tag
 *      as synchronized.
 *   4. When `mode === 'SIMULATED_DEMO'`, every step carries `isSimulated: true`
 *      and the final setup state is `SIMULATED_WRITE_COMPLETED`.
 *   5. Any write failure leaves or sets `setupState = 'WRITE_FAILED'` and never
 *      reports synchronization.
 */

import {
  INfcService,
  NfcError,
  NfcWrongTagError,
  SmartTagPayload,
} from '../services/nfc';
import {
  NFC_STATE_MESSAGES,
  NfcSyncMachineState,
  NfcSyncOutcome,
  NfcSyncStepUpdate,
  SmartTagErrorCode,
  SmartTagFailureInfo,
  SyncExecutionMode,
} from './types';

export interface RunSmartTagSyncOptions {
  mode: SyncExecutionMode;
  /** Hardware or mock NFC service. Pass `null` when native E-ink driver is not installed. */
  service: INfcService | null;
  payload: SmartTagPayload;
  expectedTagUid: string;
  /** Optional delay between visible progress steps in simulation mode (ms). Default 180ms. */
  stepDelayMs?: number;
  onStep?: (update: NfcSyncStepUpdate) => void;
}

const delay = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

export function mapNfcErrorToFailureInfo(error: unknown): SmartTagFailureInfo {
  if (error instanceof NfcWrongTagError) {
    return {
      code: 'NFC_WRONG_TAG',
      title: 'Different SmartTag detected',
      message: `Scanned tag (${error.detectedUid}) does not match assigned SmartTag (${error.expectedUid}).`,
      recoveryHint: 'Hold your phone near the assigned SmartTag or re-select your tag in Prepare SmartTag.',
      canRetry: true,
      canSwitchToDemo: true,
      canOpenSettings: false,
    };
  }

  if (error instanceof NfcError) {
    switch (error.code) {
      case 'NFC_UNAVAILABLE':
        return {
          code: 'NFC_UNAVAILABLE',
          title: 'NFC not available on this device',
          message: 'This device or browser environment does not expose compatible NFC hardware.',
          recoveryHint: 'Use demo simulation to preview the passenger SmartTag workflow.',
          canRetry: false,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
      case 'NFC_DISABLED':
        return {
          code: 'NFC_DISABLED',
          title: 'NFC is turned off',
          message: 'Enable NFC in your device wireless settings before scanning your SmartTag.',
          recoveryHint: 'Turn on NFC in device settings, then tap Retry, or use demo simulation.',
          canRetry: true,
          canSwitchToDemo: true,
          canOpenSettings: true,
        };
      case 'NFC_TIMEOUT':
        return {
          code: 'NFC_TIMEOUT',
          title: 'SmartTag not detected in time',
          message: 'No SmartTag entered the NFC field before the scan session timed out.',
          recoveryHint: 'Hold the top of your phone steady against the SmartTag and retry.',
          canRetry: true,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
      case 'NFC_CANCELLED':
        return {
          code: 'NFC_CANCELLED',
          title: 'NFC sync cancelled',
          message: 'You cancelled the NFC scan before the E-ink display was updated.',
          recoveryHint: 'Tap Start NFC sync when you are ready to try again.',
          canRetry: true,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
      case 'NFC_WRITE_FAILED':
        return {
          code: 'NFC_WRITE_FAILED',
          title: 'Could not update SmartTag display',
          message: 'RF coupling was interrupted while transmitting the E-ink display frame.',
          recoveryHint: 'Keep your phone flat against the tag until verification completes, then retry.',
          canRetry: true,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
      case 'NFC_OPERATION_IN_PROGRESS':
        return {
          code: 'NFC_OPERATION_IN_PROGRESS',
          title: 'NFC session already active',
          message: 'Another NFC scan or write is currently running.',
          recoveryHint: 'Cancel the current scan or wait a moment before retrying.',
          canRetry: true,
          canSwitchToDemo: false,
          canOpenSettings: false,
        };
      case 'NFC_UNSUPPORTED_TAG':
      case 'NFC_UID_UNAVAILABLE':
        return {
          code: 'NFC_UNSUPPORTED_TAG',
          title: 'Unsupported NFC tag',
          message: error.message || 'The detected NFC chip does not expose a readable UID or supported technology.',
          recoveryHint: 'Hold a standard ISO 14443-A or NDEF tag near the phone, or use demo simulation.',
          canRetry: true,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
      case 'HARDWARE_DRIVER_NOT_INSTALLED':
        return {
          code: 'HARDWARE_DRIVER_NOT_INSTALLED',
          title: 'Physical E-ink display writer not active in this build',
          message: error.message || 'Updating a 2.9-inch passive E-ink SmartTag requires the vendor ISO 14443-A display protocol.',
          recoveryHint: 'Select "Use demo simulation" to walk through the simulated sync flow.',
          canRetry: false,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
      default:
        return {
          code: 'INVALID_PAYLOAD',
          title: 'Invalid baggage payload',
          message: error.message || 'Baggage details are incomplete for E-ink transmission.',
          recoveryHint: 'Return to Prepare SmartTag and confirm your flight and baggage details.',
          canRetry: false,
          canSwitchToDemo: false,
          canOpenSettings: false,
        };
    }
  }

  return {
    code: 'NFC_WRITE_FAILED' as SmartTagErrorCode,
    title: 'Could not update SmartTag',
    message: error instanceof Error ? error.message : 'Unexpected NFC communication error.',
    recoveryHint: 'Retry the NFC scan or switch to demo simulation.',
    canRetry: true,
    canSwitchToDemo: true,
    canOpenSettings: false,
  };
}

export async function runSmartTagSync(options: RunSmartTagSyncOptions): Promise<NfcSyncOutcome> {
  const {
    mode,
    service,
    payload,
    expectedTagUid,
    stepDelayMs = mode === 'SIMULATED_DEMO' ? 160 : 0,
    onStep,
  } = options;
  const isSimulated = mode === 'SIMULATED_DEMO';

  const emit = (
    state: NfcSyncMachineState,
    customMessage?: string,
    extra?: Partial<NfcSyncStepUpdate>
  ) => {
    onStep?.({
      state,
      statusMessage: customMessage ?? NFC_STATE_MESSAGES[state],
      isSimulated,
      ...extra,
    });
  };

  emit('CHECKING_AVAILABILITY');
  await delay(stepDelayMs);

  // Physical mode without an installed vendor E-ink driver must report UNSUPPORTED honestly.
  if (!service) {
    const failure: SmartTagFailureInfo = {
      code: 'HARDWARE_DRIVER_NOT_INSTALLED',
      title: 'Physical E-ink NFC driver not active in this build',
      message:
        'Updating a 2.9-inch passive E-ink SmartTag requires a native development build with the vendor ISO 14443-A display protocol.',
      recoveryHint: 'Select "Use demo simulation" below to walk through the simulated sync flow.',
      canRetry: false,
      canSwitchToDemo: true,
      canOpenSettings: false,
    };
    emit('UNSUPPORTED', failure.title, { failure });
    return {
      finalState: 'UNSUPPORTED',
      setupState: 'PENDING_PHYSICAL_WRITE',
      mode,
      writeRecord: null,
      failure,
      payload,
    };
  }

  try {
    const available = await service.isAvailable();
    if (!available) {
      const failure = mapNfcErrorToFailureInfo(new NfcError('NFC unavailable', 'NFC_UNAVAILABLE'));
      emit('UNSUPPORTED', failure.title, { failure });
      return {
        finalState: 'UNSUPPORTED',
        setupState: 'PENDING_PHYSICAL_WRITE',
        mode,
        writeRecord: null,
        failure,
        payload,
      };
    }

    const enabled = await service.isEnabled();
    if (!enabled) {
      const failure = mapNfcErrorToFailureInfo(new NfcError('NFC disabled', 'NFC_DISABLED'));
      emit('FAILED', NFC_STATE_MESSAGES.FAILED, { failure });
      return {
        finalState: 'FAILED',
        setupState: 'PENDING_PHYSICAL_WRITE',
        mode,
        writeRecord: null,
        failure,
        payload,
      };
    }

    emit('READY_TO_SCAN');
    await delay(stepDelayMs);

    emit('SCANNING', NFC_STATE_MESSAGES.SCANNING);

    const scanResult = await service.readTagUid();
    if (
      expectedTagUid &&
      scanResult.tagUid.toUpperCase() !== expectedTagUid.toUpperCase()
    ) {
      throw new NfcWrongTagError(expectedTagUid, scanResult.tagUid);
    }

    emit(
      'TAG_DETECTED',
      `SmartTag detected (${scanResult.tagUid})`,
      { detectedUid: scanResult.tagUid }
    );
    await delay(stepDelayMs);

    emit(
      'WRITING',
      NFC_STATE_MESSAGES.WRITING,
      { detectedUid: scanResult.tagUid }
    );
    const writeResult = await service.writeEinkDisplay({
      ...payload,
      tagUid: scanResult.tagUid,
    });

    if (!writeResult.success) {
      throw new NfcError('E-ink frame write reported unsuccessful status.', 'NFC_WRITE_FAILED');
    }

    emit(
      'VERIFYING',
      NFC_STATE_MESSAGES.VERIFYING,
      { detectedUid: scanResult.tagUid }
    );
    await delay(stepDelayMs);

    // Honesty gate: physical mode MUST NOT accept a mock service result or an unverified readback.
    if (mode === 'PHYSICAL_HARDWARE') {
      if (writeResult.isMockSimulation || writeResult.verifiedReadback !== true) {
        const failure: SmartTagFailureInfo = {
          code: 'NFC_UNVERIFIED_READBACK',
          title: 'E-ink display update could not be verified',
          message:
            'A generic NFC response was received, but the vendor E-ink display controller did not confirm frame refresh.',
          recoveryHint: 'Hold the phone steady against the SmartTag and retry, or use demo simulation.',
          canRetry: true,
          canSwitchToDemo: true,
          canOpenSettings: false,
        };
        emit('FAILED', NFC_STATE_MESSAGES.FAILED, { failure });
        return {
          finalState: 'FAILED',
          setupState: 'WRITE_FAILED',
          mode,
          writeRecord: null,
          failure,
          payload,
        };
      }

      const writeRecord = {
        mode: 'PHYSICAL_HARDWARE' as const,
        timestamp: writeResult.timestamp,
        bytesWritten: writeResult.bytesWritten,
        tagUid: writeResult.tagUid,
        verifiedHardwareReadback: true,
      };
      emit('SUCCESS', NFC_STATE_MESSAGES.SUCCESS, { detectedUid: writeResult.tagUid });
      return {
        finalState: 'SUCCESS',
        setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED',
        mode,
        writeRecord,
        failure: null,
        payload,
      };
    }

    // Simulated demo mode
    const writeRecord = {
      mode: 'SIMULATED_DEMO' as const,
      timestamp: writeResult.timestamp,
      bytesWritten: writeResult.bytesWritten,
      tagUid: writeResult.tagUid,
      verifiedHardwareReadback: false,
    };
    emit('SUCCESS', 'SmartTag update simulated', { detectedUid: writeResult.tagUid });
    return {
      finalState: 'SUCCESS',
      setupState: 'SIMULATED_WRITE_COMPLETED',
      mode,
      writeRecord,
      failure: null,
      payload,
    };
  } catch (err) {
    const failure = mapNfcErrorToFailureInfo(err);
    if (failure.code === 'NFC_CANCELLED') {
      emit('CANCELLED', NFC_STATE_MESSAGES.CANCELLED, { failure });
      return {
        finalState: 'CANCELLED',
        setupState: 'PENDING_PHYSICAL_WRITE',
        mode,
        writeRecord: null,
        failure,
        payload,
      };
    }
    if (failure.code === 'NFC_UNAVAILABLE' || failure.code === 'HARDWARE_DRIVER_NOT_INSTALLED') {
      emit('UNSUPPORTED', failure.title, { failure });
      return {
        finalState: 'UNSUPPORTED',
        setupState: 'PENDING_PHYSICAL_WRITE',
        mode,
        writeRecord: null,
        failure,
        payload,
      };
    }

    const nextSetupState =
      failure.code === 'NFC_WRITE_FAILED' || failure.code === 'NFC_WRONG_TAG'
        ? 'WRITE_FAILED'
        : 'PENDING_PHYSICAL_WRITE';

    emit('FAILED', NFC_STATE_MESSAGES.FAILED, { failure });
    return {
      finalState: 'FAILED',
      setupState: nextSetupState,
      mode,
      writeRecord: null,
      failure,
      payload,
    };
  }
}
