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

  // Add booking modal fields
  const [familyName, setFamilyName] = useState(user.familyName || 'Trinh');
  const [givenName, setGivenName] = useState(user.givenName || 'Hai Dang');
  const [refType, setRefType] = useState<'bookingRef' | 'eticket'>('bookingRef');
  const [refValue, setRefValue] = useState('7Y9K2M');
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
      // Mock fallback
      setScanResult({
        tagUid: '04:A1:B2:C3:D4:E5:F6',
        isMockSimulation: true,
        payload: {
          tagUid: '04:A1:B2:C3:D4:E5:F6',
          baggageTagNumber: 'CX882910',
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
    if (refValue.trim().length < 6) {
      setInputError('Please enter at least 6 digits or characters.');
      return;
    }
    setInputError(null);
    onAddBooking(INITIAL_BOOKING);
    setShowAddModal(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>My bookings</Text>
        <TouchableOpacity onPress={onOpenDevMenu} style={styles.navBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#1C2024" />
        </TouchableOpacity>
      </View>

      {/* Segmented Tabs: Upcoming vs Past */}
      <View style={styles.segmentedRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'upcoming' && styles.segmentBtnActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.segmentLabel, tab === 'upcoming' && styles.segmentLabelActive]}>Upcoming</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'past' && styles.segmentBtnActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.segmentLabel, tab === 'past' && styles.segmentLabelActive]}>Past</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollContent}>
        {/* UPCOMING WITH ACTIVE BOOKING & POLYAERO SMARTTAG */}
        {tab === 'upcoming' && bookings.length > 0 && (
          <View style={styles.bookingsList}>
            {bookings.map((b) => (
              <View key={b.id} style={styles.activeBookingCard}>
                {/* Flight Status Header */}
                <View style={styles.bookingStatusBanner}>
                  <View style={styles.flightTagRow}>
                    <Text style={styles.flightNumText}>{b.flightNumber}</Text>
                    <View style={styles.confirmedPill}>
                      <Text style={styles.confirmedText}>{b.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.flightDateText}>{b.departureDate}</Text>
                </View>

                {/* Route Information */}
                <View style={styles.bookingRouteRow}>
                  <View style={styles.routeCityCol}>
                    <Text style={styles.routeCodeLarge}>{b.origin}</Text>
                    <Text style={styles.routeCityName}>{b.originCity}</Text>
                    <Text style={styles.routeTimeLarge}>{b.departureTime}</Text>
                  </View>

                  <View style={styles.routePlaneCol}>
                    <Text style={styles.routeDurationText}>{b.duration}</Text>
                    <View style={styles.routeLineBar} />
                    <Ionicons name="airplane" size={16} color="#006564" />
                  </View>

                  <View style={styles.routeCityColRight}>
                    <Text style={styles.routeCodeLarge}>{b.destination}</Text>
                    <Text style={styles.routeCityName}>{b.destinationCity}</Text>
                    <Text style={styles.routeTimeLarge}>{b.arrivalTime}</Text>
                  </View>
                </View>

                {/* Gate, Terminal, Seat Badges */}
                <View style={styles.tripMetaBadgesRow}>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeLabel}>Terminal</Text>
                    <Text style={styles.metaBadgeValue}>{b.terminal}</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeLabel}>Gate</Text>
                    <Text style={styles.metaBadgeValue}>{b.gate}</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeLabel}>Seat</Text>
                    <Text style={styles.metaBadgeValue}>{b.seat}</Text>
                  </View>
                </View>

                {/* POLYAERO SMARTTAG DIGITAL BAGGAGE INTEGRATION */}
                {b.smartTag && b.baggage && (
                  <View style={styles.smartTagContainer}>
                    <View style={styles.smartTagHeaderRow}>
                      <View style={styles.taglineBadge}>
                        <Ionicons name="pricetag" size={12} color="#006564" />
                        <Text style={styles.taglineText}>POLYAERO DIGITAL SMARTTAG</Text>
                      </View>
                      <Text style={styles.bagWeightText}>{b.baggage.weightKg} kg</Text>
                    </View>

                    {/* SmartTag E-ink Component */}
                    <SmartTagCard tag={b.smartTag} baggage={b.baggage} />

                    {/* NFC Tap Hardware Simulation */}
                    <View style={styles.nfcInteractiveBox}>
                      <Text style={styles.nfcHeading}>NFC Tag Hardware Sync</Text>
                      <Text style={styles.nfcSub}>
                        Tap your iPhone to the PolyAero E-ink SmartTag to update flight routing & passenger details.
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
                            <Ionicons name="radio" size={18} color="#FFFFFF" />
                            <Text style={styles.nfcButtonText}>Simulate NFC Tag Tap</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {scanResult && (
                        <View style={styles.scanSuccessBox}>
                          <View style={styles.scanSuccessTitleRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <Text style={styles.scanSuccessTitle}>Tag Synced Successfully</Text>
                          </View>
                          <Text style={styles.scanSuccessRow}>UID: <Text style={styles.boldMono}>{scanResult.tagUid}</Text></Text>
                          <Text style={styles.scanSuccessRow}>Bag Tag: <Text style={styles.boldMono}>{scanResult.payload?.baggageTagNumber}</Text></Text>
                          <Text style={styles.scanSuccessRow}>E-ink Display: <Text style={styles.boldMono}>Updated to CX304 NKG</Text></Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* EMPTY STATE (Matching frames #80 - #81 in video) */}
        {(tab === 'past' || bookings.length === 0) && (
          <View style={styles.emptyStateContainer}>
            <View style={styles.airplaneCircle}>
              <Ionicons name="airplane-outline" size={44} color="#718096" />
            </View>

            <Text style={styles.emptyStateTitle}>
              {tab === 'upcoming' ? 'You have no upcoming bookings' : 'You have no past bookings'}
            </Text>

            <Text style={styles.refreshSubText}>Pull to refresh</Text>

            <TouchableOpacity
              style={styles.addBookingButton}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.addBookingButtonText}>Add booking</Text>
            </TouchableOpacity>

            <Text style={styles.bottomInstructionText}>
              Tap 'Add booking' and enter your reference or e-ticket number to add it to your bookings.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ADD A BOOKING MODAL (Matching frames #82 - #83 in video) */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Add a booking</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalNoticeText}>
              Please note: Under certain circumstances, the system may need more time to link your booking to your member account.
            </Text>

            {inputError && (
              <View style={styles.errorAlertBox}>
                <Ionicons name="warning" size={16} color="#DC2626" />
                <Text style={styles.errorAlertText}>{inputError}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>FAMILY NAME</Text>
              <TextInput style={styles.modalInput} value={familyName} onChangeText={setFamilyName} placeholder="Trinh" />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>GIVEN/FIRST NAME AND MIDDLE NAMES</Text>
              <TextInput style={styles.modalInput} value={givenName} onChangeText={setGivenName} placeholder="Hai Dang" />
            </View>

            {/* Radio Selectors */}
            <TouchableOpacity
              style={styles.radioOptionRow}
              onPress={() => setRefType('bookingRef')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={refType === 'bookingRef' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color="#006564"
              />
              <Text style={styles.radioOptionLabel}>Booking reference</Text>
              <Ionicons name="information-circle-outline" size={16} color="#718096" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOptionRow}
              onPress={() => setRefType('eticket')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={refType === 'eticket' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color="#006564"
              />
              <Text style={styles.radioOptionLabel}>e-ticket number</Text>
              <Ionicons name="information-circle-outline" size={16} color="#718096" />
            </TouchableOpacity>

            <View style={styles.formGroup}>
              <TextInput
                style={styles.modalInput}
                value={refValue}
                onChangeText={setRefValue}
                placeholder={refType === 'bookingRef' ? 'e.g. 7Y9K2M' : 'e.g. 160-8291048291'}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.confirmAddBtn} onPress={handleConfirmAddBooking} activeOpacity={0.85}>
              <Text style={styles.confirmAddBtnText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C2024',
  },
  navBtn: {
    padding: 6,
  },
  headerSpacer: {
    width: 36,
  },
  segmentedRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentBtnActive: {
    borderBottomColor: '#006564',
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  segmentLabelActive: {
    color: '#006564',
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bookingsList: {
    gap: 16,
  },
  activeBookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  bookingStatusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  flightTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flightNumText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
  },
  confirmedPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  confirmedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  flightDateText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  bookingRouteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  routeCityCol: {
    alignItems: 'flex-start',
  },
  routeCityColRight: {
    alignItems: 'flex-end',
  },
  routeCodeLarge: {
    fontSize: 26,
    fontWeight: '700',
    color: '#006564',
  },
  routeCityName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  routeTimeLarge: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 4,
  },
  routePlaneCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  routeDurationText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  routeLineBar: {
    width: '100%',
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 4,
  },
  tripMetaBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    marginBottom: 18,
  },
  metaBadge: {
    alignItems: 'center',
  },
  metaBadgeLabel: {
    fontSize: 11,
    color: '#718096',
  },
  metaBadgeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 2,
  },
  smartTagContainer: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  smartTagHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taglineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  taglineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006564',
    letterSpacing: 0.5,
  },
  bagWeightText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  nfcInteractiveBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nfcHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C2024',
  },
  nfcSub: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    marginVertical: 6,
  },
  nfcButton: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
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
    fontSize: 14,
    fontWeight: '600',
  },
  scanSuccessBox: {
    marginTop: 12,
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  scanSuccessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  scanSuccessTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  scanSuccessRow: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  boldMono: {
    fontWeight: '700',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  airplaneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C2024',
    textAlign: 'center',
    marginBottom: 6,
  },
  refreshSubText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 28,
  },
  addBookingButton: {
    borderWidth: 1,
    borderColor: '#006564',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
  },
  addBookingButtonText: {
    color: '#006564',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomInstructionText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  modalNoticeText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#64748B',
    marginBottom: 20,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorAlertText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  formGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  radioOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  radioOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C2024',
    flex: 1,
  },
  confirmAddBtn: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  confirmAddBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
