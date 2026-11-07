/**
 * Screen 05 — Baggage Journey (Matches Design 05 Mockup & Cathay Design System)
 *
 * Sections:
 *   - Header: Back chevron + centered "Baggage journey"
 *   - Summary Card: Bag ID CX880123456 + "In journey" badge, HKG → NRT, CX548
 *   - Chronological Handling Timeline:
 *       1. Tag synced — Completed at home
 *       2. Bag accepted — Hong Kong self bag-drop • 10:42
 *       3. Loaded onto aircraft — CX548 • Confirmed
 *       4. Arrived in Tokyo — NRT • Awaiting collection
 *       5. Collected — Not yet completed
 *   - Active Recovery Case status card (when a baggage issue has been reported)
 *   - "Need help?" warm sand support card with "Report a baggage issue" outline CTA
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecoveryCaseStatus } from '@polyaero/shared';
import {
  BaggageJourneyTimeline,
  CATHAY_BG,
  CATHAY_JADE,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CATHAY_WARM_BORDER,
  CATHAY_WARM_CREAM,
  CathayCard,
  CathayScreenHeader,
  CathaySecondaryButton,
  FlightSummaryCard,
  InlineNotice,
  StatusBadge,
} from '../components/CathaySmartTagPrimitives';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

export interface BaggageJourneyScreenProps {
  onOpenDevMenu?: () => void;
}

const RECOVERY_STEPS: { status: RecoveryCaseStatus; label: string }[] = [
  { status: 'OPEN', label: 'Submitted' },
  { status: 'INVESTIGATING', label: 'Under review' },
  { status: 'LOCATED', label: 'Bag located' },
  { status: 'READY_FOR_COLLECTION', label: 'Ready at NRT' },
  { status: 'RESOLVED', label: 'Resolved' },
];

export const BaggageJourneyScreen: React.FC<BaggageJourneyScreenProps> = ({
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

  const journeyView =
    itinerary && activeBag
      ? smartTagRepository.getJourneyView(itinerary.id, activeBag.id)
      : null;

  if (!itinerary || !activeBag || !journeyView) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Baggage journey"
          onBack={() => smartTagController.goBack()}
          onLongPressTitle={onOpenDevMenu}
        />
        <View style={{ padding: 20 }}>
          <InlineNotice
            tone="warning"
            title="No baggage journey available"
            message="Add an upcoming flight and set up your SmartTag to track baggage handling events."
            actionLabel="Back to My bookings"
            onAction={() => smartTagController.navigateTo('bookings')}
          />
        </View>
      </View>
    );
  }

  const { recovery } = journeyView;

  return (
    <View style={styles.root}>
      <CathayScreenHeader
        title="Baggage journey"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {bags.length > 1 && (
          <View style={styles.bagSelectorRow}>
            {bags.map((b) => {
              const selected = b.id === activeBag.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.bagChip, selected && styles.bagChipActive]}
                  onPress={() =>
                    smartTagRepository.setActiveContext(itinerary.id, b.id)
                  }
                >
                  <Text
                    style={[
                      styles.bagChipText,
                      selected && styles.bagChipTextActive,
                    ]}
                  >
                    Bag {b.bagIndex}: {b.displayBagCode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Summary Card */}
        <FlightSummaryCard
          itinerary={itinerary}
          showPassengerCount={false}
          bagHeader={{
            displayBagCode: activeBag.displayBagCode,
            statusLabel: journeyView.statusBadgeLabel,
            statusTone: journeyView.statusBadgeTone,
          }}
        />

        {/* Chronological Handling Timeline */}
        <BaggageJourneyTimeline items={journeyView.items} />

        {/* Active Recovery Case Status Card */}
        {recovery && (
          <CathayCard style={styles.recoveryStatusCard}>
            <View style={styles.recoveryHeaderRow}>
              <View>
                <Text style={styles.recoveryCaseEyebrow}>
                  BAGGAGE RECOVERY CASE
                </Text>
                <Text style={styles.recoveryCaseNum}>
                  {recovery.recoveryCase.caseNumber}
                </Text>
              </View>
              <StatusBadge
                label={recovery.progressState.replace(/_/g, ' ')}
                tone={recovery.progressState === 'RESOLVED' ? 'jade' : 'amber'}
              />
            </View>
            <Text style={styles.recoveryDetailText}>
              {recovery.recoveryCase.currentLocation}
            </Text>
            <Text style={styles.recoverySubNote}>
              Reported issue: {recovery.passengerDescription}
            </Text>

            <View style={styles.recoverySimRow}>
              {RECOVERY_STEPS.map((step) => {
                const active = recovery.recoveryCase.status === step.status;
                return (
                  <TouchableOpacity
                    key={step.status}
                    style={[
                      styles.recoveryStepChip,
                      active && styles.recoveryStepChipActive,
                    ]}
                    onPress={() =>
                      smartTagRepository.advanceRecoveryProgress(
                        activeBag.id,
                        step.status
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.recoveryStepChipText,
                        active && styles.recoveryStepChipTextActive,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CathayCard>
        )}

        {/* Need help? Warm Sand Support Card (Matches CathayProfileScreen completeProfileCard) */}
        <View style={styles.needHelpCard}>
          <View style={styles.needHelpHeaderRow}>
            <Ionicons name="headset-outline" size={20} color="#1E2328" />
            <View style={{ flex: 1 }}>
              <Text style={styles.needHelpTitle}>Need help?</Text>
              <Text style={styles.needHelpSub}>
                If your baggage does not appear, start recovery support.
              </Text>
            </View>
          </View>

          <CathaySecondaryButton
            label={
              recovery ? 'Update baggage issue report' : 'Report a baggage issue'
            }
            variant="outline"
            onPress={() =>
              smartTagController.navigateTo('report', {
                itineraryId: itinerary.id,
                bagSetupId: activeBag.id,
              })
            }
            testID="btn-report-baggage-issue"
          />
        </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 118,
    gap: 12,
  },
  bagSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C4C6CA',
  },
  bagChipActive: {
    backgroundColor: CATHAY_JADE,
    borderColor: CATHAY_JADE,
  },
  bagChipText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#2C3034',
  },
  bagChipTextActive: {
    color: '#FFFFFF',
  },
  needHelpCard: {
    backgroundColor: CATHAY_WARM_CREAM,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CATHAY_WARM_BORDER,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  needHelpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  needHelpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E2328',
  },
  needHelpSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#2C3034',
    marginTop: 3,
  },
  recoveryStatusCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderLeftWidth: 3,
    borderLeftColor: CATHAY_JADE,
  },
  recoveryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recoveryCaseEyebrow: {
    fontSize: 10.5,
    fontWeight: '500',
    color: CATHAY_TEXT_SECONDARY,
    letterSpacing: 0.4,
  },
  recoveryCaseNum: {
    fontSize: 16,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
    marginTop: 2,
  },
  recoveryDetailText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: CATHAY_JADE,
  },
  recoverySubNote: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    marginTop: 4,
  },
  recoverySimRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  recoveryStepChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  recoveryStepChipActive: {
    backgroundColor: CATHAY_JADE,
    borderColor: CATHAY_JADE,
  },
  recoveryStepChipText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#2C3034',
  },
  recoveryStepChipTextActive: {
    color: '#FFFFFF',
  },
});
