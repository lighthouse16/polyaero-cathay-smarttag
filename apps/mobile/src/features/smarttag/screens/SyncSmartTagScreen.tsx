/**
 * Screen 03 — Sync SmartTag (Matches references/03_sync_smarttag.png)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  INfcService,
  NfcCancelledError,
  NFC_STATE_MESSAGES,
  NfcSyncMachineState,
  SmartTagFailureInfo,
  buildNfcPayloadForBag,
  encodeNfcRecord,
  runSmartTagSync,
} from '@polyaero/shared';
import {
  CATHAY_JADE,
  CATHAY_SERIF,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CATHAY_TEXT_MUTED,
  CathayPrimaryButton,
  CathayScreenHeader,
  HeaderSoftWave,
  NFC_PHONE_TAG_SCENE,
  InlineNotice,
} from '../components/CathaySmartTagPrimitives';
import { SmartTagStepper } from '../components/SmartTagStepper';
import { demoNfcService, getPhysicalNfcService } from '../../../services/nfc';
import {
  scanPhysicalTag,
  writeNdefPayloadToTag,
  cancelPhysicalTagScan,
  openNfcSettings,
  type NdefWriteStage,
  type NfcWriteResult,
  type PhysicalTagScanDetails,
} from '../../../services/nfc/hardwareScan';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

export type PhysicalScanStage =
  | 'READY'
  | 'SCANNING'
  | 'TAG_DETECTED'
  | 'UID_READ'
  | 'PAIRING'
  | 'PAIRED'
  | 'DISABLED'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED_TAG'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'FAILED';

const NDEF_STAGE_ORDER: NdefWriteStage[] = [
  'READY',
  'TAG_DETECTED',
  'COMPATIBILITY_CHECK',
  'WRITING_NDEF',
  'READING_BACK',
  'VERIFIED',
];

const NDEF_STAGE_LABELS: Record<NdefWriteStage, string> = {
  READY: 'READY',
  TAG_DETECTED: 'TAG DETECTED',
  COMPATIBILITY_CHECK: 'COMPATIBILITY CHECK',
  WRITING_NDEF: 'WRITING NDEF',
  READING_BACK: 'READING BACK',
  VERIFIED: 'VERIFIED',
};

export interface SyncSmartTagScreenProps {
  onOpenDevMenu?: () => void;
}

export const SyncSmartTagScreen: React.FC<SyncSmartTagScreenProps> = ({
  onOpenDevMenu,
}) => {
  const { repo } = useSmartTagStore();
  const itinerary =
    (repo.activeItineraryId
      ? repo.itineraries.find((i) => i.id === repo.activeItineraryId)
      : repo.itineraries[0]) ?? null;

  const bags = itinerary ? repo.bagSetupsByItinerary[itinerary.id] ?? [] : [];
  const activeBag =
    (repo.activeBagSetupId ? bags.find((b) => b.id === repo.activeBagSetupId) : bags[0]) ??
    bags[0] ??
    null;

  const [machineState, setMachineState] = useState<NfcSyncMachineState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>(NFC_STATE_MESSAGES.IDLE);
  const [failure, setFailure] = useState<SmartTagFailureInfo | null>(null);
  const persistedPairedUid = activeBag?.pairedPhysicalUid ?? null;
  const [isReadingChip, setIsReadingChip] = useState(false);
  const [scanStage, setScanStage] = useState<PhysicalScanStage>(
    persistedPairedUid ? 'PAIRED' : 'READY'
  );
  const [physicalTagUid, setPhysicalTagUid] = useState<string | null>(persistedPairedUid);
  const [physicalScanDetails, setPhysicalScanDetails] = useState<PhysicalTagScanDetails | null>(
    persistedPairedUid ? { tagUid: persistedPairedUid, isMockSimulation: false } : null
  );
  const [pairedPhysicalUid, setPairedPhysicalUid] = useState<string | null>(persistedPairedUid);
  const [physicalScanError, setPhysicalScanError] = useState<string | null>(null);
  const [isWritingNdef, setIsWritingNdef] = useState(false);
  const [ndefWriteStage, setNdefWriteStage] = useState<NdefWriteStage>('READY');
  const [ndefRevision, setNdefRevision] = useState<number>(1);
  const [ndefStatusCode, setNdefStatusCode] = useState<'TAGGED' | 'PRIORITY_TRANSFER'>('TAGGED');
  const [ndefWriteResult, setNdefWriteResult] = useState<NfcWriteResult | null>(null);
  const [ndefWriteError, setNdefWriteError] = useState<{ title: string; message: string; code?: string } | null>(null);
  const session = useRef<{ service: INfcService; cancelled: boolean } | null>(null);

  useEffect(() => () => {
    if (session.current) {
      session.current.cancelled = true;
      void session.current.service.cancelScan().catch(() => {});
    }
    void cancelPhysicalTagScan().catch(() => {});
  }, []);

  const cancelSync = async () => {
    if (!session.current) return;
    session.current.cancelled = true;
    try {
      await session.current.service.cancelScan();
    } finally {
      setMachineState('CANCELLED');
      setStatusMessage(NFC_STATE_MESSAGES.CANCELLED);
    }
  };

  if (!itinerary || !activeBag) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Cathay SmartTag"
          backIcon="chevron-back"
          onBack={() => smartTagController.goBack()}
          onLongPressTitle={onOpenDevMenu}
        />
        <View style={styles.emptyWrap}>
          <InlineNotice
            tone="warning"
            title="Baggage details not prepared"
            message="Complete Prepare SmartTag first so a baggage identity can be assigned."
            actionLabel="Go to Prepare SmartTag"
            onAction={() => smartTagController.navigateTo('prepare')}
          />
        </View>
      </View>
    );
  }

  const isBusy =
    machineState === 'CHECKING_AVAILABILITY' ||
    machineState === 'READY_TO_SCAN' ||
    machineState === 'SCANNING' ||
    machineState === 'TAG_DETECTED' ||
    machineState === 'WRITING' ||
    machineState === 'VERIFYING';

  const tryCommitPhysicalPairing = (bagId: string, uid: string): boolean => {
    let pairingCommitted = false;
    let pairingErrorMsg: string | null = null;
    try {
      const paired = smartTagRepository.pairPhysicalTagToBag?.(bagId, uid);
      const persistence = smartTagRepository.getLastPersistenceResult?.();
      if (paired && (!persistence || persistence.committed)) {
        pairingCommitted = true;
      } else {
        pairingErrorMsg =
          persistence?.error ?? 'Could not verify persistent storage write for NFC pairing.';
      }
    } catch (pairErr) {
      pairingCommitted = false;
      const msg = (pairErr as { message?: string } | null)?.message;
      pairingErrorMsg = msg ?? 'Could not write NFC pairing to persistent storage.';
    }

    if (pairingCommitted) {
      setPairedPhysicalUid(uid);
      setScanStage('PAIRED');
    } else {
      setPairedPhysicalUid(null);
      setScanStage('UID_READ');
      setPhysicalScanError(pairingErrorMsg ?? 'Could not pair NFC tag to baggage setup.');
    }
    return pairingCommitted;
  };

  const handleScanChip = async () => {
    if (isBusy || isReadingChip || isWritingNdef || session.current) return;
    setPhysicalScanError(null);
    setPhysicalScanDetails(null);
    setScanStage('SCANNING');
    setIsReadingChip(true);
    try {
      const result = await scanPhysicalTag(15000, {
        onTagDetected: () => setScanStage('TAG_DETECTED'),
      });
      setPhysicalTagUid(result.tagUid);
      setPhysicalScanDetails(result);
      setScanStage('UID_READ');

      setScanStage('PAIRING');
      tryCommitPhysicalPairing(activeBag.id, result.tagUid);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'NFC_UNAVAILABLE') {
        setScanStage('UNAVAILABLE');
        setPhysicalScanError('No NFC hardware detected on this device.');
      } else if (code === 'NFC_DISABLED') {
        setScanStage('DISABLED');
        setPhysicalScanError('NFC is disabled on this device. Enable NFC in Wireless Settings.');
      } else if (code === 'NFC_TIMEOUT') {
        setScanStage('TIMEOUT');
        setPhysicalScanError('Scan timed out before a tag was detected.');
      } else if (code === 'NFC_CANCELLED') {
        setScanStage('CANCELLED');
        setPhysicalScanError('NFC chip scan cancelled.');
      } else if (code === 'NFC_UNSUPPORTED_TAG' || code === 'NFC_UID_UNAVAILABLE') {
        setScanStage('UNSUPPORTED_TAG');
        setPhysicalScanError('Unsupported NFC tag detected (UID unreadable).');
      } else {
        setScanStage('FAILED');
        setPhysicalScanError(error instanceof Error ? error.message : 'NFC chip scan failed.');
      }
    } finally {
      setIsReadingChip(false);
    }
  };

  const buildCanonicalPayloadText = (): string => {
    const rawTagId = activeBag.smartTagCode || 'ST-2048';
    const rawBagId = activeBag.baggage?.tagNumber || activeBag.displayBagCode || '0160123456';
    const rawFlight = itinerary.flight?.flightNumber || 'CX548';
    const rawFrom = itinerary.flight?.origin || 'HKG';
    const rawTo = itinerary.flight?.destination || 'NRT';

    if (typeof encodeNfcRecord === 'function') {
      return encodeNfcRecord({
        v: 1,
        tagId: rawTagId,
        bagId: rawBagId,
        flight: rawFlight,
        from: rawFrom,
        to: rawTo,
        status: ndefStatusCode,
        rev: ndefRevision,
      });
    }
    return `PA2|1|${rawTagId}|${rawBagId}|${rawFlight}|${rawFrom}|${rawTo}|${ndefStatusCode}|${ndefRevision}`;
  };

  const handleWriteNdefPayload = async () => {
    if (isBusy || isReadingChip || isWritingNdef || session.current) return;
    setNdefWriteError(null);
    setNdefWriteResult(null);
    setNdefWriteStage('READY');
    setIsWritingNdef(true);

    try {
      const payloadText = buildCanonicalPayloadText();
      const result = await writeNdefPayloadToTag(payloadText, 20000, {
        onStageChange: (stage) => {
          setNdefWriteStage(stage);
        },
      });

      // Honesty gate: state updates ONLY after verified readback matches payloadText byte-for-byte.
      if (!result.success || result.readbackPayload !== payloadText) {
        setNdefWriteStage('READY');
        setNdefWriteError({
          title: 'Write verification failed',
          message: 'NDEF readback did not match written baggage payload.',
          code: 'NFC_VERIFICATION_MISMATCH',
        });
        return;
      }

      setNdefWriteStage('VERIFIED');
      setNdefWriteResult(result);
      setPhysicalTagUid(result.tagUid);
      setPhysicalScanDetails({
        tagUid: result.tagUid,
        techTypes: result.techTypes,
        ndefText: result.readbackPayload,
        isMockSimulation: false,
      });

      // Attempt durable UID-to-bag pairing commit without masking write verification.
      tryCommitPhysicalPairing(activeBag.id, result.tagUid);
    } catch (error) {
      setNdefWriteStage('READY');
      const code = (error as { code?: string } | null)?.code;
      const msg =
        (error as { message?: string } | null)?.message ||
        'Failed to write NDEF payload to NFC tag.';
      if (code === 'NFC_READ_ONLY_TAG') {
        setNdefWriteError({ title: 'Read-only NFC tag', message: msg, code });
      } else if (code === 'NFC_INSUFFICIENT_CAPACITY') {
        setNdefWriteError({ title: 'Insufficient tag capacity', message: msg, code });
      } else if (code === 'NFC_UNSUPPORTED_TAG') {
        setNdefWriteError({ title: 'Incompatible NFC tag', message: msg, code });
      } else if (code === 'NFC_VERIFICATION_MISMATCH') {
        setNdefWriteError({ title: 'Write verification failed', message: msg, code });
      } else if (code === 'NFC_TAG_REMOVED') {
        setNdefWriteError({ title: 'Tag removed prematurely', message: msg, code });
      } else if (code === 'NFC_FORMATTED_REVERIFY_REQUIRED') {
        setNdefWriteError({ title: 'Tag formatted — tap again to verify', message: msg, code });
      } else if (code === 'NFC_DISABLED') {
        setNdefWriteError({
          title: 'NFC is disabled',
          message: 'Enable NFC in Wireless Settings to write baggage payload to tag.',
          code,
        });
      } else if (code === 'NFC_UNAVAILABLE') {
        setNdefWriteError({ title: 'No NFC hardware', message: msg, code });
      } else if (code === 'NFC_TIMEOUT') {
        setNdefWriteError({ title: 'NFC write timed out', message: 'Hold a writable NTAG213/215/216 tag steady against your phone.', code });
      } else if (code === 'NFC_CANCELLED') {
        setNdefWriteError({ title: 'NFC write cancelled', message: 'NDEF write session cancelled before completion.', code });
      } else {
        setNdefWriteError({ title: 'NFC write failed', message: msg, code });
      }
    } finally {
      setIsWritingNdef(false);
    }
  };

  const handleStartSync = async (forceDemo = false) => {
    if (isBusy || isReadingChip || isWritingNdef || session.current) return;
    if (activeBag.setupState === 'UNREGISTERED') {
      smartTagController.navigateTo('prepare', { itineraryId: itinerary.id, bagSetupId: activeBag.id });
      return;
    }
    const bag = activeBag;
    setFailure(null);

    const payload = buildNfcPayloadForBag(itinerary, bag);
    const physicalService = forceDemo ? null : getPhysicalNfcService();
    if (!forceDemo && !physicalService) {
      setFailure({
        code: 'NFC_UNAVAILABLE',
        title: 'Physical NFC unavailable',
        message: 'Use a supported native device for physical writing, or choose Run demo simulation.',
        recoveryHint: 'Choose demo simulation or retry on supported hardware.',
        canRetry: true,
        canSwitchToDemo: true,
        canOpenSettings: false,
      });
      return;
    }
    const effectiveService = physicalService ?? demoNfcService;
    demoNfcService.setMockTag(payload);
    const operation = { service: effectiveService, cancelled: false };
    session.current = operation;

    const outcome = await runSmartTagSync({
      mode: physicalService ? 'PHYSICAL_HARDWARE' : 'SIMULATED_DEMO',
      service: effectiveService,
      payload,
      expectedTagUid: physicalService && !pairedPhysicalUid ? '' : bag.smartTag.tagUid,
      stepDelayMs: physicalService ? 0 : 140,
      onStep: (step) => {
        if (operation.cancelled) {
          if (step.state === 'SCANNING' || step.state === 'WRITING') throw new NfcCancelledError();
          return;
        }
        setMachineState(step.state);
        setStatusMessage(step.statusMessage);
        if (physicalService && step.state === 'TAG_DETECTED' && step.detectedUid) {
          setPhysicalTagUid(step.detectedUid);
          setPhysicalScanDetails({ tagUid: step.detectedUid, isMockSimulation: false });
          tryCommitPhysicalPairing(bag.id, step.detectedUid);
        }
        if (step.failure) setFailure(step.failure);
      },
    });

    session.current = null;
    if (operation.cancelled) return;
    smartTagRepository.recordSyncOutcome(bag.id, outcome);

    if (outcome.finalState === 'SUCCESS') {
      smartTagController.navigateTo('result', {
        itineraryId: itinerary.id,
        bagSetupId: bag.id,
      });
    } else if (outcome.failure) {
      setFailure(outcome.failure);
    }
  };

  const getPrimaryButtonLabel = (): string => {
    if (isReadingChip) {
      if (scanStage === 'SCANNING') return 'Scanning… (tap to cancel)';
      if (scanStage === 'TAG_DETECTED') return 'Tag detected…';
      if (scanStage === 'UID_READ') return 'UID read — pairing…';
      if (scanStage === 'PAIRING') return 'Pairing SmartTag…';
      return 'Cancel chip scan';
    }
    if (pairedPhysicalUid || scanStage === 'PAIRED') {
      return 'Rescan / pair another NFC chip';
    }
    return 'Read & pair real NFC chip (UID)';
  };

  return (
    <View style={styles.root}>
      <HeaderSoftWave />
      <CathayScreenHeader
        title="Cathay SmartTag"
        backIcon="chevron-back"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      {/* Stepper: Sync is active */}
      <SmartTagStepper currentStep="sync" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero NFC Illustration Scene */}
        <View style={styles.illustrationWrap}>
          <Image
            source={NFC_PHONE_TAG_SCENE}
            style={styles.nfcArtImage}
            resizeMode="contain"
          />
        </View>

        {/* Text Instruction - Accurate & Honesty-compliant */}
        <View style={styles.textWrap}>
          <Text style={styles.instructionTitle}>Tap your SmartTag</Text>
          <Text style={styles.instructionSubtitle}>
            Hold the back of your phone close to your SmartTag to read its physical NFC chip UID and pair it to this baggage.
          </Text>
        </View>

        {/* Steady Hold Hint Callout */}
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={20} color={CATHAY_JADE} style={styles.hintIcon} />
          <Text style={styles.hintText}>
            Keep the tag steady against your phone until the chip is read and paired.
          </Text>
        </View>

        {/* Status Message or Failure Display */}
        {isBusy && (
          <View style={styles.busyBox}>
            <Text style={styles.busyText}>{statusMessage}</Text>
          </View>
        )}

        {failure && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{failure.title}</Text>
            <Text style={styles.errorText}>{failure.message}</Text>
            {failure.canOpenSettings && Platform.OS !== 'web' && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void openNfcSettings?.()}
                style={styles.settingsLinkBtn}
                testID="btn-open-nfc-settings"
              >
                <Text style={styles.settingsLinkText}>Open device NFC settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsWrap}>
          {isBusy && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel NFC sync"
              style={styles.demoLinkBtn} onPress={() => void cancelSync().catch(() => {})} testID="btn-cancel-sync">
              <Text style={styles.demoLinkText}>Cancel NFC sync</Text>
            </TouchableOpacity>
          )}

          {/* Capability A1 — Read & Pair NFC Chip UID */}
          <CathayPrimaryButton
            label={getPrimaryButtonLabel()}
            onPress={() => {
              if (isReadingChip) {
                return cancelPhysicalTagScan();
              }
              return handleScanChip();
            }}
            disabled={isBusy || isWritingNdef}
            style={styles.primaryCta}
            testID="btn-read-physical-nfc"
          />

          {/* Capability A2 — Write & Verify Compact NDEF Baggage Payload (NTAG213/215/216 -> PN532/ESP32) */}
          <View style={styles.ndefSectionCard} testID="ndef-write-section">
            <View style={styles.ndefHeaderRow}>
              <Text style={styles.ndefSectionTitle}>
                Write Payload to NFC Tag (Rev {ndefRevision})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNdefStatusCode((prev) =>
                    prev === 'TAGGED' ? 'PRIORITY_TRANSFER' : 'TAGGED'
                  );
                  setNdefRevision((r) => r + 1);
                  setNdefWriteStage('READY');
                  setNdefWriteResult(null);
                }}
                disabled={isWritingNdef || isReadingChip || isBusy}
                style={styles.ndefToggleChip}
                testID="btn-toggle-ndef-status"
              >
                <Text style={styles.ndefToggleChipText}>
                  {ndefStatusCode} · Bump Rev
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.ndefStageBar} testID="ndef-stage-indicator">
              {NDEF_STAGE_ORDER.map((stage) => {
                const idx = NDEF_STAGE_ORDER.indexOf(stage);
                const curIdx = NDEF_STAGE_ORDER.indexOf(ndefWriteStage);
                const marker = idx < curIdx || (idx === curIdx && ndefWriteStage === 'VERIFIED')
                  ? '✓'
                  : idx === curIdx && isWritingNdef
                    ? '●'
                    : '○';
                return `${marker} ${NDEF_STAGE_LABELS[stage]}`;
              }).join('  →  ')}
            </Text>

            <TouchableOpacity
              style={[styles.ndefWriteBtn, (isBusy || isReadingChip) && styles.ndefWriteBtnDisabled]}
              onPress={() => {
                if (isWritingNdef) {
                  return cancelPhysicalTagScan();
                }
                return handleWriteNdefPayload();
              }}
              disabled={isBusy || isReadingChip}
              accessibilityRole="button"
              testID="btn-write-ndef-nfc"
            >
              <Text style={styles.ndefWriteBtnText}>
                {isWritingNdef
                  ? `Writing (${NDEF_STAGE_LABELS[ndefWriteStage]})… tap to cancel`
                  : ndefWriteResult
                    ? `Rewrite verified NDEF payload (Rev ${ndefRevision})`
                    : `Write baggage payload to NFC tag (Rev ${ndefRevision})`}
              </Text>
            </TouchableOpacity>

            {ndefWriteResult && ndefWriteStage === 'VERIFIED' && (
              <View style={styles.ndefVerifiedCard} testID="ndef-write-verified-card">
                <Text style={styles.ndefVerifiedTitle}>NFC data written and verified.</Text>
                <Text style={styles.ndefVerifiedMeta}>
                  UID {ndefWriteResult.tagUid} · {ndefWriteResult.bytesWritten} bytes read back cleanly
                </Text>
                <Text style={styles.ndefVerifiedPayload}>{ndefWriteResult.readbackPayload}</Text>
                <Text style={styles.ndefVerifiedHint}>
                  Next step: Tap this NFC tag on the Waveshare PN532 reader to refresh the ESP32 4.2&quot; E-paper display.
                </Text>
              </View>
            )}

            {ndefWriteError && (
              <View style={styles.errorBox} testID="ndef-write-error-card">
                <Text style={styles.errorTitle}>{ndefWriteError.title}</Text>
                <Text style={styles.errorText}>{ndefWriteError.message}</Text>
                {ndefWriteError.code === 'NFC_DISABLED' && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => void openNfcSettings?.()}
                    style={styles.settingsLinkBtn}
                    testID="btn-open-nfc-settings-write"
                  >
                    <Text style={styles.settingsLinkText}>Open device NFC settings</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {isReadingChip && scanStage === 'SCANNING' && (
            <View style={styles.busyBox}>
              <Text style={styles.busyText}>
                Waiting for NFC tag — hold phone against chip...
              </Text>
            </View>
          )}

          {isReadingChip && scanStage === 'TAG_DETECTED' && (
            <View style={styles.busyBox}>
              <Text style={styles.busyText}>
                NFC tag detected — reading chip UID...
              </Text>
            </View>
          )}

          {physicalTagUid && (scanStage === 'PAIRED' || scanStage === 'UID_READ') && (
            <View style={styles.pairedCard} testID="physical-nfc-paired-card">
              <Text style={styles.pairedTitle}>
                NFC_CHIP_READ_SUCCESS · UID {physicalTagUid}
              </Text>
              {scanStage === 'PAIRED' && (
                <Text style={styles.pairedSubtitle}>
                  SMARTTAG_PAIRED · {activeBag.smartTagCode} linked to {activeBag.displayBagCode} ({itinerary.booking.bookingReference})
                </Text>
              )}
              {physicalScanDetails?.ndefText ? (
                <Text style={styles.pairedMeta}>NDEF: {physicalScanDetails.ndefText}</Text>
              ) : null}
              <Text style={styles.pairedNotice}>
                {scanStage === 'PAIRED'
                  ? 'Chip UID read and paired only. '
                  : 'Chip UID read only (not paired to bag). '}
                Updating the passive E-ink screen requires its vendor APDU protocol; run demo simulation above to preview the display flow.
              </Text>
            </View>
          )}

          {physicalScanError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>
                {scanStage === 'UNAVAILABLE'
                  ? 'No NFC hardware'
                  : scanStage === 'UNSUPPORTED_TAG'
                    ? 'Unsupported tag'
                    : scanStage === 'DISABLED'
                      ? 'NFC disabled'
                      : scanStage === 'TIMEOUT'
                        ? 'Scan timed out'
                        : scanStage === 'CANCELLED'
                          ? 'Scan cancelled'
                          : scanStage === 'UID_READ'
                            ? 'Pairing unsuccessful'
                            : 'NFC scan failed'}
              </Text>
              <Text style={styles.errorText}>{physicalScanError}</Text>
              {scanStage === 'DISABLED' && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void openNfcSettings?.()}
                  style={styles.settingsLinkBtn}
                  testID="btn-open-nfc-settings-chip"
                >
                  <Text style={styles.settingsLinkText}>Open device NFC settings</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Capability B — Clearly Separated Demonstration Action */}
          <View style={styles.demoSectionWrap}>
            <Text style={styles.demoSectionHeading}>Demonstration Simulation</Text>
            <TouchableOpacity
              style={styles.demoLinkBtn}
              onPress={() => handleStartSync(true)}
              disabled={isBusy}
              accessibilityRole="button"
              activeOpacity={0.7}
              testID="btn-demo-sync"
            >
              <Text style={styles.demoLinkText}>Run demo simulation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hardwareSyncLinkBtn}
              onPress={() => handleStartSync(false)}
              disabled={isBusy}
              accessibilityRole="button"
              activeOpacity={0.7}
              testID="btn-start-sync"
            >
              <Text style={styles.hardwareSyncLinkText}>Test vendor E-ink hardware sync</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? 44 : 32,
    position: 'relative',
  },
  emptyWrap: {
    padding: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 110,
    alignItems: 'center',
  },

  illustrationWrap: {
    width: '92%',
    aspectRatio: 640 / 639,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  nfcArtImage: {
    width: '100%',
    height: '100%',
  },

  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 24,
    fontFamily: CATHAY_SERIF,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionSubtitle: {
    fontSize: 14,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'center',
  },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 24,
  },
  hintIcon: {
    marginRight: 10,
  },
  hintText: {
    flex: 1,
    fontSize: 12.5,
    color: CATHAY_TEXT_PRIMARY,
    lineHeight: 18,
    fontWeight: '500',
  },

  busyBox: {
    backgroundColor: '#E6F4F1',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  busyText: {
    color: CATHAY_JADE,
    fontSize: 13.5,
    fontWeight: '600',
  },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  errorTitle: {
    color: '#B91C1C',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12.5,
  },

  actionsWrap: {
    width: '100%',
    marginTop: 8,
    gap: 12,
    alignItems: 'center',
  },
  primaryCta: {
    width: '100%',
  },
  demoSectionWrap: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  demoSectionHeading: {
    fontSize: 11.5,
    fontWeight: '600',
    color: CATHAY_TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  demoLinkBtn: {
    paddingVertical: 6,
  },
  demoLinkText: {
    color: CATHAY_TEXT_MUTED,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  hardwareSyncLinkBtn: {
    paddingVertical: 4,
  },
  hardwareSyncLinkText: {
    color: CATHAY_TEXT_MUTED,
    fontSize: 11.5,
    textDecorationLine: 'underline',
  },
  settingsLinkBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  settingsLinkText: {
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  pairedCard: {
    backgroundColor: '#EAF3F2',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginVertical: 6,
  },
  pairedTitle: {
    color: CATHAY_JADE,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  pairedSubtitle: {
    color: CATHAY_TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  pairedMeta: {
    color: CATHAY_TEXT_SECONDARY,
    fontSize: 11.5,
    marginBottom: 4,
  },
  pairedNotice: {
    color: CATHAY_TEXT_MUTED,
    fontSize: 11,
    lineHeight: 16,
  },
  ndefSectionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginVertical: 4,
  },
  ndefHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ndefSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  ndefToggleChip: {
    backgroundColor: '#EAF3F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ndefToggleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: CATHAY_JADE,
  },
  ndefStageBar: {
    fontSize: 10,
    color: CATHAY_TEXT_MUTED,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  ndefWriteBtn: {
    backgroundColor: CATHAY_JADE,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  ndefWriteBtnDisabled: {
    opacity: 0.5,
  },
  ndefWriteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ndefVerifiedCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  ndefVerifiedTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 4,
  },
  ndefVerifiedMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  ndefVerifiedPayload: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#14532D',
    backgroundColor: '#DCFCE7',
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  ndefVerifiedHint: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
});
