/**
 * Screen 03 — Sync SmartTag (Matches Design 03 Mockup)
 *
 * Sections:
 *   - Header: Back arrow + centered "Sync SmartTag"
 *   - Secondary flight summary sub-bar: "CX548  |  HKG to NRT"
 *   - Section A: Minimal phone-to-tag NFC illustration + "Hold your phone near the SmartTag"
 *   - Section B: "What will be written" card (Route, Flight, Bag ID CX880123456, Status Ready for bag-drop)
 *     + optional collapsible 2.9" 296×128 monochrome E-ink barcode preview
 *   - Section C: Primary CTA "Start NFC sync" + Secondary link "Use demo simulation"
 *   - 11-state NFC sync machine with honest separation between physical hardware and demo simulation
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
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
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CathayPrimaryButton,
  CathayScreenHeader,
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

  // Ensure bag is prepared if user deep-linked directly to Sync
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

      {/* Secondary Flight Summary Sub-Header: CX548 | HKG to NRT (Exact Design 03) */}
      <View style={styles.flightSubBar}>
        <View style={styles.flightSubLeft}>
          <Ionicons
            name="airplane-outline"
            size={15}
            color="#5A6168"
            style={{ transform: [{ rotate: '-25deg' }] }}
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
        {/* Multi-bag switcher when passenger selected >1 checked bag */}
        {bags.length > 1 && (
          <View style={styles.bagTabsRow}>
            {bags.map((b) => {
              const selected = b.id === activeBag.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.bagTabChip, selected && styles.bagTabChipActive]}
                  onPress={() =>
                    smartTagRepository.setActiveContext(itinerary.id, b.id)
                  }
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

        {/* Actionable Error / Unsupported Hardware Notice */}
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

        {/* Section B: What will be written (Exact Design 03 Card) */}
        <SmartTagIdentityCard
          variant="preview"
          itinerary={itinerary}
          bag={activeBag}
          showMonochromeEinkPreview={showEinkPreview}
        />

        <TouchableOpacity
          style={styles.togglePreviewRow}
          onPress={() => setShowEinkPreview((p) => !p)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={showEinkPreview ? 'eye-off-outline' : 'barcode-outline'}
            size={15}
            color={CATHAY_JADE}
          />
          <Text style={styles.togglePreviewText}>
            {showEinkPreview
              ? 'Hide 2.9" E-ink monochrome barcode preview'
              : `Preview 2.9" E-ink monochrome label (${activeBag.smartTagCode})`}
          </Text>
        </TouchableOpacity>

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
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: CATHAY_BORDER,
  },
  flightSubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
    color: CATHAY_JADE,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 12,
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
    paddingTop: 4,
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
