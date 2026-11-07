/**
 * Screen 03 — Sync SmartTag (Matches Design 03 Mockup & Cathay Design System)
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_DECLARATIONS,
  NFC_STATE_MESSAGES,
  NfcSyncMachineState,
  SmartTagFailureInfo,
  buildNfcPayloadForBag,
  runSmartTagSync,
} from '@polyaero/shared';
import {
  CATHAY_BG,
  CATHAY_BORDER,
  CATHAY_JADE,
  CATHAY_JADE_LIGHT,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CathayPrimaryButton,
  CathayScreenHeader,
  ICON_PLANE_TAKEOFF,
  InlineNotice,
  NfcPhoneToTagIllustration,
  SmartTagIdentityCard,
  SmartTagProgressIndicator,
} from '../components/CathaySmartTagPrimitives';
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
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [failure, setFailure] = useState<SmartTagFailureInfo | null>(null);
  const [showEinkPreview, setShowEinkPreview] = useState<boolean>(false);

  if (!itinerary || !activeBag) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Sync SmartTag"
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

  const ensurePreparedBag = () => {
    if (activeBag.setupState === 'UNREGISTERED') {
      const { bags: prepared } = smartTagRepository.prepareBagsForItinerary({
        itineraryId: itinerary.id,
        bagCount: 1,
        declarations: DEFAULT_DECLARATIONS,
      });
      return prepared[0] ?? activeBag;
    }
    return activeBag;
  };

  const isBusy =
    machineState === 'CHECKING_AVAILABILITY' ||
    machineState === 'READY_TO_SCAN' ||
    machineState === 'SCANNING' ||
    machineState === 'TAG_DETECTED' ||
    machineState === 'WRITING' ||
    machineState === 'VERIFYING';

  const handleStartPhysicalSync = async () => {
    if (isBusy) return;
    const bag = ensurePreparedBag();
    setFailure(null);
    setIsSimulating(false);

    const payload = buildNfcPayloadForBag(itinerary, bag);
    const physicalService = getPhysicalNfcService();
    const effectiveService = physicalService ?? demoNfcService;
    demoNfcService.setMockTag(payload);

    const outcome = await runSmartTagSync({
      mode: physicalService ? 'PHYSICAL_HARDWARE' : 'SIMULATED_DEMO',
      service: effectiveService,
      payload,
      expectedTagUid: bag.smartTag.tagUid,
      stepDelayMs: 140,
      onStep: (step) => {
        setMachineState(step.state);
        setStatusMessage(step.statusMessage);
        if (step.failure) setFailure(step.failure);
      },
    });

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

  const handleCancelScan = async () => {
    await demoNfcService.cancelScan();
    await getPhysicalNfcService()?.cancelScan();
  };

  const { flight } = itinerary;

  return (
    <View style={styles.root}>
      <CathayScreenHeader
        title="Sync SmartTag"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      {/* Secondary Flight Summary Sub-Bar */}
      <View style={styles.flightSubBar}>
        <View style={styles.flightSubLeft}>
          <Image
            source={ICON_PLANE_TAKEOFF}
            style={styles.takeoffIcon}
            resizeMode="contain"
          />
          <Text style={styles.flightSubCode}>{flight.flightNumber}</Text>
        </View>
        <View style={styles.subBarDivider} />
        <Text style={styles.flightSubRoute}>
          {flight.origin} to {flight.destination}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {bags.length > 1 && (
          <View style={styles.bagTabsRow}>
            {bags.map((b) => {
              const selected = b.id === activeBag.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.bagTabChip, selected && styles.bagTabChipActive]}
                  onPress={() => {
                    setMachineState('IDLE');
                    setStatusMessage(NFC_STATE_MESSAGES.IDLE);
                    setFailure(null);
                    smartTagRepository.setActiveContext(itinerary.id, b.id);
                  }}
                >
                  <Text
                    style={[
                      styles.bagTabChipText,
                      selected && styles.bagTabChipTextActive,
                    ]}
                  >
                    Bag {b.bagIndex}: {b.smartTagCode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Section A: Phone-to-Tag NFC Illustration + Instructions */}
        <NfcPhoneToTagIllustration activeState={machineState} />

        <View style={styles.instructionBlock}>
          <Text style={styles.instructionHeading}>
            Hold your phone near the SmartTag
          </Text>
          <Text style={styles.instructionSub}>
            We will write your flight details and baggage identity{'\n'}to the tag.
          </Text>
        </View>

        {/* Live NFC State Machine Progress Banner */}
        <SmartTagProgressIndicator
          state={machineState}
          message={statusMessage}
          isSimulated={isSimulating}
          onCancel={handleCancelScan}
        />

        {/* Actionable Error Notice */}
        {failure && (
          <InlineNotice
            tone={machineState === 'UNSUPPORTED' ? 'warning' : 'danger'}
            title={failure.title}
            message={`${failure.message} ${failure.recoveryHint}`}
            actionLabel={failure.canRetry ? 'Retry NFC sync' : undefined}
            onAction={failure.canRetry ? handleStartPhysicalSync : undefined}
            secondaryActionLabel={
              failure.canOpenSettings ? 'Open NFC settings' : undefined
            }
            onSecondaryAction={
              failure.canOpenSettings
                ? () => {
                    Linking.openSettings().catch(() => {});
                  }
                : undefined
            }
          />
        )}

        {/* Section B: What will be written */}
        <SmartTagIdentityCard
          variant="preview"
          itinerary={itinerary}
          bag={activeBag}
          showMonochromeEinkPreview={showEinkPreview}
        />

        {showEinkPreview && (
          <TouchableOpacity
            style={styles.togglePreviewRow}
            onPress={() => setShowEinkPreview(false)}
            activeOpacity={0.75}
          >
            <Ionicons name="eye-off-outline" size={15} color={CATHAY_JADE} />
            <Text style={styles.togglePreviewText}>Hide E-ink display preview</Text>
          </TouchableOpacity>
        )}

        {/* Section C: Primary Action */}
        <CathayPrimaryButton
          label="Start NFC sync"
          onPress={handleStartPhysicalSync}
          loading={isBusy}
          disabled={isBusy}
          testID="btn-start-nfc-sync"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CATHAY_BG,
    paddingTop: Platform.OS === 'ios' ? 40 : 4,
  },
  flightSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: CATHAY_BORDER,
  },
  flightSubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  takeoffIcon: {
    width: 17,
    height: 13,
  },
  flightSubCode: {
    fontSize: 14,
    color: '#3B4148',
    fontWeight: '400',
  },
  subBarDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#D9DEE2',
    marginHorizontal: 14,
  },
  flightSubRoute: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_JADE_LIGHT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 13,
  },
  emptyWrap: {
    padding: 20,
  },
  bagTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bagTabChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCDF',
  },
  bagTabChipActive: {
    backgroundColor: CATHAY_JADE,
    borderColor: CATHAY_JADE,
  },
  bagTabChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3B4148',
  },
  bagTabChipTextActive: {
    color: '#FFFFFF',
  },
  instructionBlock: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 2,
  },
  instructionHeading: {
    fontSize: 19.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  instructionSub: {
    fontSize: 14,
    lineHeight: 20,
    color: CATHAY_TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 6,
  },
  togglePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  togglePreviewText: {
    fontSize: 12.5,
    color: CATHAY_JADE,
    fontWeight: '500',
  },
});
