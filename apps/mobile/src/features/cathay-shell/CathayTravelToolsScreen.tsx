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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CathayTravelToolsScreenProps {
  onOpenDevMenu?: () => void;
  onNavigateToTrips?: () => void;
}

export const CathayTravelToolsScreen: React.FC<CathayTravelToolsScreenProps> = ({
  onOpenDevMenu,
  onNavigateToTrips,
}) => {
  const [activeModal, setActiveModal] = useState<'flightStatus' | 'baggageCalc' | 'timetable' | null>(null);

  // Flight status search state
  const [flightStatusQuery, setFlightStatusQuery] = useState('CX304');
  const [flightStatusResult, setFlightStatusResult] = useState<boolean>(true);

  // Baggage calculator state
  const [cabinClass, setCabinClass] = useState<'Economy' | 'Premium' | 'Business'>('Economy');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerSpacer} />
        <Text style={styles.topHeaderTitle}>Travel tools</Text>
        <TouchableOpacity onPress={onOpenDevMenu} style={styles.navBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#1C2024" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: TRAVEL ESSENTIALS (Matching frames #101 - #102 in video) */}
        <View style={styles.toolSection}>
          <Text style={styles.sectionHeaderTitle}>Travel essentials</Text>

          <View style={styles.toolGrid}>
            <TouchableOpacity
              style={styles.toolGridItem}
              onPress={() => onNavigateToTrips?.()}
              activeOpacity={0.7}
            >
              <View style={styles.toolIconWrap}>
                <Ionicons name="airplane-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Boarding pass</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="information-circle-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Travel info</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolGridItem}
              onPress={() => setActiveModal('timetable')}
              activeOpacity={0.7}
            >
              <View style={styles.toolIconWrap}>
                <Ionicons name="calendar-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Timetable</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolGridItem}
              onPress={() => setActiveModal('flightStatus')}
              activeOpacity={0.7}
            >
              <View style={styles.toolIconWrap}>
                <Ionicons name="time-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Flight status</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="cash-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Rebook & refund</Text>
            </TouchableOpacity>

            {/* BAGGAGE CALCULATOR (Direct SmartTag integration!) */}
            <TouchableOpacity
              style={styles.toolGridItem}
              onPress={() => setActiveModal('baggageCalc')}
              activeOpacity={0.7}
            >
              <View style={[styles.toolIconWrap, styles.toolIconWrapHighlight]}>
                <Ionicons name="briefcase" size={24} color="#006564" />
              </View>
              <Text style={[styles.toolGridLabel, styles.boldLabel]}>Baggage calc</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="alert-circle-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Delays</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 2: PREPARE YOUR TRIP (Matching frame #101 in video) */}
        <View style={styles.toolSection}>
          <Text style={styles.sectionHeaderTitle}>Prepare your trip</Text>

          <View style={styles.toolGrid}>
            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="bed-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Book a hotel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="cube-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Book package</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Insurance</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="car-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Rent a car</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="ticket-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Activities</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="bag-handle-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Cathay Shop</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 3: FLYING WITH US (Matching frame #101 in video) */}
        <View style={styles.toolSection}>
          <Text style={styles.sectionHeaderTitle}>Flying with us</Text>

          <View style={styles.toolGrid}>
            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="file-tray-full-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Cabin classes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="tv-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Inflight exp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="wine-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Lounges</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="business-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Airport info</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="airplane" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Fleet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolGridItem} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name="accessibility-outline" size={24} color="#006564" />
              </View>
              <Text style={styles.toolGridLabel}>Assistance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* FLIGHT STATUS MODAL (Matching frame #106 in video) */}
      <Modal visible={activeModal === 'flightStatus'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.navBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Flight status</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              You can check the latest status for flights departing in the past four days, today, and the next six days.
            </Text>

            <View style={styles.statusInputGroup}>
              <Text style={styles.statusInputLabel}>Flight number</Text>
              <TextInput
                style={styles.statusTextInput}
                value={flightStatusQuery}
                onChangeText={setFlightStatusQuery}
                placeholder="e.g. CX304"
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity
              style={styles.checkStatusBtn}
              onPress={() => setFlightStatusResult(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.checkStatusBtnText}>Check status</Text>
            </TouchableOpacity>

            {flightStatusResult && (
              <View style={styles.flightResultBox}>
                <View style={styles.flightResultTop}>
                  <Text style={styles.flightResultNum}>CX304</Text>
                  <View style={styles.onTimePill}>
                    <Text style={styles.onTimeText}>On Time</Text>
                  </View>
                </View>

                <View style={styles.flightResultRoute}>
                  <View>
                    <Text style={styles.flightResultCity}>Hong Kong (HKG)</Text>
                    <Text style={styles.flightResultTime}>19:25 • Terminal 1, Gate 23</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color="#718096" style={{ marginHorizontal: 8 }} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.flightResultCity}>Nanjing (NKG)</Text>
                    <Text style={styles.flightResultTime}>21:50</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* BAGGAGE CALCULATOR & POLYAERO SMARTTAG MODAL */}
      <Modal visible={activeModal === 'baggageCalc'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.navBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Baggage allowance & SmartTag</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              Calculate your checked and carry-on baggage allowance for Cathay Pacific flights, and view your digital SmartTag status.
            </Text>

            {/* Cabin selector */}
            <View style={styles.cabinClassRow}>
              {(['Economy', 'Premium', 'Business'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.cabinChoicePill, cabinClass === c && styles.cabinChoicePillActive]}
                  onPress={() => setCabinClass(c)}
                >
                  <Text style={[styles.cabinChoicePillText, cabinClass === c && styles.cabinChoicePillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Allowance Summary Card */}
            <View style={styles.allowanceCard}>
              <View style={styles.allowanceRow}>
                <Ionicons name="bag-outline" size={24} color="#006564" />
                <View style={styles.allowanceTextCol}>
                  <Text style={styles.allowanceTitle}>Carry-on baggage</Text>
                  <Text style={styles.allowanceDetail}>
                    1 piece up to {cabinClass === 'Business' ? '14' : '7'} kg + 1 small personal item
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.allowanceRow}>
                <Ionicons name="briefcase-outline" size={24} color="#006564" />
                <View style={styles.allowanceTextCol}>
                  <Text style={styles.allowanceTitle}>Checked baggage</Text>
                  <Text style={styles.allowanceDetail}>
                    {cabinClass === 'Business' ? '2 pieces up to 32 kg each' : '2 pieces up to 23 kg each'}
                  </Text>
                </View>
              </View>
            </View>

            {/* PolyAero SmartTag Callout */}
            <View style={styles.smartTagCalloutCard}>
              <View style={styles.smartTagCalloutBadge}>
                <Ionicons name="pricetag" size={14} color="#006564" />
                <Text style={styles.smartTagCalloutBadgeText}>POLYAERO DIGITAL BAGGAGE IDENTITY</Text>
              </View>

              <Text style={styles.smartTagCalloutTitle}>Electronic E-ink SmartTag</Text>
              <Text style={styles.smartTagCalloutBody}>
                Your registered PolyAero SmartTag automatically receives baggage routing and barcode updates via NFC at online check-in.
              </Text>

              <TouchableOpacity
                style={styles.manageSmartTagBtn}
                onPress={() => {
                  setActiveModal(null);
                  onNavigateToTrips?.();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.manageSmartTagBtnText}>View SmartTag in My trips →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* TIMETABLE MODAL */}
      <Modal visible={activeModal === 'timetable'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.navBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Flight timetable</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              View current and upcoming scheduled flights with seats available to book.
            </Text>
            <View style={styles.timetableCard}>
              <Text style={styles.timetableRoute}>Hong Kong (HKG) ➔ Nanjing (NKG)</Text>
              <Text style={styles.timetableDetail}>Daily • CX304 (19:25 - 21:50) • Airbus A330-300</Text>
            </View>
          </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderTitle: {
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
  mainScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  toolSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  toolGridItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  toolIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  toolIconWrapHighlight: {
    backgroundColor: '#E6F4F2',
  },
  toolGridLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
  boldLabel: {
    fontWeight: '700',
    color: '#006564',
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
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  modalBody: {
    flex: 1,
    padding: 24,
  },
  modalExplainer: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#64748B',
    marginBottom: 20,
  },
  statusInputGroup: {
    marginBottom: 16,
  },
  statusInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  statusTextInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  checkStatusBtn: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  checkStatusBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  flightResultBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flightResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  flightResultNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
  },
  onTimePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  onTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  flightResultRoute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flightResultCity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
  },
  flightResultTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cabinClassRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  cabinChoicePill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  cabinChoicePillActive: {
    borderColor: '#006564',
    backgroundColor: '#E6F4F2',
  },
  cabinChoicePillText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  cabinChoicePillTextActive: {
    color: '#006564',
    fontWeight: '700',
  },
  allowanceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  allowanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  allowanceTextCol: {
    flex: 1,
  },
  allowanceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C2024',
  },
  allowanceDetail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  smartTagCalloutCard: {
    backgroundColor: '#E6F4F2',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#A7D9D3',
  },
  smartTagCalloutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  smartTagCalloutBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006564',
    letterSpacing: 0.5,
  },
  smartTagCalloutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 6,
  },
  smartTagCalloutBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    marginBottom: 16,
  },
  manageSmartTagBtn: {
    backgroundColor: '#006564',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  manageSmartTagBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  timetableCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  timetableRoute: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 4,
  },
  timetableDetail: {
    fontSize: 13,
    color: '#64748B',
  },
});
