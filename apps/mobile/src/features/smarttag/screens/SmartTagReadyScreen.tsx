/**
 * Screen 04 — SmartTag Ready (Matches references/04_smarttag_ready.png)
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import {
  CATHAY_SERIF,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CathayPrimaryButton,
  CathayScreenHeader,
  HeaderSoftWave,
  SMARTTAG_SUCCESS_ART,
  AirportGuideSteps,
  InlineNotice,
} from '../components/CathaySmartTagPrimitives';
import { SmartTagStepper } from '../components/SmartTagStepper';
import { smartTagController, useSmartTagStore } from '../store';

export interface SmartTagReadyScreenProps {
  onOpenDevMenu?: () => void;
}

export const SmartTagReadyScreen: React.FC<SmartTagReadyScreenProps> = ({
  onOpenDevMenu,
}) => {
  const { repo } = useSmartTagStore();
  const itinerary =
    (repo.activeItineraryId
      ? repo.itineraries.find((i) => i.id === repo.activeItineraryId)
      : repo.itineraries[0]) ?? null;
  const bags = itinerary ? repo.bagSetupsByItinerary[itinerary.id] ?? [] : [];
  const bag =
    (repo.activeBagSetupId ? bags.find((b) => b.id === repo.activeBagSetupId) : bags[0]) ??
    null;

  if (!itinerary || !bag) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Cathay SmartTag"
          backIcon="chevron-back"
          onBack={() => smartTagController.goBack()}
          onLongPressTitle={onOpenDevMenu}
        />
        <View style={{ padding: 20 }}>
          <InlineNotice
            tone="warning"
            title="No synchronized SmartTag found"
            message="Please complete SmartTag preparation and synchronization first."
            actionLabel="Back to My bookings"
            onAction={() => smartTagController.navigateTo('bookings')}
          />
        </View>
      </View>
    );
  }

  const isSimulated = bag.setupState === 'SIMULATED_WRITE_COMPLETED';
  const isPhysicallyVerified =
    bag.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED' &&
    bag.lastWrite?.mode === 'PHYSICAL_HARDWARE' &&
    bag.lastWrite.verifiedHardwareReadback === true;

  if (!isSimulated && !isPhysicallyVerified) {
    const needsPreparation = bag.setupState === 'UNREGISTERED' || bag.setupState === 'LINKED';
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Cathay SmartTag"
          backIcon="chevron-back"
          onBack={() => smartTagController.goBack()}
          onLongPressTitle={onOpenDevMenu}
        />
        <View style={{ padding: 20 }}>
          <InlineNotice
            tone="warning"
            title="SmartTag setup is not complete"
            message="No completed demo simulation or verified physical write is available. Return to setup to continue."
          />
          <CathayPrimaryButton
            label={needsPreparation ? 'Back to Prepare SmartTag' : 'Back to Sync SmartTag'}
            onPress={() => smartTagController.navigateTo(needsPreparation ? 'prepare' : 'sync', {
              itineraryId: itinerary.id,
              bagSetupId: bag.id,
            })}
            testID="btn-return-to-smarttag-setup"
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

      {/* Stepper: All steps complete / Ready */}
      <SmartTagStepper currentStep="ready" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Art Visual */}
        <View style={styles.artWrap}>
          <Image
            source={SMARTTAG_SUCCESS_ART}
            style={styles.successArtImage}
            resizeMode="contain"
          />
        </View>

        {/* Heading Block */}
        <View style={styles.headingWrap}>
          <Text style={styles.title}>{isSimulated ? 'Demo SmartTag\nis ready' : 'Your SmartTag\nis ready'}</Text>
          <Text style={styles.subtitle}>
            {isSimulated
              ? 'Demo simulation completed. No physical tag was written.'
              : 'The baggage details have been successfully written to your tag.'}
          </Text>
        </View>

        {/* At the airport, it's simple — 3-step Guide */}
        <AirportGuideSteps />

        {/* Primary CTA: View baggage journey */}
        <CathayPrimaryButton
          label="View baggage journey"
          onPress={() =>
            smartTagController.navigateTo('journey', {
              itineraryId: itinerary.id,
              bagSetupId: bag.id,
            })
          }
          style={styles.journeyBtn}
          testID="btn-view-journey-from-ready"
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },

  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 2,
    height: 130,
  },
  successArtImage: {
    width: 156,
    height: 130,
  },

  headingWrap: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: CATHAY_SERIF,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'center',
  },

  journeyBtn: {
    marginTop: 2,
  },
});
