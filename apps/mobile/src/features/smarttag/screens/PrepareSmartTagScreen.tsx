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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  areDeclarationsComplete,
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

  const bagCount = Math.max(1, existingBags.length);
  const selectedSmartTagCode = primaryBag?.smartTagCode ?? repo.ownedTags[0]?.smartTagCode;
  const [declarations, setDeclarations] = useState<SmartTagDeclarations>(() =>
    primaryBag?.preparedAt
      ? { ...primaryBag.declarations }
      : {
          checkInConfirmed: false,
          dangerousGoodsDeclared: false,
          tagSecuredToLuggage: false,
          airportAcceptanceUnderstood: false,
        }
  );
  const [tagReady, setTagReady] = useState(false);
  const [showAcknowledgements, setShowAcknowledgements] = useState(false);
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

  const isConfirmed = itinerary.checkInReadiness === 'DEMO_CHECK_IN_COMPLETED';
  const withinPieceAllowance = bagCount <= itinerary.checkedBagAllowance;
  const hasAssignedTags =
    repo.ownedTags.length >= bagCount &&
    repo.ownedTags.some((tag) => tag.smartTagCode === selectedSmartTagCode);
  const readinessError = !isConfirmed
    ? 'Complete flight check-in in My bookings before continuing.'
    : !withinPieceAllowance
      ? 'The selected bag count exceeds the booking checked-bag allowance.'
      : !hasAssignedTags
        ? 'An owned SmartTag is required for each checked bag.'
        : null;
  const canContinue = !readinessError && tagReady && areDeclarationsComplete(declarations);
  const acknowledgementLabels: Record<keyof SmartTagDeclarations, string> = {
    checkInConfirmed: 'I acknowledge the flight check-in prerequisite',
    dangerousGoodsDeclared: 'I acknowledge the dangerous goods and baggage rules',
    tagSecuredToLuggage: 'I will keep my SmartTag securely attached until collection',
    airportAcceptanceUnderstood: 'I understand baggage acceptance and weighing take place at airport bag-drop',
  };

  const handleContinue = () => {
    if (!canContinue) return;

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
              <Text style={styles.checklistTitle}>{isConfirmed ? 'Demo check-in completed' : 'Check-in required'}</Text>
              <Text style={styles.checklistSubtitle}>
                {isConfirmed ? 'Check-in completed in this prototype' : 'Complete flight check-in before continuing'}
              </Text>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.floatingCheckCard}>
            <View style={[styles.checklistBadge, withinPieceAllowance && styles.checklistBadgeDone]}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.checklistTextCol}>
              <Text style={styles.checklistTitle}>Checked-bag allowance</Text>
              <Text style={styles.checklistSubtitle}>
                {`${itinerary.checkedBagAllowance} checked ${itinerary.checkedBagAllowance === 1 ? 'bag' : 'bags'} / ${bagCount} selected. Weighing at airport.`}
              </Text>
            </View>
          </View>

          {/* Item 3 */}
          <TouchableOpacity
            style={styles.floatingCheckCard}
            activeOpacity={0.7}
            onPress={() => {
              setTagReady((ready) => !ready);
              setShowAcknowledgements(true);
            }}
            accessibilityRole="checkbox"
            accessibilityLabel="Have your SmartTag ready"
            accessibilityState={{ checked: tagReady }}
            testID="checkbox-smarttag-ready"
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

        {readinessError && (
          <InlineNotice
            tone="warning"
            message={readinessError}
            actionLabel="Back to My bookings"
            onAction={() => smartTagController.navigateTo('bookings')}
          />
        )}

        {feedbackError && (
          <View style={styles.errorWrap}>
            <InlineNotice tone="danger" message={feedbackError} />
          </View>
        )}

        {/* Primary CTA: Continue */}
        <CathayPrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
          style={styles.continueBtn}
          testID="btn-continue-prepare"
        />
      </ScrollView>
      <Modal visible={showAcknowledgements} transparent animationType="fade"
        onRequestClose={() => setShowAcknowledgements(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.acknowledgementSheet} accessibilityViewIsModal>
            <Text style={styles.checklistSectionHeading}>Before your bag travels</Text>
            <ScrollView>
          {(Object.keys(acknowledgementLabels) as (keyof SmartTagDeclarations)[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.floatingCheckCard}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={acknowledgementLabels[key]}
              accessibilityState={{ checked: declarations[key] }}
              onPress={() => setDeclarations((current) => ({ ...current, [key]: !current[key] }))}
              testID={`checkbox-${key}`}
            >
              <View style={[styles.checklistBadge, declarations[key] && styles.checklistBadgeDone]}>
                {declarations[key] ? (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                ) : (
                  <View style={styles.circleUnchecked} />
                )}
              </View>
              <Text style={[styles.checklistTitle, styles.checklistTextCol]}>
                {acknowledgementLabels[key]}
              </Text>
            </TouchableOpacity>
          ))}
            </ScrollView>
            <CathayPrimaryButton label="Done" onPress={() => setShowAcknowledgements(false)}
              disabled={!areDeclarationsComplete(declarations)} />
            <TouchableOpacity accessibilityRole="button" onPress={() => setShowAcknowledgements(false)}
              style={styles.acknowledgementLink}>
              <Text style={styles.checklistSubtitle}>Back to preparation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  acknowledgementLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  acknowledgementSheet: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
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
    marginBottom: 8,
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
    paddingVertical: 16,
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

  errorWrap: {
    marginBottom: 16,
  },

  continueBtn: {
    marginTop: 6,
    marginBottom: 30,
  },
});
