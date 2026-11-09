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
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

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
  const session = useRef<{ service: INfcService; cancelled: boolean } | null>(null);
  useEffect(() => () => {
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

  const handleStartSync = async (forceDemo = false) => {
    if (isBusy || session.current) return;
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
      expectedTagUid: bag.smartTag.tagUid,
      stepDelayMs: 140,
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
        {isBusy && (
          <View style={styles.busyBox}>
            <Text style={styles.busyText}>{statusMessage}</Text>
          </View>
        )}

        {failure && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{failure.title}</Text>
            <Text style={styles.errorText}>{failure.message}</Text>
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
            onPress={() => handleStartSync(false)}
            disabled={isBusy}
            style={styles.primaryCta}
            testID="btn-start-sync"
          />

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
  demoLinkBtn: {
    paddingVertical: 8,
  },
  demoLinkText: {
    color: CATHAY_TEXT_MUTED,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
