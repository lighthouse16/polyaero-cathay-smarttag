/**
 * Screen 02 — Prepare SmartTag (Matches Design 02 Mockup & Cathay Design System)
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  DEFAULT_DECLARATIONS,
  SmartTagDeclarations,
  areDeclarationsComplete,
} from '@polyaero/shared';
import {
  BaggageDetailsCard,
  CATHAY_BG,
  CATHAY_BORDER,
  CATHAY_MINT_SURFACE,
  CATHAY_TEXT_PRIMARY,
  CathayCard,
  CathayPrimaryButton,
  CathayScreenHeader,
  FlightSummaryCard,
  ICON_REQ_KIOSK,
  ICON_REQ_TAG,
  ICON_REQ_WARNING,
  InlineNotice,
} from '../components/CathaySmartTagPrimitives';
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

  const [bagCount, setBagCount] = useState<number>(() =>
    Math.max(1, existingBags.length || 1)
  );
  const [selectedSmartTagCode, setSelectedSmartTagCode] = useState<string>(
    () => primaryBag?.smartTagCode ?? repo.ownedTags[0]?.smartTagCode ?? 'ST-2048'
  );
  const [declarations, setDeclarations] = useState<SmartTagDeclarations>(() =>
    primaryBag?.declarations ?? { ...DEFAULT_DECLARATIONS }
  );
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  if (!itinerary) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Prepare SmartTag"
          backIcon="arrow-back"
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

  const isSynced =
    primaryBag?.setupState === 'SIMULATED_WRITE_COMPLETED' ||
    primaryBag?.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED';

  const syncStatusLabel = isSynced ? 'Synced' : 'Not yet synced';
  const syncStatusTone = isSynced ? 'jade' : 'neutral';

  const toggleDeclaration = (key: keyof SmartTagDeclarations) => {
    setFeedbackError(null);
    setDeclarations((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCycleBagCount = () => {
    const maxBags = Math.min(itinerary.checkedBagAllowance, repo.ownedTags.length);
    setBagCount((prev) => (prev >= maxBags ? 1 : prev + 1));
  };

  const handleContinue = () => {
    if (itinerary.checkInReadiness !== 'DEMO_CHECK_IN_COMPLETED') {
      setFeedbackError(
        'Online check-in is required before generating your digital baggage tag.'
      );
      return;
    }

    if (!areDeclarationsComplete(declarations)) {
      setFeedbackError(
        'Please confirm all preflight baggage requirements in "Before you continue" to proceed.'
      );
      return;
    }

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

  const allConfirmed =
    itinerary.checkInReadiness === 'DEMO_CHECK_IN_COMPLETED' &&
    areDeclarationsComplete(declarations);

  return (
    <View style={styles.root}>
      <CathayScreenHeader
        title="Prepare SmartTag"
        backIcon="arrow-back"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section A: Shared Flight Summary Card */}
        <FlightSummaryCard itinerary={itinerary} />

        {/* Section B: Baggage Details Card */}
        <BaggageDetailsCard
          bagCount={bagCount}
          maxBags={repo.ownedTags.length}
          selectedSmartTagCode={selectedSmartTagCode}
          ownedTags={repo.ownedTags}
          syncStatusLabel={syncStatusLabel}
          syncStatusTone={syncStatusTone}
          onCycleBagCount={handleCycleBagCount}
          onSelectSmartTagCode={setSelectedSmartTagCode}
        />

        {bagCount > 1 && (
          <InlineNotice
            tone="info"
            title="Distinct baggage identity per bag"
            message={`Each checked bag receives its own unique 10-digit IATA barcode and SmartTag assignment (${repo.ownedTags
              .slice(0, bagCount)
              .map((t, i) => `Bag ${i + 1}: ${t.smartTagCode}`)
              .join(' • ')}).`}
          />
        )}

        {itinerary.checkInReadiness === 'CHECK_IN_PENDING' && (
          <InlineNotice
            tone="warning"
            title="Check-in prerequisite required"
            message="Complete flight check-in before generating a baggage identity."
            actionLabel="Complete check-in"
            onAction={() => {
              smartTagRepository.setCheckInReadiness(
                itinerary.id,
                'DEMO_CHECK_IN_COMPLETED'
              );
              setFeedbackError(null);
            }}
          />
        )}

        {/* Section C: Before you continue */}
        <CathayCard style={styles.beforeCard}>
          <Text style={styles.beforeHeading}>Before you continue</Text>

          {/* Requirement 1: Dangerous goods declaration */}
          <TouchableOpacity
            style={styles.reqRow}
            onPress={() => toggleDeclaration('dangerousGoodsDeclared')}
            activeOpacity={0.75}
            testID="req-dangerous-goods"
          >
            <View
              style={[
                styles.reqIconCircle,
                !declarations.dangerousGoodsDeclared && styles.reqIconCircleUnchecked,
              ]}
            >
              <Image
                source={ICON_REQ_WARNING}
                style={styles.reqIconImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.reqText}>
              Dangerous goods declaration required at check-in
            </Text>
          </TouchableOpacity>

          <View style={styles.hairline} />

          {/* Requirement 2: Use at Cathay self bag-drop */}
          <TouchableOpacity
            style={styles.reqRow}
            onPress={() => toggleDeclaration('airportAcceptanceUnderstood')}
            activeOpacity={0.75}
            testID="req-bag-drop"
          >
            <View
              style={[
                styles.reqIconCircle,
                !declarations.airportAcceptanceUnderstood &&
                  styles.reqIconCircleUnchecked,
              ]}
            >
              <Image
                source={ICON_REQ_KIOSK}
                style={styles.reqIconImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.reqText}>Use at Cathay self bag-drop</Text>
          </TouchableOpacity>

          <View style={styles.hairline} />

          {/* Requirement 3: Keep SmartTag attached */}
          <TouchableOpacity
            style={[styles.reqRow, { paddingBottom: 2 }]}
            onPress={() => toggleDeclaration('tagSecuredToLuggage')}
            activeOpacity={0.75}
            testID="req-keep-attached"
          >
            <View
              style={[
                styles.reqIconCircle,
                !declarations.tagSecuredToLuggage && styles.reqIconCircleUnchecked,
              ]}
            >
              <Image
                source={ICON_REQ_TAG}
                style={styles.reqIconImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.reqText}>
              Keep your SmartTag attached until collection
            </Text>
          </TouchableOpacity>
        </CathayCard>

        {feedbackError && (
          <InlineNotice
            tone="danger"
            message={feedbackError}
            actionLabel="Confirm all requirements"
            onAction={() => {
              smartTagRepository.setCheckInReadiness(
                itinerary.id,
                'DEMO_CHECK_IN_COMPLETED'
              );
              setDeclarations({ ...DEFAULT_DECLARATIONS });
              setFeedbackError(null);
            }}
          />
        )}

        {/* Primary CTA */}
        <CathayPrimaryButton
          label="Continue"
          onPress={handleContinue}
          style={!allConfirmed ? styles.dimmedCta : undefined}
          testID="btn-prepare-continue"
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 118,
    gap: 11,
  },
  emptyWrap: {
    padding: 20,
  },
  beforeCard: {
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  beforeHeading: {
    fontSize: 16.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
  },
  reqIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CATHAY_MINT_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqIconCircleUnchecked: {
    backgroundColor: '#F2F4F5',
    opacity: 0.55,
  },
  reqIconImg: {
    width: 21,
    height: 22,
  },
  reqText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: '#3B4148',
  },
  hairline: {
    height: 1,
    backgroundColor: CATHAY_BORDER,
  },
  dimmedCta: {
    opacity: 0.65,
  },
});
