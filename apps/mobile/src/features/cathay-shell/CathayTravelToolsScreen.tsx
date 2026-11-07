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
  Image,
  ImageSourcePropType,
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

const TOOL_ICONS: Record<string, ImageSourcePropType> = {
  boarding_pass: require('../../../assets/cathay/tools/icon_boarding_pass.png'),
  travel_info: require('../../../assets/cathay/tools/icon_travel_info.png'),
  timetable: require('../../../assets/cathay/tools/icon_timetable.png'),
  flight_status: require('../../../assets/cathay/tools/icon_flight_status.png'),
  rebook: require('../../../assets/cathay/tools/icon_rebook.png'),
  baggage: require('../../../assets/cathay/tools/icon_baggage.png'),
  delays: require('../../../assets/cathay/tools/icon_delays.png'),
  hotel: require('../../../assets/cathay/tools/icon_hotel.png'),
  package: require('../../../assets/cathay/tools/icon_package.png'),
  insurance: require('../../../assets/cathay/tools/icon_insurance.png'),
  car: require('../../../assets/cathay/tools/icon_car.png'),
  activities: require('../../../assets/cathay/tools/icon_activities.png'),
  shop: require('../../../assets/cathay/tools/icon_shop.png'),
  cabin: require('../../../assets/cathay/tools/icon_cabin.png'),
  inflight: require('../../../assets/cathay/tools/icon_inflight.png'),
  lounges: require('../../../assets/cathay/tools/icon_lounges.png'),
  airport: require('../../../assets/cathay/tools/icon_airport.png'),
  fleet: require('../../../assets/cathay/tools/icon_fleet.png'),
  passenger: require('../../../assets/cathay/tools/icon_passenger.png'),
  where_we_fly: require('../../../assets/cathay/tools/icon_where_we_fly.png'),
  inspiration: require('../../../assets/cathay/tools/icon_inspiration.png'),
  best_fares: require('../../../assets/cathay/tools/icon_best_fares.png'),
};

export const CathayTravelToolsScreen: React.FC<CathayTravelToolsScreenProps> = ({
  onClose,
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
      {/* Sheet Drag Handle + Close Button Header (Exact Video Frames #102 & #138) */}
      <View style={styles.sheetTopContainer}>
        <View style={styles.dragHandlePill} />
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
        </View>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: TRAVEL ESSENTIALS (Frames #101, #102) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Travel essentials</Text>

          <View style={styles.grid}>
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => onNavigateToTrips?.()}
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.boarding_pass} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Boarding pass</Text>
            </TouchableOpacity>

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
              <Image source={TOOL_ICONS.travel_info} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Travel information</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('timetable')}
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.timetable} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Flight timetable</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('flightStatus')}
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.flight_status} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Flight status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('rebook')}
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.rebook} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Rebook and{'\n'}refund</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('baggageCalc')}
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.baggage} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Baggage{'\n'}calculator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setActiveModal('delays')}
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.delays} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Delays and{'\n'}cancellations</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 2: PREPARE YOUR TRIP (Frames #101, #102, #138) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Prepare your trip</Text>

          <View style={styles.grid}>
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Book a hotel',
                  'Earn up to HKD 4 = 1 Asia Mile when booking hotels and stays with Cathay Holidays.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.hotel} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Book a hotel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Book a package',
                  'Choose two or more items and save on your trip with Cathay Holidays powered by Expedia.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.package} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Book a package</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Travel insurance',
                  'Cathay Rewards Travel Cover: up to HKD 2,000,000 sum insured for Medical Expenses.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.insurance} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Travel{'\n'}insurance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Rent a car',
                  'Car rental with flexible pick-up, free cancellation, and Asia Miles earning.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.car} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Rent a car</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Book activities',
                  'Search things to do, curated tours, and exclusive local experiences.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.activities} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Book activities</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Shop curated picks',
                  'Get ready with ease before you fly. Exclusive offers and curated essentials on Cathay Shop.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.shop} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Shop curated{'\n'}picks</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 3: FLYING WITH US (Frames #101, #138) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Flying with us</Text>

          <View style={styles.grid}>
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Cabin classes',
                  'Reach greater heights with lie-flat seats, inflight menus, and the Aria Suite on our Boeing 777-300ER.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.cabin} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Cabin classes</Text>
            </TouchableOpacity>

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
              <Image source={TOOL_ICONS.inflight} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Inflight{'\n'}experience</Text>
            </TouchableOpacity>

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
              <Image source={TOOL_ICONS.lounges} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Lounges</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Airport information',
                  'Hong Kong International Airport (HKG) terminal guides, check-in counters, and transfer information.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.airport} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Airport{'\n'}information</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() =>
                openInfoModal(
                  'Aircraft and fleet',
                  'Explore our modern fleet including Airbus A350-900/1000, A321neo, and Boeing 777-300ER.'
                )
              }
              activeOpacity={0.7}
            >
              <Image source={TOOL_ICONS.fleet} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Aircraft and fleet</Text>
            </TouchableOpacity>

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
              <Image source={TOOL_ICONS.passenger} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Passenger{'\n'}assistance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 4: TRAVEL INSPIRATION (Frames #138, #146) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Travel Inspiration</Text>

          <View style={styles.grid}>
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
              <Image source={TOOL_ICONS.where_we_fly} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Where we fly</Text>
            </TouchableOpacity>

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
              <Image source={TOOL_ICONS.inspiration} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Inspiration</Text>
            </TouchableOpacity>

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
              <Image source={TOOL_ICONS.best_fares} style={styles.toolIconImg} resizeMode="contain" />
              <Text style={styles.gridLabel}>Discover the best{'\n'}fares</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* MODAL 1: FLIGHT STATUS (Frame #106) */}
      <Modal
        visible={activeModal === 'flightStatus'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
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
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Baggage allowance & SmartTag</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalExplainer}>
              Calculate checked and carry-on baggage allowance for your Cathay Pacific flights, and inspect paired PolyAero SmartTag status.
            </Text>

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

            <View style={styles.allowanceCard}>
              <View style={styles.allowanceRow}>
                <Ionicons name="bag-outline" size={24} color="#2E6B69" />
                <View style={styles.allowanceTextCol}>
                  <Text style={styles.allowanceTitle}>Carry-on baggage</Text>
                  <Text style={styles.allowanceDetail}>
                    1 piece up to {cabinClass === 'Business' ? '14' : '7'} kg + 1 small personal item
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.allowanceRow}>
                <Ionicons name="briefcase-outline" size={24} color="#2E6B69" />
                <View style={styles.allowanceTextCol}>
                  <Text style={styles.allowanceTitle}>Checked baggage</Text>
                  <Text style={styles.allowanceDetail}>
                    {cabinClass === 'Business'
                      ? '2 pieces up to 32 kg each (64 kg total)'
                      : '2 pieces up to 23 kg each (46 kg total)'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.smartTagContainer}>
              <View style={styles.smartTagHeaderBadge}>
                <Ionicons name="pricetag" size={14} color="#2E6B69" />
                <Text style={styles.smartTagBadgeText}>POLYAERO DIGITAL BAGGAGE IDENTITY</Text>
              </View>

              <Text style={styles.smartTagTitle}>Electronic E-ink SmartTag</Text>
              <Text style={styles.smartTagBody}>
                Your registered PolyAero SmartTag is connected. IATA 10-digit barcode, routing (HKG ➔ NKG), and weight limits are securely synchronized via NFC.
              </Text>

              <View style={styles.tagStatusRow}>
                <View style={styles.tagStatusItem}>
                  <Text style={styles.tagStatusLabel}>TAG STATUS</Text>
                  <View style={styles.tagStatusValueRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#2E6B69" />
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

      {/* MODAL 3: FLIGHT TIMETABLE (Frame #104) */}
      <Modal
        visible={activeModal === 'timetable'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Flight timetable</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              View the most up-to-date information about our current and upcoming flights with seats available to book for the next year.
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
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Delays and cancellations</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <View style={styles.statusNoticeBox}>
              <Ionicons name="checkmark-circle" size={24} color="#2E6B69" />
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

      {/* MODAL 5: REBOOK & REFUND (Frame #107) */}
      <Modal
        visible={activeModal === 'rebook'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Rebook and refund</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalExplainer}>
              Enjoy flexibility and options to make changes to your ticket. Date and flight changes can be made for an itinerary involving the same routes.
            </Text>

            <TouchableOpacity
              style={styles.cathayPrimaryBtn}
              onPress={() => {
                setActiveModal(null);
                onNavigateToTrips?.();
              }}
            >
              <Text style={styles.cathayPrimaryBtnText}>Change a booking</Text>
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
              <Ionicons name="close" size={26} color="#1C2024" />
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
  sheetTopContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dragHandlePill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 4,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    height: 44,
  },
  headerBtn: {
    padding: 4,
  },
  headerSpacer: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 48,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 20,
    paddingHorizontal: 6,
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
  toolIconImg: {
    width: 36,
    height: 36,
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 13.5,
    color: '#2C3034',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
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
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '500',
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
    color: '#2C3034',
    marginBottom: 20,
  },
  statusInputGroup: {
    marginBottom: 16,
  },
  statusInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#52565A',
    marginBottom: 6,
  },
  statusTextInput: {
    borderWidth: 1,
    borderColor: '#C4C6CA',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C2024',
  },
  cathayPrimaryBtn: {
    backgroundColor: '#233D3B',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  cathayPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '500',
  },
  flightResultBox: {
    backgroundColor: '#F5F6F7',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#E6F4F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  onTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E6B69',
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
    color: '#52565A',
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C4C6CA',
    backgroundColor: '#FFFFFF',
  },
  cabinChoicePillActive: {
    borderColor: '#195A58',
    backgroundColor: '#195A58',
  },
  cabinChoicePillText: {
    fontSize: 12.5,
    color: '#2C3034',
    fontWeight: '500',
    textAlign: 'center',
  },
  cabinChoicePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  allowanceCard: {
    backgroundColor: '#F5F6F7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#52565A',
    marginTop: 2,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  smartTagContainer: {
    backgroundColor: '#EEF5F5',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D7E6E5',
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
    color: '#2E6B69',
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
    color: '#2C3034',
    marginBottom: 16,
  },
  tagStatusRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
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
    color: '#76777A',
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
    backgroundColor: '#F5F6F7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timetableRoute: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 4,
  },
  timetableDetail: {
    fontSize: 13,
    color: '#52565A',
  },
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF5F5',
    borderWidth: 1,
    borderColor: '#D7E6E5',
    borderRadius: 12,
    padding: 16,
  },
  statusNoticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#195A58',
    marginBottom: 4,
  },
  statusNoticeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2C3034',
  },
});
