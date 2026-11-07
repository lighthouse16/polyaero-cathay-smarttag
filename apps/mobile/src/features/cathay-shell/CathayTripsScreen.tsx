import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlightBooking, UserAuthProfile, INITIAL_BOOKING } from './CathayTypes';
import { SmartTagCard } from '../smarttag/SmartTagCard';
import { nfcService } from '../../services/nfc';
import { SmartTagScanResult } from '@polyaero/shared';

interface CathayTripsScreenProps {
  bookings: FlightBooking[];
  user: UserAuthProfile;
  onAddBooking: (booking: FlightBooking) => void;
  onOpenDevMenu?: () => void;
}

export const CathayTripsScreen: React.FC<CathayTripsScreenProps> = ({
  bookings,
  user,
  onAddBooking,
  onOpenDevMenu,
}) => {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add booking modal fields (Frames #82 & #83)
  const [familyName, setFamilyName] = useState(user.familyName || 'Trinh');
  const [givenName, setGivenName] = useState(user.givenName || 'Hai Dang');
  const [refType, setRefType] = useState<'bookingRef' | 'eticket'>('bookingRef');
  const [refValue, setRefValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // NFC Simulation inside SmartTag section
  const [isScanningNfc, setIsScanningNfc] = useState(false);
  const [scanResult, setScanResult] = useState<SmartTagScanResult | null>(null);

  const handleSimulateNfc = async () => {
    setIsScanningNfc(true);
    try {
      const result = await nfcService.readTagUid();
      setScanResult(result);
    } catch {
      setScanResult({
        tagUid: '04:A1:B2:C3:D4:E5:F6',
        isMockSimulation: true,
        payload: {
          tagUid: '04:A1:B2:C3:D4:E5:F6',
          baggageTagNumber: '0160892012',
          flightNumber: 'CX304',
          originAirport: 'HKG',
          destinationAirport: 'NKG',
          passengerInitials: 'HT',
          departureDate: '2026-11-08',
          barcodeSymbology: 'INTERLEAVED_2_OF_5',
        },
      });
    } finally {
      setIsScanningNfc(false);
    }
  };

  const handleConfirmAddBooking = () => {
    if (refValue.trim().length > 0 && refValue.trim().length < 6) {
      setInputError('Please enter at least 6 digits');
      return;
    }
    setInputError(null);
    onAddBooking(INITIAL_BOOKING);
    setShowAddModal(false);
  };

  const isEmpty = tab === 'past' || bookings.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header (Exact Frame #80: Centered "My bookings", no extra icons) */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.9} onLongPress={onOpenDevMenu}>
          <Text style={styles.headerTitle}>My bookings</Text>
        </TouchableOpacity>
      </View>

      {/* 2-Column Underline Tabs: Upcoming | Past (Frame #80) */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setTab('upcoming')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabLabel, tab === 'upcoming' && styles.tabLabelActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'past' && styles.tabBtnActive]}
          onPress={() => setTab('past')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabLabel, tab === 'past' && styles.tabLabelActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.scrollContent,
          isEmpty && styles.scrollContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ACTIVE BOOKING & POLYAERO SMARTTAG */}
        {tab === 'upcoming' && bookings.length > 0 && (
          <View style={styles.bookingsList}>
            {bookings.map((b) => (
              <View key={b.id} style={styles.activeBookingCard}>
                {/* Cathay Jade-Teal Header with Diagonal Sheen */}
                <View style={styles.bookingGreenHeader}>
                  <View style={styles.bookingDiagonalSheen} />
                  <View style={styles.flightTagRow}>
                    <View>
                      <Text style={styles.flightDateLight}>{b.departureDate}</Text>
                      <Text style={styles.flightNumText}>{b.flightNumber} • {b.cabin}</Text>
                    </View>
                    <View style={styles.confirmedPill}>
                      <Text style={styles.confirmedText}>{b.status}</Text>
                    </View>
                  </View>
                </View>

                {/* White Overlapping Route & SmartTag Body */}
                <View style={styles.bookingWhiteBody}>
                  <View style={styles.bookingRouteRow}>
                    <View style={styles.routeCityCol}>
                      <Text style={styles.routeTimeTeal}>{b.departureTime}</Text>
                      <Text style={styles.routeCodeLarge}>{b.origin}</Text>
                      <Text style={styles.routeCityName}>{b.originCity}</Text>
                    </View>

                    <View style={styles.routePlaneCol}>
                      <Text style={styles.routeDurationText}>{b.duration}</Text>
                      <View style={styles.routeLineRow}>
                        <Ionicons name="airplane" size={14} color="#1C2024" />
                        <View style={styles.routeLineBar} />
                        <View style={styles.routeEndDot} />
                      </View>
                      <Text style={styles.nonStopSmall}>Direct</Text>
                    </View>

                    <View style={styles.routeCityColRight}>
                      <Text style={styles.routeTimeTeal}>{b.arrivalTime}</Text>
                      <Text style={styles.routeCodeLarge}>{b.destination}</Text>
                      <Text style={styles.routeCityName}>{b.destinationCity}</Text>
                    </View>
                  </View>

                  <View style={styles.tripMetaBadgesRow}>
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeLabel}>BOOKING REF</Text>
                      <Text style={styles.metaBadgeValue}>{b.pnr}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeLabel}>TERMINAL / GATE</Text>
                      <Text style={styles.metaBadgeValue}>{b.terminal} • {b.gate}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeLabel}>SEAT</Text>
                      <Text style={styles.metaBadgeValue}>{b.seat}</Text>
                    </View>
                  </View>

                  {/* POLYAERO SMARTTAG DIGITAL BAGGAGE INTEGRATION */}
                  {b.smartTag && b.baggage && (
                    <View style={styles.smartTagSection}>
                      <SmartTagCard tag={b.smartTag} baggage={b.baggage} />

                      {/* NFC Tap Hardware Simulation */}
                      <View style={styles.nfcInteractiveBox}>
                        <Text style={styles.nfcHeading}>NFC E-Ink Tag Synchronization</Text>
                        <Text style={styles.nfcSub}>
                          Tap your phone against the passive PolyAero SmartTag to write IATA barcode and flight routing to the E-ink display.
                        </Text>

                        <TouchableOpacity
                          style={[styles.nfcButton, isScanningNfc && styles.nfcButtonDisabled]}
                          onPress={handleSimulateNfc}
                          disabled={isScanningNfc}
                          activeOpacity={0.85}
                        >
                          {isScanningNfc ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <View style={styles.nfcBtnInner}>
                              <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
                              <Text style={styles.nfcButtonText}>Simulate NFC Tag Tap</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {scanResult && (
                          <View style={styles.scanSuccessBox}>
                            <View style={styles.scanSuccessTitleRow}>
                              <Ionicons name="checkmark-circle" size={16} color="#2E6B69" />
                              <Text style={styles.scanSuccessTitle}>E-Ink Display Synchronized</Text>
                            </View>
                            <Text style={styles.scanSuccessRow}>
                              UID: <Text style={styles.boldMono}>{scanResult.tagUid}</Text>
                            </Text>
                            <Text style={styles.scanSuccessRow}>
                              Bag Tag: <Text style={styles.boldMono}>{scanResult.payload?.baggageTagNumber}</Text>
                            </Text>
                            <Text style={styles.scanSuccessRow}>
                              Routing: <Text style={styles.boldMono}>{b.flightNumber} {b.origin} ➔ {b.destination}</Text>
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* Bottom Add Another Booking Section */}
            <View style={styles.bottomFindSection}>
              <Text style={styles.cantFindHeading}>Can't find your booking?</Text>
              <TouchableOpacity
                style={styles.addBookingOutlineBtn}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addBookingOutlineBtnText}>Add booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* AUTHENTIC EMPTY STATE (Exact Video Frame #80 & #85) */}
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
              <Text style={styles.cantFindHeading}>Can't find your booking?</Text>

              <TouchableOpacity
                style={styles.addBookingOutlineBtn}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
                testID="btn-add-booking"
              >
                <Text style={styles.addBookingOutlineBtnText}>Add booking</Text>
              </TouchableOpacity>

              <View style={styles.creamTipBox}>
                <Ionicons
                  name="bulb-outline"
                  size={18}
                  color="#4B5563"
                  style={styles.bulbIcon}
                />
                <Text style={styles.creamTipText}>
                  Tap ‘Add booking’ and enter your reference or e-ticket number to add it to your bookings.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ADD A BOOKING MODAL (Exact Video Frames #82 & #83) */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Add a booking</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalNoticeText}>
              Please note: Under certain circumstances, the system may need more time to link your booking to your member account.
            </Text>

            {/* White Grouped Input Box: Family Name & Given Name */}
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
                <Text style={styles.fieldFloatingLabel}>GIVEN/FIRST NAME AND MIDDLE NAMES</Text>
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
                  setInputError(null);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.radioOuter, refType === 'bookingRef' && styles.radioOuterActive]}>
                  {refType === 'bookingRef' && <View style={styles.radioInnerDot} />}
                </View>
                <Text style={styles.radioLabelText}>Booking reference</Text>
                <Ionicons name="information-circle-outline" size={20} color="#195A58" />
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
                      placeholder="Booking reference (e.g. 7Y9K2M)"
                      placeholderTextColor="#76777A"
                      autoCapitalize="characters"
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
                  setRefValue('160 8291048291');
                  setInputError(null);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.radioOuter, refType === 'eticket' && styles.radioOuterActive]}>
                  {refType === 'eticket' && <View style={styles.radioInnerDot} />}
                </View>
                <Text style={styles.radioLabelText}>e-ticket number</Text>
                <Ionicons name="information-circle-outline" size={20} color="#195A58" />
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
                      placeholder="160 8291048291"
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
                    refValue.trim().length >= 6 && styles.continueModalBtnTextActive,
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

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#1C2024',
  },
  headerSpacer: {
    width: 36,
  },

  /* 2-Column Underline Tabs (Frame #80) */
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#195A58',
  },
  tabLabel: {
    fontSize: 15.5,
    fontWeight: '400',
    color: '#4B5563',
  },
  tabLabelActive: {
    color: '#195A58',
    fontWeight: '600',
  },

  contentScroll: {
    flex: 1,
    backgroundColor: '#F7F7F6',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  /* Empty State (Frame #80) */
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
    marginTop: 48,
  },
  cantFindHeading: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#2C3034',
    textAlign: 'center',
    marginBottom: 16,
  },
  addBookingOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E6E6D',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBookingOutlineBtnText: {
    color: '#2E6E6D',
    fontSize: 15,
    fontWeight: '500',
  },
  creamTipBox: {
    backgroundColor: '#FAF5EA',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulbIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  creamTipText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#2C3034',
  },

  /* Active Booking Card */
  bookingsList: {
    gap: 20,
  },
  activeBookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    ...cardShadow,
  },
  bookingGreenHeader: {
    backgroundColor: '#2B6E6D',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  bookingDiagonalSheen: {
    position: 'absolute',
    right: -30,
    bottom: -40,
    width: 220,
    height: 140,
    backgroundColor: '#135958',
    borderTopLeftRadius: 140,
    transform: [{ rotate: '-8deg' }],
  },
  flightTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  flightDateLight: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  flightNumText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmedPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookingWhiteBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: -12,
    padding: 20,
    zIndex: 3,
  },
  bookingRouteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  routeCityCol: {
    flex: 1,
  },
  routeCityColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  routeTimeTeal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#195A58',
    marginBottom: 2,
  },
  routeCodeLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C2024',
  },
  routeCityName: {
    fontSize: 12.5,
    color: '#52565A',
    marginTop: 2,
  },
  routePlaneCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  routeDurationText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  routeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  routeLineBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#D1D5DB',
  },
  routeEndDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  nonStopSmall: {
    fontSize: 11,
    color: '#2E6B69',
    marginTop: 4,
    fontWeight: '500',
  },
  tripMetaBadgesRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F6F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  metaBadge: {
    flex: 1,
  },
  metaBadgeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#76777A',
    marginBottom: 3,
  },
  metaBadgeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C2024',
  },
  smartTagSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 12,
  },
  nfcInteractiveBox: {
    backgroundColor: '#F4EFE4',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  nfcHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1C2024',
  },
  nfcSub: {
    fontSize: 12.5,
    color: '#2C3034',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 14,
  },
  nfcButton: {
    backgroundColor: '#233D3B',
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  nfcButtonDisabled: {
    opacity: 0.6,
  },
  nfcBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nfcButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '500',
  },
  scanSuccessBox: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D7E6E5',
  },
  scanSuccessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  scanSuccessTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#195A58',
  },
  scanSuccessRow: {
    fontSize: 12,
    color: '#2C3034',
    marginTop: 2,
  },
  boldMono: {
    fontWeight: '700',
    color: '#1C2024',
  },
  bottomFindSection: {
    marginTop: 12,
  },

  /* Add a Booking Modal (Frames #82 & #83) */
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#F5F6F7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: '#F5F6F7',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#1C2024',
  },
  modalScroll: {
    flex: 1,
  },
  modalNoticeText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#1C2024',
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  whiteFormBlock: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  inputFieldWrap: {
    paddingVertical: 14,
  },
  fieldFloatingLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#52565A',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  cleanTextInput: {
    fontSize: 16,
    color: '#1C2024',
    paddingVertical: 2,
  },
  blockHairline: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C4C6CA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterActive: {
    borderColor: '#195A58',
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#195A58',
  },
  radioLabelText: {
    flex: 1,
    fontSize: 16,
    color: '#52565A',
  },
  redValidationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9ECEC',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  redExclamationBox: {
    backgroundColor: '#B91C1C',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  redExclamationMark: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  redValidationText: {
    fontSize: 12.5,
    color: '#991B1B',
  },
  continueBtnContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  continueModalBtn: {
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
  },
  continueModalBtnActive: {
    backgroundColor: '#233D3B',
  },
  continueModalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  continueModalBtnTextActive: {
    color: '#FFFFFF',
  },
});
