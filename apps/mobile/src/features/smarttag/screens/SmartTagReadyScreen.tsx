/**
 * Screen 04 — SmartTag Ready (Matches Design 04 Mockup)
 *
 * Sections:
 *   - Header: Back arrow + centered "SmartTag ready"
 *   - Positive confirmation circle + heading + short supporting explanation
 *     - Physical hardware verified write vs. Demo simulation clearly distinguished
 *   - "Tag details" card (Bag ID CX880123456, Route HKG → NRT, Flight CX548, Status Awaiting bag-drop)
 *   - Airport instructions mint box (1. Attach SmartTag, 2. Scan boarding pass, 3. Place bag on belt)
 *   - Primary CTA: "View baggage journey" + Secondary link "Back to My bookings"
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CATHAY_BG,
  CATHAY_JADE,
  CATHAY_JADE_DARK,
  CATHAY_MINT_SURFACE,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CathayCard,
  CathayPrimaryButton,
  CathayScreenHeader,
  CathaySecondaryButton,
  InlineNotice,
  SuitcaseWithTagGlyph,
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

  const { flight } = itinerary;

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
        {/* Top Positive Confirmation Block (Exact Design 04) */}
        <View style={styles.heroCheckSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={30} color={CATHAY_JADE} />
          </View>

          <Text style={styles.heroTitle}>Your SmartTag is ready</Text>
          <Text style={styles.heroSubtitle}>
            You can now go directly to Cathay self bag-drop at the{'\n'}airport.
          </Text>
        </View>

        {/* Tag Details Card (Matches Design 04 rows) */}
        <CathayCard style={styles.tagDetailsCard}>
          <View style={styles.cardHeadingRow}>
            <SuitcaseWithTagGlyph size="sm" />
            <Text style={styles.cardHeadingText}>Tag details</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bag ID</Text>
            <Text style={styles.detailValue}>{bag.displayBagCode}</Text>
          </View>

          <View style={styles.hairline} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Route</Text>
            <Text style={styles.detailValue}>
              {flight.origin} → {flight.destination}
            </Text>
          </View>

          <View style={styles.hairline} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Flight</Text>
            <Text style={styles.detailValue}>{flight.flightNumber}</Text>
          </View>

          <View style={styles.hairline} />

          <View style={[styles.detailRow, { paddingBottom: 4 }]}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue}>Awaiting bag-drop</Text>
          </View>

          {/* Compact technical footnote distinguishing SmartTag device ID from journey Bag ID */}
          <View style={styles.identityFootnote}>
            <Text style={styles.identityFootnoteText}>
              SmartTag ID: {bag.smartTagCode} • IATA LP: {bag.baggage.tagNumber}
            </Text>
          </View>
        </CathayCard>

        {/* Airport Next Steps Mint Box (Exact Design 04) */}
        <View style={styles.stepsMintCard}>
          <View style={styles.stepRow}>
            <View style={styles.stepIconCol}>
              <Ionicons name="pricetag-outline" size={20} color={CATHAY_JADE_DARK} />
            </View>
            <View style={styles.stepDivider} />
            <Text style={styles.stepText}>1. Attach SmartTag to your luggage</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconCol}>
              <Ionicons name="qr-code-outline" size={20} color={CATHAY_JADE_DARK} />
            </View>
            <View style={styles.stepDivider} />
            <Text style={styles.stepText}>
              2. Scan boarding pass at self bag-drop
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconCol}>
              {/* Custom bag-on-conveyor-belt icon matching Design 04 step 3 */}
              <View style={styles.beltGlyphWrap}>
                <View style={styles.beltBagBox} />
                <View style={styles.beltBaseTrack}>
                  <View style={styles.beltDot} />
                  <View style={styles.beltDot} />
                  <View style={styles.beltDot} />
                </View>
              </View>
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

        <CathaySecondaryButton
          label="Back to My bookings"
          variant="link"
          onPress={() => smartTagController.navigateTo('bookings')}
          testID="btn-ready-back-bookings"
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
    paddingTop: 8,
    paddingBottom: 116,
    gap: 11,
  },
  heroCheckSection: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  checkCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCECE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
    lineHeight: 19,
    color: CATHAY_TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 4,
  },
  simPillWrap: {
    marginTop: 6,
  },
  tagDetailsCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  cardHeadingText: {
    fontSize: 17,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  detailLabel: {
    fontSize: 14.5,
    color: '#4B5259',
  },
  detailValue: {
    fontSize: 14.5,
    fontWeight: '600',
    color: CATHAY_JADE,
  },
  hairline: {
    height: 1,
    backgroundColor: '#ECEEEF',
  },
  identityFootnote: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  identityFootnoteText: {
    fontSize: 11.5,
    color: '#6B7280',
  },
  stepsMintCard: {
    backgroundColor: CATHAY_MINT_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 13,
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
  beltGlyphWrap: {
    alignItems: 'center',
  },
  beltBagBox: {
    width: 12,
    height: 9,
    borderWidth: 1.5,
    borderColor: CATHAY_JADE_DARK,
    borderRadius: 2,
    marginBottom: 1,
  },
  beltBaseTrack: {
    width: 20,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.4,
    borderColor: CATHAY_JADE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  beltDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: CATHAY_JADE_DARK,
  },
});
