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
  onClose?: () => void;
  onOpenDevMenu?: () => void;
  onNavigateToTrips?: () => void;
}

type ModalType =
  | 'flightStatus'
  | 'baggageCalc'
  | 'timetable'
  | 'delays'
  | 'rebook'
  | 'info'
  | null;

export const CathayTravelToolsScreen: React.FC<CathayTravelToolsScreenProps> = ({
  onClose,
  onOpenDevMenu,
  onNavigateToTrips,
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalContent, setModalContent] = useState<string>('');

  // Flight status search state
  const [flightStatusQuery, setFlightStatusQuery] = useState('CX304');
  const [flightStatusResult, setFlightStatusResult] = useState<boolean>(true);

  // Baggage calculator state
  const [cabinClass, setCabinClass] = useState<'Economy' | 'Premium Economy' | 'Business'>('Economy');

  const openInfoModal = (title: string, content: string) => {
    setModalTitle(title);
    setModalContent(content);
    setActiveModal('info');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Authentic Fullscreen Header with Close Button (Video Frame #102 & #138) */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerBtn}
          activeOpacity={0.7}
          testID="btn-close-tools"
        >
          <Ionicons name="close" size={26} color="#1C2024" />
        </TouchableOpacity>

        <View style={styles.headerSpacer} />

        <TouchableOpacity
          onPress={onOpenDevMenu}
          style={styles.headerBtn}
          activeOpacity={0.7}
          testID="btn-tools-dev"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#1C2024" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: TRAVEL ESSENTIALS (Authentic Video Frames #101, #102) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Travel essentials</Text>

          <View style={styles.grid}>
            {/* 1. Boarding pass */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => onNavigateToTrips?.()}
              activeOpacity={0.7}
            >
              <Ionicons name="card-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Boarding pass</Text>
            </TouchableOpacity>

            {/* 2. Travel information */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Travel information',
                  'Find essential travel advice, visa requirements, terminal guides, and customs regulations for your destination.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Travel information</Text>
            </TouchableOpacity>

            {/* 3. Flight timetable */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('timetable')}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Flight timetable</Text>
            </TouchableOpacity>

            {/* 4. Flight status */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('flightStatus')}
              activeOpacity={0.7}
            >
              <Ionicons name="airplane-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Flight status</Text>
            </TouchableOpacity>

            {/* 5. Rebook and refund */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('rebook')}
              activeOpacity={0.7}
            >
              <Ionicons name="sync-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Rebook and refund</Text>
            </TouchableOpacity>

            {/* 6. Baggage calculator (PolyAero SmartTag Digital Baggage Hub) */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('baggageCalc')}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Baggage calculator</Text>
            </TouchableOpacity>

            {/* 7. Delays and cancellations */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('delays')}
              activeOpacity={0.7}
            >
              <Ionicons name="alert-circle-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Delays and cancellations</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 2: PREPARE YOUR TRIP (Authentic Video Frames #101, #102, #138) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Prepare your trip</Text>

          <View style={styles.grid}>
            {/* 1. Book a hotel */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Book a hotel',
                  'Earn up to 3x Asia Miles when booking premium hotels worldwide with our partner Expedia.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="bed-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Book a hotel</Text>
            </TouchableOpacity>

            {/* 2. Book a package */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Book a package',
                  'Save with bundled flight and hotel packages with Cathay Holidays. Earn extra bonus miles.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="cube-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Book a package</Text>
            </TouchableOpacity>

            {/* 3. Travel insurance */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Travel insurance',
                  'Cathay Rewards Travel Cover: up to HKD 2,000,000 medical expenses and unlimited miles protection.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="umbrella-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Travel insurance</Text>
            </TouchableOpacity>

            {/* 4. Rent a car */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Rent a car',
                  'Hertz and Avis car rental with flexible pick-up, free cancellation, and Asia Miles earning.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="car-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Rent a car</Text>
            </TouchableOpacity>

            {/* 5. Book activities */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Book activities',
                  'Curated tours, theme park tickets, and exclusive local experiences powered by Cathay Holidays.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="compass-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Book activities</Text>
            </TouchableOpacity>

            {/* 6. Shop curated picks */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Shop curated picks',
                  'Cathay Shop: travel essentials, electronics, inflight merchandise, and free delivery in HK.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="bag-handle-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Shop curated picks</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 3: FLYING WITH US (Authentic Video Frames #101, #138) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Flying with us</Text>

          <View style={styles.grid}>
            {/* 1. Cabin classes */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Cabin classes',
                  'Discover Economy, Premium Economy, Business (Aria Suite), and First Class luxury.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Cabin classes</Text>
            </TouchableOpacity>

            {/* 2. Inflight experience */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Inflight experience',
                  'Award-winning inflight entertainment, curated wine cellar, dining menus, and inflight Wi-Fi.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="tv-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Inflight experience</Text>
            </TouchableOpacity>

            {/* 3. Lounges */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Lounges',
                  'Experience world-class hospitality at The Wing, The Pier, The Deck, and partner lounges worldwide.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="wine-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Lounges</Text>
            </TouchableOpacity>

            {/* 4. Airport information */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Airport information',
                  'Hong Kong International Airport (HKG) terminal map, check-in desks, security, and baggage reclaim.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="business-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Airport information</Text>
            </TouchableOpacity>

            {/* 5. Aircraft and fleet */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Aircraft and fleet',
                  'Our modern fleet: Airbus A350-900/1000, A321neo, and Boeing 777-300ER with advanced fuel efficiency.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="airplane-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Aircraft and fleet</Text>
            </TouchableOpacity>

            {/* 6. Passenger assistance */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Passenger assistance',
                  'Special medical needs, dietary meals, wheelchair assistance, and unaccompanied minor services.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="accessibility-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Passenger assistance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 4: TRAVEL INSPIRATION (Authentic Video Frame #138, #146) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Travel inspiration</Text>

          <View style={styles.grid}>
            {/* 1. Where we fly */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Where we fly',
                  'Explore over 200 destinations across Asia, Europe, North America, Australia, and Africa.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Where we fly</Text>
            </TouchableOpacity>

            {/* 2. Inspiration */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Inspiration',
                  'Insider travel stories, food and culture guides, and curated itineraries from local experts.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Inspiration</Text>
            </TouchableOpacity>

            {/* 3. Discover the best fares */}
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Discover the best fares',
                  'Browse real-time lowest fare calendar, seasonal promotional seats, and member bonus offers.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag-outline" size={28} color="#1C2024" style={styles.gridIcon} />
              <Text style={styles.gridLabel}>Discover the best fares</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* MODAL 1: FLIGHT STATUS (Authentic Cathay Video Frame #106) */}
      <Modal
        visible={activeModal === 'flightStatus'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Flight status</Text>
            <View style={styles.modalHeaderSpacer} />
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
              style={styles.cathayPrimaryBtn}
              onPress={() => setFlightStatusResult(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.cathayPrimaryBtnText}>Check status</Text>
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

      {/* MODAL 2: BAGGAGE CALCULATOR & POLYAERO SMARTTAG */}
      <Modal
        visible={activeModal === 'baggageCalc'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Baggage allowance & SmartTag</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalExplainer}>
              Calculate checked and carry-on baggage allowance for your Cathay Pacific flights, and inspect paired PolyAero SmartTag status.
            </Text>

            {/* Cabin Class Selection */}
            <View style={styles.cabinClassRow}>
              {(['Economy', 'Premium Economy', 'Business'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.cabinChoicePill, cabinClass === c && styles.cabinChoicePillActive]}
                  onPress={() => setCabinClass(c)}
                >
                  <Text style={[styles.cabinChoicePillText, cabinClass === c && styles.cabinChoicePillTextActive]}>
                    {c}
                  </Text>
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
                    {cabinClass === 'Business'
                      ? '2 pieces up to 32 kg each (64 kg total)'
                      : cabinClass === 'Premium Economy'
                      ? '2 pieces up to 23 kg each (46 kg total)'
                      : '2 pieces up to 23 kg each (46 kg total)'}
                  </Text>
                </View>
              </View>
            </View>

            {/* PolyAero SmartTag Digital Baggage Hub */}
            <View style={styles.smartTagContainer}>
              <View style={styles.smartTagHeaderBadge}>
                <Ionicons name="pricetag" size={14} color="#006564" />
                <Text style={styles.smartTagBadgeText}>POLYAERO DIGITAL BAGGAGE IDENTITY</Text>
              </View>

              <Text style={styles.smartTagTitle}>Electronic E-ink SmartTag</Text>
              <Text style={styles.smartTagBody}>
                Your registered PolyAero SmartTag is connected. IATA 10-digit barcode, routing (HKG ➔ NKG), and weight limits are securely synchronized via NFC.
              </Text>

              {/* Tag Status Pill */}
              <View style={styles.tagStatusRow}>
                <View style={styles.tagStatusItem}>
                  <Text style={styles.tagStatusLabel}>TAG STATUS</Text>
                  <View style={styles.tagStatusValueRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#006564" />
                    <Text style={styles.tagStatusValue}>Active & Linked</Text>
                  </View>
                </View>

                <View style={styles.tagStatusItem}>
                  <Text style={styles.tagStatusLabel}>FLIGHT</Text>
                  <Text style={styles.tagStatusValue}>CX304 HKG ➔ NKG</Text>
                </View>

                <View style={styles.tagStatusItem}>
                  <Text style={styles.tagStatusLabel}>ALLOWANCE</Text>
                  <Text style={styles.tagStatusValue}>
                    {cabinClass === 'Business' ? '32 kg' : '23 kg'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cathayPrimaryBtn}
                onPress={() => {
                  setActiveModal(null);
                  onNavigateToTrips?.();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.cathayPrimaryBtnText}>View SmartTag in My trips →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 3: FLIGHT TIMETABLE (Video Frame #104) */}
      <Modal
        visible={activeModal === 'timetable'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Flight timetable</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              View the most up-to-date information about our current and upcoming flights with seats available to book.
            </Text>

            <View style={styles.timetableCard}>
              <Text style={styles.timetableRoute}>Hong Kong (HKG) ➔ Nanjing (NKG)</Text>
              <Text style={styles.timetableDetail}>Daily • CX304 (19:25 - 21:50) • Airbus A330-300</Text>
            </View>

            <View style={[styles.timetableCard, { marginTop: 12 }]}>
              <Text style={styles.timetableRoute}>Hong Kong (HKG) ➔ Beijing (PEK)</Text>
              <Text style={styles.timetableDetail}>Daily • CX336 (11:50 - 15:30) • Boeing 777-300ER</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 4: DELAYS & CANCELLATIONS */}
      <Modal
        visible={activeModal === 'delays'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Delays and cancellations</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <View style={styles.statusNoticeBox}>
              <Ionicons name="checkmark-circle" size={24} color="#006564" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.statusNoticeTitle}>Operations are normal</Text>
                <Text style={styles.statusNoticeBody}>
                  Cathay Pacific and HK Express flights are operating on scheduled timetable today.
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 5: REBOOK & REFUND */}
      <Modal
        visible={activeModal === 'rebook'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Rebook and refund</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              Enjoy flexibility and options to make changes to your ticket. Date and flight changes can be made for bookings on cathaypacific.com.
            </Text>

            <TouchableOpacity
              style={styles.cathayPrimaryBtn}
              onPress={() => {
                setActiveModal(null);
                onNavigateToTrips?.();
              }}
            >
              <Text style={styles.cathayPrimaryBtnText}>Manage in My bookings</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 6: GENERIC INFO MODAL */}
      <Modal
        visible={activeModal === 'info'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{modalTitle}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalExplainer}>{modalContent}</Text>
            <TouchableOpacity
              style={styles.cathayPrimaryBtn}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.cathayPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E5DF',
  },
  headerBtn: {
    padding: 6,
  },
  headerSpacer: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.333%',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  gridIcon: {
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 12,
    color: '#1C2024',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 16,
    height: 32,
  },

  /* Modals */
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
    borderBottomColor: '#E8E5DF',
  },
  modalHeaderBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  modalHeaderSpacer: {
    width: 36,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalExplainer: {
    fontSize: 14,
    lineHeight: 20,
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
  cathayPrimaryBtn: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  cathayPrimaryBtnText: {
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
    marginTop: 10,
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
    gap: 8,
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
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
    textAlign: 'center',
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
  smartTagContainer: {
    backgroundColor: '#E6F4F2',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#A7D9D3',
    marginBottom: 20,
  },
  smartTagHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  smartTagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006564',
    letterSpacing: 0.5,
  },
  smartTagTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 6,
  },
  smartTagBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    marginBottom: 16,
  },
  tagStatusRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tagStatusItem: {
    flex: 1,
  },
  tagStatusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 4,
  },
  tagStatusValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagStatusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C2024',
  },
  timetableCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 16,
  },
  statusNoticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  statusNoticeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#14532D',
  },
});
