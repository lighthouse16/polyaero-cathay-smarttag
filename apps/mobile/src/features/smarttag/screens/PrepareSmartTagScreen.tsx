/**
 * Screen 02 — Prepare SmartTag (Matches references/02_prepare_smarttag.png)
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_DECLARATIONS,
  SmartTagDeclarations,
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
  InlineNotice,
  BrushwingFlightSummaryCard,
} from '../components/CathaySmartTagPrimitives';
import { SmartTagStepper } from '../components/SmartTagStepper';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

export interface PrepareSmartTagScreenProps {
  onOpenDevMenu?: () => void;
}

export const PrepareSmartTagScreen: React.FC<PrepareSmartTagScreenProps> = ({
  onOpenDevMenu,
}) => {
  const { repo } = useSmartTagStore();
  const itinerary =
    (repo.activeItineraryId
      ? repo.itineraries.find((i) => i.id === repo.activeItineraryId)
      : repo.itineraries[0]) ?? null;

  const existingBags = itinerary
    ? repo.bagSetupsByItinerary[itinerary.id] ?? []
    : [];
  const primaryBag = existingBags[0];

  const [bagCount] = useState<number>(() =>
    Math.max(1, existingBags.length || 1)
  );
  const [selectedSmartTagCode] = useState<string>(
    () => primaryBag?.smartTagCode ?? repo.ownedTags[0]?.smartTagCode ?? 'ST-2048'
  );
  const [declarations] = useState<SmartTagDeclarations>(() =>
    primaryBag?.declarations ?? { ...DEFAULT_DECLARATIONS }
  );
  const [tagReady, setTagReady] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  if (!itinerary) {
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
            title="No upcoming booking selected"
            message="Please select an upcoming flight in My bookings before preparing your SmartTag."
            actionLabel="Back to My bookings"
            onAction={() => smartTagController.navigateTo('bookings')}
          />
        </View>
      </View>
    );
  }

  const handleContinue = () => {
    const res = smartTagRepository.prepareBagsForItinerary({
      itineraryId: itinerary.id,
      bagCount,
      declarations,
      selectedSmartTagCode,
    });

    if (res.validationError) {
      setFeedbackError(res.validationError);
      return;
    }

    setFeedbackError(null);
    smartTagController.navigateTo('sync', {
      itineraryId: itinerary.id,
      bagSetupId: res.bags[0]?.id,
    });
  };

  const isConfirmed = itinerary.checkInReadiness === 'DEMO_CHECK_IN_COMPLETED';

  return (
    <View style={styles.root}>
      <HeaderSoftWave />
      <CathayScreenHeader
        title="Cathay SmartTag"
        backIcon="chevron-back"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      {/* Stepper: Prepare is active */}
      <SmartTagStepper currentStep="prepare" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Heading Section */}
        <View style={styles.headingWrap}>
          <Text style={styles.mainTitle}>Prepare your SmartTag</Text>
          <Text style={styles.mainSubtitle}>
            Let’s get your baggage tag ready for this flight.
          </Text>
        </View>

        {/* Flight summary card */}
        <BrushwingFlightSummaryCard
          flightNumber={itinerary.flight.flightNumber}
          route={`${itinerary.flight.origin} → ${itinerary.flight.destination}`}
          dateStr="Tue, 11 Nov 2026 · 10:35"
          onPress={() => smartTagController.navigateTo('bookings')}
        />

        {/* Before you continue checklist */}
        <View style={styles.checklistSectionWrap}>
          <Text style={styles.checklistSectionHeading}>Before you continue</Text>

          {/* Item 1 */}
          <View style={styles.floatingCheckCard}>
            <View style={[styles.checklistBadge, isConfirmed && styles.checklistBadgeDone]}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.checklistTextCol}>
              <Text style={styles.checklistTitle}>Booking confirmed</Text>
              <Text style={styles.checklistSubtitle}>
                E-ticket and baggage allowance verified
              </Text>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.floatingCheckCard}>
            <View style={[styles.checklistBadge, styles.checklistBadgeDone]}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.checklistTextCol}>
              <Text style={styles.checklistTitle}>Baggage within allowance</Text>
              <Text style={styles.checklistSubtitle}>
                1 checked bag (≤ 23 kg)
              </Text>
            </View>
          </View>

          {/* Item 3 */}
          <TouchableOpacity
            style={styles.floatingCheckCard}
            activeOpacity={0.7}
            onPress={() => setTagReady(!tagReady)}
          >
            <View style={[styles.checklistBadge, tagReady && styles.checklistBadgeDone]}>
              {tagReady ? (
                <Ionicons name="checkmark" size={15} color="#FFFFFF" />
              ) : (
                <View style={styles.circleUnchecked} />
              )}
            </View>
            <View style={styles.checklistTextCol}>
              <Text style={styles.checklistTitle}>Have your SmartTag ready</Text>
              <Text style={styles.checklistSubtitle}>
                A Cathay SmartTag with NFC
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {feedbackError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{feedbackError}</Text>
          </View>
        )}

        {/* Primary CTA: Continue */}
        <CathayPrimaryButton
          label="Continue"
          onPress={handleContinue}
          style={styles.continueBtn}
          testID="btn-continue-prepare"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    position: 'relative',
  },
  emptyWrap: {
    padding: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  headingWrap: {
    marginBottom: 20,
    paddingTop: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: CATHAY_SERIF,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 14,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 20,
  },

  checklistSectionWrap: {
    marginTop: 18,
    marginBottom: 20,
  },
  checklistSectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 14,
  },
  floatingCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEEEF',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  checklistBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checklistBadgeDone: {
    backgroundColor: CATHAY_JADE,
    borderColor: CATHAY_JADE,
  },
  circleUnchecked: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  checklistTextCol: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  checklistSubtitle: {
    fontSize: 12.5,
    color: CATHAY_TEXT_MUTED,
    marginTop: 2,
  },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
  },

  continueBtn: {
    marginTop: 14,
    marginBottom: 30,
  },
});
