/**
 * Screen 05 — Baggage Journey (Matches references/05_baggage_journey.png)
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
import {
  CATHAY_JADE,
  CATHAY_FONT_FAMILY,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CATHAY_TEXT_MUTED,
  JadeStatusCard,
  InlineNotice,
  HeaderSoftWave,
} from '../components/CathaySmartTagPrimitives';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

const formatJourneyTimestamp = (timestamp: string | null) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    }),
    time: `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`,
  };
};

export interface BaggageJourneyScreenProps {
  onOpenDevMenu?: () => void;
}

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
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => smartTagController.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={CATHAY_JADE} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Baggage journey</Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>
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

  const milestones = journeyView.items;
  const statusItem =
    milestones.find((item) => item.state === 'exception' || item.state === 'delayed') ??
    milestones.find((item) => item.state === 'current') ??
    [...milestones].reverse().find((item) => item.state === 'completed');
  const lastUpdated = formatJourneyTimestamp(journeyView.lastUpdatedAt);

  return (
    <View style={styles.root}>
      <HeaderSoftWave />
      {/* Header Bar matching references/05_baggage_journey.png */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => smartTagController.goBack()}
          testID="smarttag-back-btn"
        >
          <Ionicons name="chevron-back" size={24} color={CATHAY_JADE} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Baggage journey</Text>
          <Text style={styles.headerSubtitle}>
            {itinerary.flight.flightNumber} · {itinerary.flight.origin} → {itinerary.flight.destination}
          </Text>
        </View>

        {onOpenDevMenu ? (
          <TouchableOpacity
            style={styles.headerRightBtn}
            onPress={onOpenDevMenu}
            accessibilityRole="button"
            accessibilityLabel="Open developer menu"
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={CATHAY_TEXT_PRIMARY} />
          </TouchableOpacity>
        ) : <View style={styles.headerRightSpacer} />}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Jade Status Card */}
        <JadeStatusCard
          title={journeyView.statusBadgeLabel}
          subtitle={statusItem?.subtitle ?? 'Awaiting baggage updates'}
        />

        {journeyView.isSimulated && (
          <InlineNotice
            tone="demo"
            message="Demo journey - not verified airport scans."
          />
        )}

        {/* Vertical Timeline Card */}
        <View style={styles.timelineCard}>
          {milestones.map((item, idx) => {
            const isLast = idx === milestones.length - 1;
            const isDone = item.state === 'completed';
            const isCurrent = item.state === 'current';
            const isProblem = item.state === 'exception' || item.state === 'delayed';
            const isSimulated = item.isSimulated ||
              (item.key === 'tag_synced' && activeBag.lastWrite?.mode === 'SIMULATED_DEMO');
            const timestamp = formatJourneyTimestamp(item.timestamp);
            const stateLabel = item.state === 'current'
              ? 'Awaiting update'
              : item.state.charAt(0).toUpperCase() + item.state.slice(1);
            return (
              <View key={item.key} style={styles.timelineRow}>
                {/* Node & Line Col */}
                <View style={styles.nodeCol}>
                  <View style={isCurrent ? styles.haloCircle : styles.normalNodeWrap}>
                    <View style={[
                      styles.circle,
                      isDone && styles.circleDone,
                      item.state === 'delayed' && styles.circleDelayed,
                      item.state === 'exception' && styles.circleException,
                    ]}>
                      {isProblem ? (
                        <Ionicons name="alert" size={13} color="#FFFFFF" />
                      ) : isDone ? (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      ) : (
                        <View style={[styles.circlePendingInner, isCurrent && styles.circleCurrentInner]} />
                      )}
                    </View>
                  </View>
                  {!isLast && <View style={[styles.connector, isDone && styles.connectorDone]} />}
                </View>

                {/* Content Col */}
                <View style={[styles.contentCol, !isLast && styles.contentColBorder]}>
                  <View style={styles.titleTimeRow}>
                    <View style={styles.titleLocationWrap}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemLocation}>{item.subtitle}</Text>
                      <Text style={styles.itemTime}>
                        {stateLabel}{isSimulated ? ' \u00b7 Simulated' : ''}
                        {item.sourceLabel ? ` \u00b7 ${item.sourceLabel}` : ''}
                      </Text>
                    </View>
                    <View style={styles.timeStackCol}>
                      {timestamp ? <Text style={styles.itemDateText}>{timestamp.date}</Text> : null}
                      <Text style={styles.itemTimeText}>{timestamp?.time ?? '\u2014'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Last updated footer strip */}
        <View style={styles.lastUpdatedStrip}>
          <View style={styles.lastUpdatedLeft}>
            <Ionicons name="information-circle-outline" size={16} color={CATHAY_TEXT_MUTED} />
            <Text style={styles.lastUpdatedText}>
              {lastUpdated
                ? `Last updated ${lastUpdated.date} \u00b7 ${lastUpdated.time}`
                : 'No update time available'}
            </Text>
          </View>
        </View>

        {/* Report an issue secondary action */}
        <TouchableOpacity
          style={styles.reportIssueBtn}
          accessibilityRole="button"
          accessibilityLabel="Report a baggage issue"
          onPress={() =>
            smartTagController.navigateTo('report', {
              itineraryId: itinerary.id,
              bagSetupId: activeBag.id,
            })
          }
          activeOpacity={0.8}
          testID="btn-report-issue-entry"
        >
          <Ionicons name="help-circle-outline" size={18} color={CATHAY_JADE} />
          <Text style={styles.reportIssueBtnText}>Report a baggage issue</Text>
          <Ionicons name="chevron-forward" size={16} color={CATHAY_JADE} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? 68 : 56,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: CATHAY_TEXT_MUTED,
    marginTop: 1,
  },
  headerRightBtn: {
    padding: 6,
  },
  headerRightSpacer: {
    width: 32,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },

  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  nodeCol: {
    width: 28,
    alignItems: 'center',
  },
  haloCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D7EBE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  normalNodeWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: CATHAY_JADE,
    borderColor: CATHAY_JADE,
  },
  circleDelayed: {
    backgroundColor: '#A16207',
    borderColor: '#A16207',
  },
  circleException: {
    backgroundColor: '#B91C1C',
    borderColor: '#B91C1C',
  },
  circleCurrentInner: {
    backgroundColor: CATHAY_JADE,
  },
  circlePendingInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  connectorDone: {
    backgroundColor: CATHAY_JADE,
  },

  contentCol: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 8,
  },
  contentColBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 6,
  },
  titleTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleLocationWrap: {
    flex: 1,
  },
  timeStackCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingLeft: 8,
  },
  itemDateText: {
    fontSize: 12,
    color: CATHAY_TEXT_MUTED,
    fontWeight: '500',
    textAlign: 'right',
  },
  itemTimeText: {
    fontSize: 12.5,
    color: CATHAY_TEXT_PRIMARY,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 1,
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  itemTime: {
    fontSize: 10.5,
    lineHeight: 14,
    color: CATHAY_TEXT_MUTED,
  },
  itemLocation: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    marginTop: 2,
  },

  lastUpdatedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  lastUpdatedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastUpdatedText: {
    flexShrink: 1,
    fontSize: 12.5,
    color: CATHAY_TEXT_MUTED,
  },

  reportIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    gap: 8,
  },
  reportIssueBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: CATHAY_JADE,
  },
});
