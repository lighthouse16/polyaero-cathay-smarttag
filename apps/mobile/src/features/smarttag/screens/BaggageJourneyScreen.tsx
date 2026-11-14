/**
 * Screen 05 — Baggage Journey (Taobao-Style Live Transport Progress, Arrival ETA & AI Risk Score)
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CATHAY_JADE,
  CATHAY_CRIMSON,
  CATHAY_AMBER_WARM,
  CATHAY_WARM_CREAM,
  CATHAY_WARM_BORDER,
  CATHAY_FONT_FAMILY,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CATHAY_TEXT_MUTED,
  InlineNotice,
  HeaderSoftWave,
} from '../components/CathaySmartTagPrimitives';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';
import {
  LiveCopilotBag,
  fetchLiveCopilotBag,
  choosePassengerRecovery,
} from '../../../services/copilotBridge';

const STAFF_STATUS_LABELS: Record<string, string> = {
  AWAITING_SYNC: 'Awaiting tag sync',
  TAGGED: 'Tag synced',
  CHECKED_IN: 'Bag accepted',
  LOADED: 'Loaded onto aircraft',
  ARRIVED: 'Arrived',
  ON_CAROUSEL: 'Arrived',
  COLLECTED: 'Collected',
  CLAIMED: 'Collected',
  MISROUTED: 'Misrouted',
  MISSING: 'Recovery in process',
  RECOVERY_IN_PROGRESS: 'Recovery in process',
};

const formatJourneyTimestamp = (timestamp: string | null) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
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
  const [liveBag, setLiveBag] = useState<LiveCopilotBag | null>(null);
  const [busyChoice, setBusyChoice] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'EXPRESS_NEXT_FLIGHT' | 'DIRECT_HOTEL_DELIVERY' | null>(null);
  const [hotelAddress, setHotelAddress] = useState('');
  const [addressSavedBanner, setAddressSavedBanner] = useState(false);

  const itinerary =
    (repo.activeItineraryId
      ? repo.itineraries.find((i) => i.id === repo.activeItineraryId)
      : repo.itineraries[0]) ?? null;

  const bags = itinerary ? repo.bagSetupsByItinerary[itinerary.id] ?? [] : [];
  const activeBag =
    (repo.activeBagSetupId ? bags.find((b) => b.id === repo.activeBagSetupId) : bags[0]) ??
    bags[0] ??
    null;

  const targetTagNumber = activeBag?.baggage.tagNumber;

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const data = await fetchLiveCopilotBag(targetTagNumber);
      if (active && data) {
        setLiveBag(data);
        if (
          data.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT' ||
          data.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY'
        ) {
          setSelectedOption(data.passenger_recovery_choice);
        }
        if (data.delivery_address && !hotelAddress) {
          setHotelAddress(data.delivery_address);
        }
      }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [targetTagNumber]);

  const journeyView =
    itinerary && activeBag
      ? smartTagRepository.getJourneyView(itinerary.id, activeBag.id)
      : null;

  if (!itinerary || !activeBag || !journeyView) {
    return (
      <View style={styles.root}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => smartTagController.goBack()}>
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
            message="Book a flight and sync your SmartTag to track your baggage."
            actionLabel="Back to My bookings"
            onAction={() => smartTagController.navigateTo('bookings')}
          />
        </View>
      </View>
    );
  }

  const isLocalTagSynced =
    activeBag.setupState === 'SIMULATED_WRITE_COMPLETED' ||
    activeBag.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED';

  const liveStatusCode = liveBag
    ? liveBag.status
    : isLocalTagSynced
      ? 'TAGGED'
      : 'AWAITING_SYNC';

  const isAwaitingSync = liveStatusCode === 'AWAITING_SYNC' && !isLocalTagSynced;
  const isMissing = liveStatusCode === 'MISSING';
  const isMisroutedOrRecovering =
    liveStatusCode === 'MISROUTED' || liveStatusCode === 'RECOVERY_IN_PROGRESS';

  const orderIndexMap: Record<string, number> = {
    AWAITING_SYNC: -1,
    TAGGED: 0,
    CHECKED_IN: 1,
    LOADED: 2,
    ARRIVED: 3,
    ON_CAROUSEL: 3,
    COLLECTED: 4,
    CLAIMED: 4,
  };
  const currentStepIdx = orderIndexMap[liveStatusCode] ?? (isLocalTagSynced ? 0 : -1);

  const activeFlightNum = liveBag?.flight_number || itinerary.flight.flightNumber;
  const activeOrigin = liveBag?.departure_airport || itinerary.flight.origin;
  const activeDest = liveBag?.arrival_airport || itinerary.flight.destination;
  const expectedArrival =
    liveBag?.recovery_eta || liveBag?.predicted_arrival_time || 'Today, 14:35 Local';
  const carouselName = liveBag?.carousel_assigned || 'Belt 7';

  // Taobao-style horizontal transport route nodes
  const transitLegs = [
    { key: 'sync', label: 'Tag Synced', icon: 'pricetag' as const, done: currentStepIdx >= 0 },
    { key: 'drop', label: `${activeOrigin} Drop`, icon: 'cube' as const, done: currentStepIdx >= 1 },
    { key: 'air', label: activeFlightNum, icon: 'airplane' as const, done: currentStepIdx >= 2 },
    { key: 'arr', label: `${activeDest} ${carouselName}`, icon: 'location' as const, done: currentStepIdx >= 3 },
    { key: 'done', label: 'Collected', icon: 'checkmark-circle' as const, done: currentStepIdx >= 4 },
  ];
  const progressPercent = isAwaitingSync
    ? 5
    : isMissing || isMisroutedOrRecovering
      ? 45
      : Math.min(100, Math.round(((currentStepIdx + 1) / transitLegs.length) * 100));

  const riskScore = liveBag?.risk_score ?? 22;
  const riskLevel = liveBag?.risk_level ?? 'LOW';
  const isHighRisk = riskLevel === 'HIGH_PRIORITY' || riskScore >= 65;

  const baseMilestones = journeyView.items.map(
    (
      item,
      idx
    ): (typeof journeyView.items)[number] & {
      state: 'completed' | 'current' | 'pending' | 'delayed' | 'exception';
    } => {
    if (isMissing || isMisroutedOrRecovering) {
      if (idx === 0) return { ...item, state: 'completed' as const };
      if (idx === 1) {
        return {
          ...item,
          title: 'Recovery in process',
          subtitle: isMissing
            ? 'Our baggage team is locating your bag'
            : 'Rerouting your bag to your destination',
          state: 'delayed' as const,
        };
      }
      return { ...item, state: 'pending' as const };
    }

    if (idx <= currentStepIdx) {
      return { ...item, state: 'completed' as const };
    }
    if (idx === currentStepIdx + 1) {
      return { ...item, state: 'current' as const };
    }
    return { ...item, state: 'pending' as const };
  });

  const lastUpdated = formatJourneyTimestamp(journeyView.lastUpdatedAt);
  const badgeLabel = isAwaitingSync
    ? 'Awaiting tag sync'
    : STAFF_STATUS_LABELS[liveStatusCode] || 'Tag synced';

  return (
    <View style={styles.root}>
      <HeaderSoftWave />
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => smartTagController.goBack()}
          testID="smarttag-back-btn"
        >
          <Ionicons name="chevron-back" size={24} color={CATHAY_JADE} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Baggage journey</Text>
          <Text style={styles.headerSubtitle}>
            {activeFlightNum} · {activeOrigin} → {activeDest} · Tag {activeBag.baggage.tagNumber}
          </Text>
        </View>

        {onOpenDevMenu ? (
          <TouchableOpacity style={styles.headerRightBtn} onPress={onOpenDevMenu}>
            <Ionicons name="ellipsis-horizontal" size={20} color={CATHAY_TEXT_PRIMARY} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRightSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Taobao-Style Hero Delivery ETA & Transport Progress Card */}
        <View style={styles.etaHeroCard}>
          <View style={styles.etaTopRow}>
            <View>
              <Text style={styles.etaEyebrow}>EXPECTED BAGGAGE ARRIVAL</Text>
              <Text style={styles.etaTimeText}>{expectedArrival}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{badgeLabel}</Text>
            </View>
          </View>

          <Text style={styles.etaSubText}>
            Destination: {activeDest} International · {carouselName}
          </Text>

          {/* Horizontal Node-to-Node Transport Progress Bar */}
          <View style={styles.progressTrackWrap}>
            <View style={styles.progressTrackBg}>
              <View style={[styles.progressTrackFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.nodesRow}>
              {transitLegs.map((leg) => (
                <View key={leg.key} style={styles.transitNode}>
                  <View style={[styles.transitDot, leg.done && styles.transitDotDone]}>
                    <Ionicons
                      name={leg.icon}
                      size={11}
                      color={leg.done ? '#FFFFFF' : '#718096'}
                    />
                  </View>
                  <Text
                    style={[styles.transitLabel, leg.done && styles.transitLabelDone]}
                    numberOfLines={1}
                  >
                    {leg.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* AI Flight & Bag Risk Prediction Card (Sent Live to Passenger) */}
        <View style={[styles.riskCard, isHighRisk && styles.riskCardHigh]}>
          <View style={styles.riskHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={isHighRisk ? 'shield-half' : 'shield-checkmark'}
                size={18}
                color={isHighRisk ? CATHAY_AMBER_WARM : CATHAY_JADE}
              />
              <Text style={styles.riskTitle}>Flight &amp; Bag Risk Prediction</Text>
            </View>
            <View style={[styles.riskScoreBadge, isHighRisk && styles.riskScoreBadgeHigh]}>
              <Text style={[styles.riskScoreText, isHighRisk && styles.riskScoreTextHigh]}>
                {riskScore}/100 · {riskLevel.replace('_', ' ')}
              </Text>
            </View>
          </View>
          <Text style={styles.riskSummary}>
            {liveBag?.passenger_risk_summary ||
              `Smooth transfer outlook on ${activeFlightNum} (${activeOrigin} → ${activeDest}).`}
          </Text>
          {liveBag?.risk_factors && liveBag.risk_factors.length > 0 && (
            <Text style={styles.riskFactorsText}>
              Factors: {liveBag.risk_factors.join(' · ')}
            </Text>
          )}
        </View>

        {/* Prompt to sync tag if passenger has not yet synced */}
        {isAwaitingSync && (
          <TouchableOpacity
            style={styles.syncNowCard}
            onPress={() =>
              smartTagController.navigateTo('prepare', {
                itineraryId: itinerary.id,
                bagSetupId: activeBag.id,
              })
            }
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.syncNowTitle}>Complete SmartTag™ Sync</Text>
              <Text style={styles.syncNowSub}>
                Pair your bag tag now to activate live airport tracking.
              </Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={26} color={CATHAY_JADE} />
          </TouchableOpacity>
        )}

        {/* MISSING BAG: Recovery in Process + Call Customer Service */}
        {isMissing && (
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>Recovery in process</Text>
            <Text style={styles.missingSub}>
              Our baggage tracing team is locating your bag. Contact our 24/7 Baggage Service Call Center for immediate assistance.
            </Text>
            <TouchableOpacity
              style={styles.callCenterBtn}
              onPress={() => void Linking.openURL('tel:+85227473333')}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.callCenterBtnText}>
                Call Customer Service (+852 2747 3333)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MISROUTED / RECOVERY IN PROCESS: Express Flight vs. Hotel Delivery */}
        {isMisroutedOrRecovering && liveBag && (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>Choose how to receive your bag</Text>
            <Text style={styles.recoverySub}>Select your preferred delivery option below:</Text>

            <View style={styles.choiceRow}>
              <TouchableOpacity
                disabled={busyChoice}
                onPress={async () => {
                  setSelectedOption('EXPRESS_NEXT_FLIGHT');
                  setBusyChoice(true);
                  const updated = await choosePassengerRecovery(
                    'EXPRESS_NEXT_FLIGHT',
                    undefined,
                    liveBag.tag_number
                  );
                  if (updated) setLiveBag(updated);
                  setBusyChoice(false);
                }}
                style={[
                  styles.choiceBtn,
                  (selectedOption === 'EXPRESS_NEXT_FLIGHT' ||
                    liveBag.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT') &&
                    styles.choiceBtnSelected,
                ]}
              >
                <Ionicons
                  name="airplane"
                  size={16}
                  color={
                    selectedOption === 'EXPRESS_NEXT_FLIGHT' ||
                    liveBag.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT'
                      ? '#FFFFFF'
                      : CATHAY_JADE
                  }
                />
                <Text
                  style={[
                    styles.choiceBtnText,
                    (selectedOption === 'EXPRESS_NEXT_FLIGHT' ||
                      liveBag.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT') &&
                      styles.choiceBtnTextSelected,
                  ]}
                >
                  Express Next Flight
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={busyChoice}
                onPress={() => {
                  setSelectedOption('DIRECT_HOTEL_DELIVERY');
                  setAddressSavedBanner(false);
                }}
                style={[
                  styles.choiceBtn,
                  (selectedOption === 'DIRECT_HOTEL_DELIVERY' ||
                    liveBag.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY') &&
                    styles.choiceBtnSelected,
                ]}
              >
                <Ionicons
                  name="business"
                  size={16}
                  color={
                    selectedOption === 'DIRECT_HOTEL_DELIVERY' ||
                    liveBag.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY'
                      ? '#FFFFFF'
                      : CATHAY_JADE
                  }
                />
                <Text
                  style={[
                    styles.choiceBtnText,
                    (selectedOption === 'DIRECT_HOTEL_DELIVERY' ||
                      liveBag.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY') &&
                      styles.choiceBtnTextSelected,
                  ]}
                >
                  Hotel Delivery
                </Text>
              </TouchableOpacity>
            </View>

            {(selectedOption === 'EXPRESS_NEXT_FLIGHT' ||
              liveBag.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT') &&
              liveBag.recovery_flight_number && (
                <View style={styles.outcomeBox}>
                  <Text style={styles.outcomeLabel}>EXPRESS REBOOKING CONFIRMED</Text>
                  <Text style={styles.outcomeMain}>
                    Flight {liveBag.recovery_flight_number} ({activeOrigin} → {activeDest})
                  </Text>
                  <Text style={styles.outcomeEta}>
                    Predicted arrival: {liveBag.recovery_eta || 'Today, 21:45 Local'}
                  </Text>
                </View>
              )}

            {(selectedOption === 'DIRECT_HOTEL_DELIVERY' ||
              liveBag.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY') && (
              <View style={styles.outcomeBox}>
                <Text style={styles.outcomeLabel}>HOTEL DELIVERY ADDRESS</Text>
                <TextInput
                  style={styles.addressInput}
                  placeholder="Enter hotel name & street address..."
                  placeholderTextColor="#94A3B8"
                  value={hotelAddress}
                  onChangeText={(txt) => {
                    setHotelAddress(txt);
                    setAddressSavedBanner(false);
                  }}
                />
                <TouchableOpacity
                  disabled={busyChoice || !hotelAddress.trim()}
                  onPress={async () => {
                    setBusyChoice(true);
                    const updated = await choosePassengerRecovery(
                      'DIRECT_HOTEL_DELIVERY',
                      hotelAddress.trim(),
                      liveBag.tag_number
                    );
                    if (updated) {
                      setLiveBag(updated);
                      setAddressSavedBanner(true);
                    }
                    setBusyChoice(false);
                  }}
                  style={[styles.saveAddressBtn, !hotelAddress.trim() && { opacity: 0.5 }]}
                >
                  <Text style={styles.saveAddressBtnText}>
                    {addressSavedBanner || liveBag.delivery_address
                      ? 'Update Hotel Address'
                      : 'Confirm Hotel Delivery'}
                  </Text>
                </TouchableOpacity>

                {liveBag.delivery_address && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.outcomeMain}>
                      Delivering to: {liveBag.delivery_address}
                    </Text>
                    <Text style={styles.outcomeEta}>
                      {liveBag.recovery_eta || 'Courier dispatch confirmed'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Detailed Vertical Scan Log */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionHeading}>Handling Checkpoints</Text>
          {baseMilestones.map((item, idx) => {
            const isLast = idx === baseMilestones.length - 1;
            const isDone = item.state === 'completed';
            const isCurrent = item.state === 'current';
            const isProblem = item.state === 'exception' || item.state === 'delayed';
            const timestamp = formatJourneyTimestamp(item.timestamp);

            return (
              <View key={item.key} style={styles.timelineRow}>
                <View style={styles.nodeCol}>
                  <View style={isCurrent ? styles.haloCircle : styles.normalNodeWrap}>
                    <View
                      style={[
                        styles.circle,
                        isDone && styles.circleDone,
                        item.state === 'delayed' && styles.circleDelayed,
                        item.state === 'exception' && styles.circleException,
                      ]}
                    >
                      {isProblem ? (
                        <Ionicons name="alert" size={13} color="#FFFFFF" />
                      ) : isDone ? (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      ) : (
                        <View
                          style={[
                            styles.circlePendingInner,
                            isCurrent && styles.circleCurrentInner,
                          ]}
                        />
                      )}
                    </View>
                  </View>
                  {!isLast && (
                    <View style={[styles.connector, isDone && styles.connectorDone]} />
                  )}
                </View>

                <View style={[styles.contentCol, !isLast && styles.contentColBorder]}>
                  <View style={styles.titleTimeRow}>
                    <View style={styles.titleLocationWrap}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemLocation}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.timeStackCol}>
                      {timestamp ? (
                        <Text style={styles.itemDateText}>{timestamp.date}</Text>
                      ) : null}
                      <Text style={styles.itemTimeText}>{timestamp?.time ?? '—'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.lastUpdatedStrip}>
          <View style={styles.lastUpdatedLeft}>
            <Ionicons name="shield-checkmark-outline" size={16} color={CATHAY_JADE} />
            <Text style={styles.lastUpdatedText}>
              {lastUpdated ? `Updated ${lastUpdated.date} · ${lastUpdated.time}` : 'Live tracking active'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.reportIssueBtn}
          onPress={() =>
            smartTagController.navigateTo('report', {
              itineraryId: itinerary.id,
              bagSetupId: activeBag.id,
            })
          }
          activeOpacity={0.8}
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
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: CATHAY_TEXT_MUTED,
    marginTop: 1,
  },
  headerRightBtn: { padding: 6 },
  headerRightSpacer: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  etaHeroCard: {
    backgroundColor: '#004B4A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  etaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  etaEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#A7D7D2',
    letterSpacing: 0.6,
  },
  etaTimeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 3,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  etaSubText: {
    fontSize: 12.5,
    color: '#D7EBE8',
    marginTop: 4,
    marginBottom: 16,
  },
  progressTrackWrap: {
    marginTop: 2,
  },
  progressTrackBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressTrackFill: {
    height: 4,
    backgroundColor: '#6EE7B7',
    borderRadius: 2,
  },
  nodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transitNode: {
    alignItems: 'center',
    flex: 1,
  },
  transitDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  transitDotDone: {
    backgroundColor: '#00875A',
  },
  transitLabel: {
    fontSize: 9.5,
    color: '#A7D7D2',
    fontWeight: '600',
    textAlign: 'center',
  },
  transitLabelDone: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  riskCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7EBE8',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  riskCardHigh: {
    backgroundColor: CATHAY_WARM_CREAM,
    borderColor: CATHAY_WARM_BORDER,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  riskTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1C2024',
  },
  riskScoreBadge: {
    backgroundColor: '#EBF4F1',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  riskScoreBadgeHigh: {
    backgroundColor: '#F4EFE4',
  },
  riskScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: CATHAY_JADE,
  },
  riskScoreTextHigh: {
    color: CATHAY_AMBER_WARM,
  },
  riskSummary: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 17,
  },
  riskFactorsText: {
    fontSize: 11,
    color: CATHAY_TEXT_MUTED,
    marginTop: 5,
  },
  syncNowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4F1',
    borderColor: CATHAY_JADE,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  syncNowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#004B4A',
  },
  syncNowSub: {
    fontSize: 12,
    color: '#284239',
    marginTop: 2,
  },
  missingCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECEEEF',
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderLeftColor: CATHAY_CRIMSON,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  missingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  missingSub: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  callCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#284239',
    borderRadius: 10,
    paddingVertical: 11,
    gap: 8,
  },
  callCenterBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  recoveryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#006564',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  recoveryTitle: {
    color: '#004B4A',
    fontWeight: '700',
    fontSize: 15,
  },
  recoverySub: {
    color: CATHAY_TEXT_SECONDARY,
    fontSize: 12.5,
    marginTop: 3,
    marginBottom: 12,
  },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F4FAF9',
    borderColor: CATHAY_JADE,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  choiceBtnSelected: {
    backgroundColor: CATHAY_JADE,
  },
  choiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: CATHAY_JADE,
  },
  choiceBtnTextSelected: {
    color: '#FFFFFF',
  },
  outcomeBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#EBF4F1',
    borderRadius: 10,
  },
  outcomeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#006564',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  outcomeMain: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1C2024',
  },
  outcomeEta: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#004B4A',
    marginTop: 3,
  },
  addressInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1C2024',
    marginTop: 4,
    marginBottom: 8,
  },
  saveAddressBtn: {
    backgroundColor: '#284239',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveAddressBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: CATHAY_TEXT_SECONDARY,
    marginBottom: 12,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  timelineRow: { flexDirection: 'row' },
  nodeCol: { width: 28, alignItems: 'center' },
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
    backgroundColor: CATHAY_AMBER_WARM,
    borderColor: CATHAY_AMBER_WARM,
  },
  circleException: {
    backgroundColor: CATHAY_CRIMSON,
    borderColor: CATHAY_CRIMSON,
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
    paddingBottom: 10,
  },
  contentColBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 8,
  },
  titleTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleLocationWrap: { flex: 1 },
  timeStackCol: {
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
  itemDateText: {
    fontSize: 12,
    color: CATHAY_TEXT_MUTED,
    fontWeight: '500',
  },
  itemTimeText: {
    fontSize: 12.5,
    color: CATHAY_TEXT_PRIMARY,
    fontWeight: '600',
    marginTop: 1,
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  itemLocation: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    marginTop: 2,
  },
  lastUpdatedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  lastUpdatedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastUpdatedText: {
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
