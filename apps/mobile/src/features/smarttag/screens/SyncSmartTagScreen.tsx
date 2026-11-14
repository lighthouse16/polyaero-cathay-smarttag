/**
 * Screen 03 — Sync SmartTag (Matches references/03_sync_smarttag.png)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  runSmartTagSync,
} from '@polyaero/shared';
import {
  CATHAY_FONT_FAMILY,
  CATHAY_JADE,
  CATHAY_CRIMSON,
  CATHAY_AMBER_WARM,
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
  clearLastNfcTap,
  pauseNfcTapListener,
  resumeNfcTapListener,
  setNfcTapCooldown,
  useDiscoveredNfcTap,
} from '../../../services/nfc/nfcTapBridge';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';
import { syncBookingToCopilot, postSmartTagTap } from '../../../services/copilotBridge';

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
  const discoveredTap = useDiscoveredNfcTap();
  const handledTapSeq = useRef<number | null>(null);
  const session = useRef<{ service: INfcService; cancelled: boolean } | null>(null);
  const syncCompletedRef = useRef(false);
  useEffect(() => () => {
    resumeNfcTapListener();
    if (session.current) {
      session.current.cancelled = true;
      void session.current.service.cancelScan().catch(() => {});
    }
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

  const isBusy =
    machineState === 'CHECKING_AVAILABILITY' ||
    machineState === 'READY_TO_SCAN' ||
    machineState === 'SCANNING' ||
    machineState === 'TAG_DETECTED' ||
    machineState === 'WRITING' ||
    machineState === 'VERIFYING';

  const handleStartSync = useCallback(async (forceDemo = false, isUserInitiated = false) => {
    if (isUserInitiated) {
      syncCompletedRef.current = false;
    }
    if (syncCompletedRef.current) return;
    if (!itinerary || !activeBag || isBusy || session.current) return;
    if (activeBag.setupState === 'UNREGISTERED') {
      smartTagController.navigateTo('prepare', { itineraryId: itinerary.id, bagSetupId: activeBag.id });
      return;
    }
    const bag = activeBag;
    setFailure(null);
    pauseNfcTapListener();

    const payload = buildNfcPayloadForBag(itinerary, bag);
    const physicalService = forceDemo ? null : getPhysicalNfcService();
    if (!forceDemo && !physicalService) {
      resumeNfcTapListener();
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
    if (!physicalService) demoNfcService.setMockTag(payload);
    const operation = { service: effectiveService, cancelled: false };
    session.current = operation;

    const outcome = await runSmartTagSync({
      mode: physicalService ? 'PHYSICAL_HARDWARE' : 'SIMULATED_DEMO',
      service: effectiveService,
      payload,
      expectedTagUid: physicalService ? '' : bag.smartTag.tagUid,
      stepDelayMs: physicalService ? 0 : 140,
      onStep: (step) => {
        if (operation.cancelled) {
          if (step.state === 'SCANNING' || step.state === 'WRITING') throw new NfcCancelledError();
          return;
        }
        setMachineState(step.state);
        setStatusMessage(step.statusMessage);
        if (step.failure) setFailure(step.failure);
      },
    });

    session.current = null;
    if (operation.cancelled) {
      resumeNfcTapListener();
      return;
    }
    smartTagRepository.recordSyncOutcome(bag.id, outcome);

    if (outcome.finalState === 'SUCCESS') {
      syncCompletedRef.current = true;
      setNfcTapCooldown(8000);
      resumeNfcTapListener();
      clearLastNfcTap();
      smartTagController.navigateTo('result', {
        itineraryId: itinerary.id,
        bagSetupId: bag.id,
      });

      const tapPayload = {
        tagUid: bag.smartTag.tagUid,
        baggageTagNumber: bag.baggage.tagNumber,
        flightNumber: itinerary.flight.flightNumber,
        originAirport: itinerary.flight.origin,
        destinationAirport: itinerary.flight.destination,
        passengerInitials: itinerary.passengerInitials,
        departureDate: itinerary.departureDateIso,
        status: 'TAGGED',
        timestamp: Date.now() / 1000,
      };
      void (async () => {
        await syncBookingToCopilot({
          tagNumber: bag.baggage.tagNumber,
          tagCode: bag.smartTag.tagUid,
          flightNumber: itinerary.flight.flightNumber,
          origin: itinerary.flight.origin,
          destination: itinerary.flight.destination,
          initialStatus: 'TAGGED',
        });
        if (outcome.mode === 'PHYSICAL_HARDWARE') {
          await postSmartTagTap(bag.smartTag.tagUid, tapPayload);
        }
      })();
    } else {
      resumeNfcTapListener();
      if (outcome.failure) {
        setFailure(outcome.failure);
      }
    }
  }, [activeBag, isBusy, itinerary]);

  useEffect(() => {
    if (syncCompletedRef.current) return;
    if (Platform.OS === 'web' || !discoveredTap) return;
    if (handledTapSeq.current === discoveredTap.tapSeq) return;
    if (!itinerary || !activeBag || activeBag.setupState === 'UNREGISTERED') return;
    if (isBusy || session.current) return;
    handledTapSeq.current = discoveredTap.tapSeq;
    void handleStartSync(false, false);
  }, [discoveredTap, itinerary, activeBag, isBusy, handleStartSync]);

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

        {/* Text Instruction */}
        <View style={styles.textWrap}>
          <Text style={styles.instructionTitle}>Tap your SmartTag</Text>
          <Text style={styles.instructionSubtitle}>
            Hold the back of your phone close to the SmartTag to write your baggage details onto the e-ink display.
          </Text>
        </View>

        {/* Steady Hold Hint Callout */}
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={20} color={CATHAY_JADE} style={styles.hintIcon} />
          <Text style={styles.hintText}>
            Keep the tag steady until the sync is complete (about 3–5 seconds).
          </Text>
        </View>

        {/* Status Message or Failure Display */}
        {discoveredTap && (
          <View style={styles.busyBox} testID="nfc-intent-detected-banner">
            <Ionicons name="radio-outline" size={18} color={CATHAY_JADE} />
            <Text style={styles.busyText}>
              NFC tag detected ({discoveredTap.uid})
              {discoveredTap.ndefText ? ` · ${discoveredTap.ndefText}` : ''}
            </Text>
          </View>
        )}

        {isBusy && (
          <View style={styles.busyBox}>
            <Ionicons name="sync-outline" size={18} color={CATHAY_JADE} />
            <Text style={styles.busyText}>{statusMessage}</Text>
          </View>
        )}

        {failure && (
          <View
            style={[
              styles.errorBox,
              failure.code === 'NFC_TIMEOUT' || failure.code === 'NFC_CANCELLED'
                ? styles.errorBoxWarning
                : styles.errorBoxCritical,
            ]}
          >
            <View style={styles.errorHeaderRow}>
              <Ionicons
                name={
                  failure.code === 'NFC_TIMEOUT' || failure.code === 'NFC_CANCELLED'
                    ? 'time-outline'
                    : 'alert-circle-outline'
                }
                size={19}
                color={
                  failure.code === 'NFC_TIMEOUT' || failure.code === 'NFC_CANCELLED'
                    ? CATHAY_AMBER_WARM
                    : CATHAY_CRIMSON
                }
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>{failure.title}</Text>
                <Text style={styles.errorText}>{failure.message}</Text>
                {failure.recoveryHint ? (
                  <Text style={styles.errorHintText}>{failure.recoveryHint}</Text>
                ) : null}
              </View>
            </View>
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
          <CathayPrimaryButton
            label={isBusy ? statusMessage : 'Start NFC sync'}
            onPress={() => handleStartSync(false, true)}
            disabled={isBusy}
            style={styles.primaryCta}
            testID="btn-start-sync"
          />

          <TouchableOpacity
            style={styles.demoLinkBtn}
            onPress={() => handleStartSync(true, true)}
            disabled={isBusy}
            accessibilityRole="button"
            activeOpacity={0.7}
            testID="btn-demo-sync"
          >
            <Text style={styles.demoLinkText}>Run demo simulation</Text>
          </TouchableOpacity>
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
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionSubtitle: {
    fontSize: 14,
    fontFamily: CATHAY_FONT_FAMILY,
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
    fontFamily: CATHAY_FONT_FAMILY,
    color: CATHAY_TEXT_PRIMARY,
    lineHeight: 18,
    fontWeight: '500',
  },

  busyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EAF3F2',
    borderWidth: 1,
    borderColor: '#D0E6E4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 16,
  },
  busyText: {
    flex: 1,
    color: CATHAY_JADE,
    fontSize: 13.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
  },

  errorBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEEEF',
    borderLeftWidth: 3.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  errorBoxWarning: {
    borderLeftColor: CATHAY_AMBER_WARM,
  },
  errorBoxCritical: {
    borderLeftColor: CATHAY_CRIMSON,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorTitle: {
    color: CATHAY_TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '700',
    marginBottom: 3,
  },
  errorText: {
    color: CATHAY_TEXT_SECONDARY,
    fontSize: 13,
    fontFamily: CATHAY_FONT_FAMILY,
    lineHeight: 18.5,
  },
  errorHintText: {
    color: CATHAY_TEXT_MUTED,
    fontSize: 12.5,
    fontFamily: CATHAY_FONT_FAMILY,
    lineHeight: 17.5,
    marginTop: 6,
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
  demoLinkBtn: {
    paddingVertical: 8,
  },
  demoLinkText: {
    color: CATHAY_TEXT_MUTED,
    fontSize: 13,
    fontFamily: CATHAY_FONT_FAMILY,
    textDecorationLine: 'underline',
  },
});
