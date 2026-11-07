/**
 * Screen 04 — SmartTag Ready (Matches Design 04 Mockup & Cathay Design System)
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
import { Ionicons } from '@expo/vector-icons';
import {
  CATHAY_BG,
  CATHAY_JADE,
  CATHAY_MINT_BADGE,
  CATHAY_MINT_SURFACE,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CathayPrimaryButton,
  CathayScreenHeader,
  ICON_STEP_BELT,
  ICON_STEP_QR,
  ICON_STEP_TAG,
  InlineNotice,
  SmartTagIdentityCard,
} from '../components/CathaySmartTagPrimitives';
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
    bags[0] ??
    null;

  if (!itinerary || !bag) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="SmartTag ready"
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

  return (
    <View style={styles.root}>
      <CathayScreenHeader
        title="SmartTag ready"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Positive Confirmation Block */}
        <View style={styles.heroCheckSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={30} color={CATHAY_JADE} />
          </View>

          <Text style={styles.heroTitle}>Your SmartTag is ready</Text>
          <Text style={styles.heroSubtitle}>
            You can now go directly to Cathay self bag-drop at the{'\n'}airport.
          </Text>
        </View>

        {/* Tag Details Card (Shared Foundation Component) */}
        <SmartTagIdentityCard variant="ready" itinerary={itinerary} bag={bag} />

        {/* Airport Next Steps Mint Box (Exact Design 04) */}
        <View style={styles.stepsMintCard}>
          <View style={styles.stepRow}>
            <View style={styles.stepIconCol}>
              <Image
                source={ICON_STEP_TAG}
                style={styles.stepIconImg}
                resizeMode="contain"
              />
            </View>
            <View style={styles.stepDivider} />
            <Text style={styles.stepText}>1. Attach SmartTag to your luggage</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconCol}>
              <Image
                source={ICON_STEP_QR}
                style={styles.stepIconImg}
                resizeMode="contain"
              />
            </View>
            <View style={styles.stepDivider} />
            <Text style={styles.stepText}>
              2. Scan boarding pass at self bag-drop
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconCol}>
              <Image
                source={ICON_STEP_BELT}
                style={styles.stepIconImg}
                resizeMode="contain"
              />
            </View>
            <View style={styles.stepDivider} />
            <Text style={styles.stepText}>
              3. Place your bag on the belt for weighing
            </Text>
          </View>
        </View>

        {/* Primary CTA */}
        <CathayPrimaryButton
          label="View baggage journey"
          onPress={() =>
            smartTagController.navigateTo('journey', {
              itineraryId: itinerary.id,
              bagSetupId: bag.id,
            })
          }
          testID="btn-ready-view-journey"
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
    gap: 13,
  },
  heroCheckSection: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CATHAY_MINT_BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: CATHAY_TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 5,
  },
  stepsMintCard: {
    backgroundColor: CATHAY_MINT_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIconCol: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconImg: {
    width: 24,
    height: 22,
  },
  stepDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#C5DBD6',
    marginHorizontal: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#2B3035',
    fontWeight: '400',
  },
});
