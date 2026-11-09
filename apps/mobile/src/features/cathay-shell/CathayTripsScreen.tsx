/**
 * Screen 01 — My Bookings & Passenger SmartTag Flow Host (Matches Design 01 Mockup)
 *
 * Preserves the exact Phase 1A Cathay My bookings shell:
 *   - Centered "My bookings" heading
 *   - "Upcoming" | "Past" segmented underline navigation
 *   - Genuine empty state when no upcoming bookings exist ("You have no upcoming bookings")
 *   - "Add booking" modal + clearly labeled "Load CX548 demo itinerary (HKG → NRT)" helper
 *   - Upcoming booking card matching Design 01:
 *       Fri 21 Nov 2026 | Booking reference 8K3F7D
 *       HKG (Hong Kong) ✈ NRT (Tokyo)
 *       CX548 | 1 passenger
 *       Baggage & SmartTag section with suitcase-tag glyph, conditional primary CTA
 *       ("Set up SmartTag" / "Continue setup" / "View SmartTag"), and secondary
 *       "View baggage journey >" row.
 *   - Hosts the sub-screens (`PrepareSmartTagScreen`, `SyncSmartTagScreen`,
 *     `SmartTagReadyScreen`, `BaggageJourneyScreen`, `ReportBaggageIssueScreen`)
 *     inside the My trips tab so the 5-tab floating pill dock remains visible and
 *     state persists across all transitions.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  BackHandler,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DEMO_BOOKING_REFERENCE,
  PassengerItinerary,
  resolveBookingSmartTagEntry,
} from '@polyaero/shared';
import { FlightBooking, UserAuthProfile, INITIAL_BOOKING } from './CathayTypes';
import {
  CATHAY_BG,
  CATHAY_BORDER,
  CATHAY_JADE,
  CATHAY_FONT_FAMILY,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  JadeBookingTicketCard,
  SmartTagEntryCard,
  YourBaggageCard,
  HeaderSoftWave,
  CONCEPT_BRUSHWING,
} from '../smarttag/components/CathaySmartTagPrimitives';
import {
  smartTagController,
  smartTagRepository,
  useSmartTagStore,
} from '../smarttag/store';
import { PrepareSmartTagScreen } from '../smarttag/screens/PrepareSmartTagScreen';
import { SyncSmartTagScreen } from '../smarttag/screens/SyncSmartTagScreen';
import { SmartTagReadyScreen } from '../smarttag/screens/SmartTagReadyScreen';
import { BaggageJourneyScreen } from '../smarttag/screens/BaggageJourneyScreen';
import { ReportBaggageIssueScreen } from '../smarttag/screens/ReportBaggageIssueScreen';

interface CathayTripsScreenProps {
  bookings: FlightBooking[];
  user: UserAuthProfile;
  onAddBooking: (booking: FlightBooking) => void;
  onOpenDevMenu?: () => void;
}

export const CathayTripsScreen: React.FC<CathayTripsScreenProps> = ({
  user,
  onAddBooking,
  onOpenDevMenu,
}) => {
  const { repo, nav } = useSmartTagStore();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add booking modal fields (Frames #82 & #83)
  const [familyName, setFamilyName] = useState(user.familyName || 'Trinh');
  const [givenName, setGivenName] = useState(user.givenName || 'Hai Dang');
  const [refType, setRefType] = useState<'bookingRef' | 'eticket'>('bookingRef');
  const [refValue, setRefValue] = useState(DEMO_BOOKING_REFERENCE);
  const [inputError, setInputError] = useState<string | null>(null);

  // Handle Android hardware back button within SmartTag sub-screens
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (nav.currentRoute !== 'bookings') {
        return smartTagController.goBack();
      }
      return false;
    });
    return () => sub.remove();
  }, [nav.currentRoute]);

  // Render active SmartTag sub-screen when navigated deeper inside My trips
  if (nav.currentRoute === 'prepare') {
    return <PrepareSmartTagScreen onOpenDevMenu={onOpenDevMenu} />;
  }
  if (nav.currentRoute === 'sync') {
    return <SyncSmartTagScreen onOpenDevMenu={onOpenDevMenu} />;
  }
  if (nav.currentRoute === 'result') {
    return <SmartTagReadyScreen onOpenDevMenu={onOpenDevMenu} />;
  }
  if (nav.currentRoute === 'journey') {
    return <BaggageJourneyScreen onOpenDevMenu={onOpenDevMenu} />;
  }
  if (nav.currentRoute === 'report') {
    return (
      <ReportBaggageIssueScreen
        defaultEmail={user.email}
        defaultPhone={user.mobile}
        onOpenDevMenu={onOpenDevMenu}
      />
    );
  }

  const handleConfirmAddBooking = () => {
    const res = smartTagRepository.lookupAndAddBookingByRef(refValue);
    if (res.errorMessage || !res.itinerary) {
      setInputError(
        res.errorMessage ?? 'Please enter a valid 6-character booking reference.'
      );
      return;
    }
    setInputError(null);
    onAddBooking(INITIAL_BOOKING);
    setShowAddModal(false);
  };

  const upcomingItineraries = repo.itineraries;
  const isEmpty = tab === 'past' || upcomingItineraries.length === 0;

  const renderItineraryCard = (itinerary: PassengerItinerary) => {
    const bags = repo.bagSetupsByItinerary[itinerary.id] ?? [];
    const primaryBag = bags[0];
    const entry = resolveBookingSmartTagEntry(itinerary, bags);

    return (
      <View key={itinerary.id} style={styles.screen01CardsWrap}>
        {/* 1. Hero Jade Ticket Card */}
        <JadeBookingTicketCard
          flightNumber={itinerary.flight.flightNumber}
          route={`${itinerary.flight.origin} → ${itinerary.flight.destination}`}
          dateStr="Tue, 11 Nov 2026"
          departureTime="10:35"
          terminal="T1"
          gate="36"
        />

        {/* 2. Cathay SmartTag Entry Card */}
        <SmartTagEntryCard
          onPress={() =>
            smartTagController.navigateTo('prepare', {
              itineraryId: itinerary.id,
              bagSetupId: primaryBag?.id,
            })
          }
        />

        {/* 3. Your baggage Preparation Card */}
        <YourBaggageCard
          bagCountStr={bags.length > 1 ? `${bags.length} checked bags` : '1 checked bag'}
          onPress={() =>
            smartTagController.navigateTo(entry.targetRoute, {
              itineraryId: itinerary.id,
              bagSetupId: primaryBag?.id,
            })
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderSoftWave />
      {/* Top Header (Matches references/01_my_bookings.png — NO BACK BUTTON) */}
      <View style={styles.topBarRow}>
        <Image source={CONCEPT_BRUSHWING} style={styles.headerBrushwing} resizeMode="contain" />
        <View style={styles.headerIconsRight}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color={CATHAY_TEXT_PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            onLongPress={onOpenDevMenu}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={CATHAY_TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerLargeTitle}>My trips</Text>
      </View>

      {/* 3-Column Underline Tabs: Upcoming | Past | Cancelled */}
      <View style={styles.tabsRow}>
        {(['upcoming', 'past', 'cancelled'] as const).map((tabKey) => {
          const isActive = tab === tabKey;
          const label =
            tabKey === 'upcoming' ? 'Upcoming' : tabKey === 'past' ? 'Past' : 'Cancelled';
          return (
            <TouchableOpacity
              key={tabKey}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setTab(tabKey)}
              activeOpacity={0.75}
              testID={`tab-bookings-${tabKey}`}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.scrollContent,
          isEmpty && styles.scrollContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* UPCOMING BOOKINGS WITH SMARTTAG ENTRY (Design 01) */}
        {tab === 'upcoming' && upcomingItineraries.length > 0 && (
          <View style={styles.bookingsList}>
            {upcomingItineraries.map(renderItineraryCard)}
          </View>
        )}

        {/* GENUINE EMPTY STATE (Preserved from Phase 1A Frame #80 + Demo Itinerary Loader) */}
        {isEmpty && (
          <View style={styles.emptyFullWrapper}>
            <View style={styles.emptyTopCenter}>
              <Ionicons
                name="airplane"
                size={38}
                color="#76777A"
                style={styles.emptyAirplaneIcon}
              />

              <Text style={styles.emptyStateTitle}>
                {tab === 'upcoming'
                  ? 'You have no upcoming bookings'
                  : 'You have no past bookings'}
              </Text>

              <Text style={styles.lastUpdatedText}>
                Last updated: 07 Nov, 09:26 (GMT +8)
              </Text>

              <Text style={styles.pullToRefreshText}>Pull to refresh</Text>
            </View>

            <View style={styles.emptyBottomSection}>
              <Text style={styles.cantFindHeading}>
                Can&apos;t find your booking?
              </Text>

              <TouchableOpacity
                style={styles.addBookingOutlineBtn}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
                testID="btn-add-booking"
              >
                <Text style={styles.addBookingOutlineBtnText}>Add booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ADD A BOOKING MODAL */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Add a booking</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalNoticeText}>
              Please enter your 6-character booking reference and passenger family name as shown on your e-ticket or itinerary.
            </Text>

            <View style={styles.whiteFormBlock}>
              <View style={styles.inputFieldWrap}>
                <Text style={styles.fieldFloatingLabel}>FAMILY NAME</Text>
                <TextInput
                  style={styles.cleanTextInput}
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholder="Trinh"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.blockHairline} />

              <View style={styles.inputFieldWrap}>
                <Text style={styles.fieldFloatingLabel}>
                  GIVEN/FIRST NAME AND MIDDLE NAMES
                </Text>
                <TextInput
                  style={styles.cleanTextInput}
                  value={givenName}
                  onChangeText={setGivenName}
                  placeholder="Hai Dang"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Radio Option 1: Booking reference */}
            <View style={[styles.whiteFormBlock, { marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => {
                  setRefType('bookingRef');
                  setRefValue(DEMO_BOOKING_REFERENCE);
                  setInputError(null);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.radioOuter,
                    refType === 'bookingRef' && styles.radioOuterActive,
                  ]}
                >
                  {refType === 'bookingRef' && (
                    <View style={styles.radioInnerDot} />
                  )}
                </View>
                <Text style={styles.radioLabelText}>Booking reference</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={CATHAY_JADE}
                />
              </TouchableOpacity>

              {refType === 'bookingRef' && (
                <>
                  <View style={styles.blockHairline} />
                  <View style={styles.inputFieldWrap}>
                    <TextInput
                      style={styles.cleanTextInput}
                      value={refValue}
                      onChangeText={(v) => {
                        setRefValue(v);
                        setInputError(null);
                      }}
                      placeholder={`Booking reference (e.g. ${DEMO_BOOKING_REFERENCE})`}
                      placeholderTextColor="#76777A"
                      autoCapitalize="characters"
                      testID="input-booking-ref"
                    />
                  </View>
                </>
              )}
            </View>

            {inputError && (
              <View style={styles.redValidationBanner}>
                <View style={styles.redExclamationBox}>
                  <Text style={styles.redExclamationMark}>!</Text>
                </View>
                <Text style={styles.redValidationText}>{inputError}</Text>
              </View>
            )}

            {/* Radio Option 2: e-ticket number */}
            <View style={[styles.whiteFormBlock, { marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => {
                  setRefType('eticket');
                  setRefValue('160-8801234560');
                  setInputError(null);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.radioOuter,
                    refType === 'eticket' && styles.radioOuterActive,
                  ]}
                >
                  {refType === 'eticket' && (
                    <View style={styles.radioInnerDot} />
                  )}
                </View>
                <Text style={styles.radioLabelText}>e-ticket number</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={CATHAY_JADE}
                />
              </TouchableOpacity>

              {refType === 'eticket' && (
                <>
                  <View style={styles.blockHairline} />
                  <View style={styles.inputFieldWrap}>
                    <Text style={styles.fieldFloatingLabel}>E-TICKET NUMBER</Text>
                    <TextInput
                      style={styles.cleanTextInput}
                      value={refValue}
                      onChangeText={setRefValue}
                      placeholder="160-8801234560"
                      placeholderTextColor="#76777A"
                      keyboardType="number-pad"
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.continueBtnContainer}>
              <TouchableOpacity
                style={[
                  styles.continueModalBtn,
                  refValue.trim().length >= 6 && styles.continueModalBtnActive,
                ]}
                onPress={handleConfirmAddBooking}
                activeOpacity={0.85}
                testID="btn-confirm-add-booking"
              >
                <Text
                  style={[
                    styles.continueModalBtnText,
                    refValue.trim().length >= 6 &&
                      styles.continueModalBtnTextActive,
                  ]}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CATHAY_BG,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: 'transparent',
  },
  headerBrushwing: {
    width: 34,
    height: 38,
  },
  headerIconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  headerTitleWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  headerLargeTitle: {
    fontSize: 28,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  header: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '500',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 36,
  },

  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabBtnActive: {
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#76777A',
  },
  tabLabelActive: {
    color: CATHAY_TEXT_PRIMARY,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: CATHAY_JADE,
    borderRadius: 1.5,
  },
  screen01CardsWrap: {
    marginBottom: 8,
  },

  contentScroll: {
    flex: 1,
    backgroundColor: CATHAY_BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 120,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  bookingsList: {
    gap: 16,
  },
  cardSectionDivider: {
    height: 1,
    backgroundColor: CATHAY_BORDER,
    marginTop: 14,
    marginBottom: 16,
  },
  smartTagHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  smartTagTextCol: {
    flex: 1,
  },
  smartTagHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  smartTagTitle: {
    fontSize: 16.5,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  smartTagDescription: {
    fontSize: 13.5,
    lineHeight: 19,
    color: CATHAY_TEXT_SECONDARY,
  },
  entryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  multiBagCountNote: {
    fontSize: 12.5,
    color: CATHAY_JADE,
    fontWeight: '600',
  },
  setupCtaBtn: {
    marginTop: 2,
  },
  reconfigureLink: {
    paddingTop: 10,
    alignItems: 'center',
  },
  reconfigureLinkText: {
    fontSize: 13,
    color: CATHAY_JADE,
    fontWeight: '500',
  },
  journeyLinkDivider: {
    height: 1,
    backgroundColor: CATHAY_BORDER,
    marginTop: 14,
  },

  /* Empty State */
  emptyFullWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 28,
  },
  emptyTopCenter: {
    alignItems: 'center',
  },
  emptyAirplaneIcon: {
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#2C3034',
    textAlign: 'center',
  },
  lastUpdatedText: {
    fontSize: 11.5,
    color: '#76777A',
    marginTop: 8,
  },
  pullToRefreshText: {
    fontSize: 14,
    color: '#52565A',
    marginTop: 24,
  },
  emptyBottomSection: {
    marginTop: 36,
  },
  cantFindHeading: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#2C3034',
    textAlign: 'center',
    marginBottom: 14,
  },
  addBookingOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CATHAY_JADE,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBookingOutlineBtnText: {
    color: CATHAY_JADE,
    fontSize: 15,
    fontWeight: '600',
  },
  demoPopulateBtn: {
    marginTop: 10,
    backgroundColor: '#E6F1EE',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demoPopulateBtnText: {
    color: CATHAY_JADE,
    fontSize: 13.5,
    fontWeight: '600',
  },
  creamTipBox: {
    backgroundColor: '#FAF5EA',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulbIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  creamTipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#2C3034',
  },

  /* Add Booking Modal */
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#F6F5F2',
  },
  modalHeader: {
    height: 54,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#1C2024',
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalNoticeText: {
    fontSize: 13.5,
    color: '#52565A',
    lineHeight: 19,
    marginBottom: 18,
  },
  whiteFormBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputFieldWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldFloatingLabel: {
    fontSize: 10.5,
    color: '#76777A',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  cleanTextInput: {
    fontSize: 15.5,
    color: '#1C2024',
    paddingVertical: 2,
  },
  blockHairline: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterActive: {
    borderColor: CATHAY_JADE,
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CATHAY_JADE,
  },
  radioLabelText: {
    flex: 1,
    fontSize: 15.5,
    color: '#1C2024',
  },
  redValidationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  redExclamationBox: {
    width: 18,
    height: 18,
    backgroundColor: '#C92A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  redExclamationMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  redValidationText: {
    flex: 1,
    color: '#C92A2A',
    fontSize: 12.5,
  },
  continueBtnContainer: {
    marginTop: 28,
    marginBottom: 40,
  },
  continueModalBtn: {
    backgroundColor: '#E0E2E5',
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
  },
  continueModalBtnActive: {
    backgroundColor: CATHAY_JADE,
  },
  continueModalBtnText: {
    color: '#8D9297',
    fontSize: 15.5,
    fontWeight: '600',
  },
  continueModalBtnTextActive: {
    color: '#FFFFFF',
  },
});
