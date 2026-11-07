import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlightBooking } from './CathayTypes';

interface CathayBookScreenProps {
  onFlightSelected: (booking: FlightBooking) => void;
  onOpenDevMenu?: () => void;
}

export const CathayBookScreen: React.FC<CathayBookScreenProps> = ({
  onFlightSelected,
  onOpenDevMenu,
}) => {
  const [tripType, setTripType] = useState<'return' | 'oneway' | 'multicity'>('return');
  const [origin, setOrigin] = useState({ code: 'HKG', city: 'Hong Kong' });
  const [dest, setDest] = useState({ code: 'NKG', city: 'Nanjing' });
  const [cabin, setCabin] = useState('Economy, 1 Adult');
  const [departDate] = useState('Sun 08 Nov 2026');
  const [returnDate] = useState('Sun 15 Nov 2026');

  // Search Flow state
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedCabinTab, setSelectedCabinTab] = useState<'Economy' | 'Premium Economy' | 'Business'>('Economy');
  const [selectedDateIdx, setSelectedDateIdx] = useState(1); // Sun 08 Nov

  // Cabin bottom sheet
  const [showCabinSheet, setShowCabinSheet] = useState(false);
  const [adultCount, setAdultCount] = useState(1);

  const handleSwapAirports = () => {
    const temp = origin;
    setOrigin(dest);
    setDest(temp);
  };

  const handleTriggerSearch = () => {
    setIsSearching(true);
    // Simulate real Cathay airplane window loading animation
    setTimeout(() => {
      setIsSearching(false);
      setShowResults(true);
    }, 2400);
  };

  const handleSelectFlight = (flightNo: string, depTime: string, arrTime: string, dur: string, _price: string) => {
    const newBooking: FlightBooking = {
      id: `bk-${flightNo}-${Date.now()}`,
      pnr: '7Y9K2M',
      ticketNumber: '160-8291048291',
      flightNumber: flightNo,
      origin: origin.code,
      originCity: origin.city,
      destination: dest.code,
      destinationCity: dest.city,
      departureDate: departDate,
      departureTime: depTime,
      arrivalTime: arrTime,
      duration: dur,
      cabin: selectedCabinTab,
      terminal: 'Terminal 1',
      gate: 'Gate 23',
      seat: '18A',
      status: 'Confirmed',
      smartTag: {
        id: `tag-${flightNo}`,
        tagUid: '04:A1:B2:C3:D4:E5:F6',
        hardwareModel: 'PolyAero-Passive-2.9in',
        powerSource: 'PASSIVE_RF',
        batteryLevel: 94,
        einkDisplayStatus: 'SYNCHRONIZED',
        barcodeSymbology: 'INTERLEAVED_2_OF_5',
        linkedBaggageId: `bag-${flightNo}`,
        isWriteProtected: false,
        lastWrittenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      baggage: {
        id: `bag-${flightNo}`,
        tagNumber: '0160892012',
        smartTagId: '04:A1:B2:C3:D4:E5:F6',
        bookingReference: '7Y9K2M',
        passengerId: 'pax-trinh-01',
        flightId: flightNo,
        weightKg: 21.4,
        currentStatus: 'CHECKED_IN',
        lastKnownLocation: `${origin.code}-T1-CHECKIN`,
        lastScannedAt: new Date().toISOString(),
        isRushBag: false,
      },
    };
    onFlightSelected(newBooking);
  };

  return (
    <View style={styles.container}>
      {/* 1. AIRPLANE WINDOW LOADING ANIMATION MODAL */}
      <Modal visible={isSearching} animationType="fade" transparent={false}>
        <SafeAreaView style={styles.loadingSafeArea}>
          <ImageBackground
            source={require('../../../assets/cathay/airplane-window-aria.jpg')}
            style={styles.loadingHeroImage}
            resizeMode="cover"
          >
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingHeadline}>Discover the Aria Suite in our Business cabin</Text>
              <Text style={styles.loadingSub}>Book your flight online now with free 24-hour cancellation</Text>
            </View>
          </ImageBackground>

          <View style={styles.loadingRouteBar}>
            <Text style={styles.routeCodeText}>{origin.code}</Text>
            <View style={styles.progressLineWrapper}>
              <View style={styles.flightLine} />
              <Ionicons name="airplane" size={20} color="#006564" style={styles.planeIconAnimated} />
            </View>
            <Text style={styles.routeCodeText}>{dest.code}</Text>
          </View>

          <View style={styles.loadingFooter}>
            <ActivityIndicator size="large" color="#006564" />
            <Text style={styles.searchingText}>
              Searching flights from <Text style={styles.boldText}>{origin.city}</Text> to <Text style={styles.boldText}>{dest.city}</Text>
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 2. FLIGHT SEARCH RESULTS SCREEN */}
      {showResults && (
        <SafeAreaView style={styles.resultsSafeArea}>
          {/* Results Top Header */}
          <View style={styles.resultsHeader}>
            <TouchableOpacity onPress={() => setShowResults(false)} style={styles.resultsBackBtn}>
              <Ionicons name="chevron-back" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.resultsTitle}>Select departing flight</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Date Selector Ribbon */}
          <View style={styles.dateRibbon}>
            {[
              { day: 'Sat, 07 Nov', price: 'HKD5,674' },
              { day: 'Sun, 08 Nov', price: 'HKD5,674' },
              { day: 'Mon, 09 Nov', price: 'HKD5,674' },
              { day: 'Tue, 10 Nov', price: 'HKD5,674' },
            ].map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.dateRibbonItem, selectedDateIdx === idx && styles.dateRibbonItemActive]}
                onPress={() => setSelectedDateIdx(idx)}
              >
                <Text style={[styles.dateRibbonDay, selectedDateIdx === idx && styles.dateRibbonDayActive]}>{item.day}</Text>
                <Text style={[styles.dateRibbonPrice, selectedDateIdx === idx && styles.dateRibbonPriceActive]}>{item.price}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Results Count & Filter Row */}
          <View style={styles.filterBar}>
            <Text style={styles.resultsCountText}>27 Results</Text>
            <TouchableOpacity style={styles.filterButton}>
              <Ionicons name="options-outline" size={18} color="#006564" />
              <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
          </View>

          {/* Cabin Class Tabs */}
          <View style={styles.cabinTabsRow}>
            {[
              { id: 'Economy', label: 'Economy' },
              { id: 'Premium Economy', label: 'Premium Econo...' },
              { id: 'Business', label: 'Business' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.cabinTabBtn, selectedCabinTab === tab.id && styles.cabinTabBtnActive]}
                onPress={() => setSelectedCabinTab(tab.id as any)}
              >
                <Text style={[styles.cabinTabLabel, selectedCabinTab === tab.id && styles.cabinTabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Flight Cards List */}
          <ScrollView style={styles.flightResultsScroll} contentContainerStyle={styles.flightResultsContent}>
            {/* CARD 1: NON-STOP CX304 */}
            <View style={styles.flightCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.airlineBadge}>
                  <Text style={styles.flightNumberText}>CX304</Text>
                  <Text style={styles.nonStopBadge}>Non-stop</Text>
                </View>
                <View style={styles.lowestFareTag}>
                  <Text style={styles.lowestFareText}>Lowest Fare</Text>
                </View>
              </View>

              <View style={styles.flightTimingRow}>
                <View style={styles.timingCol}>
                  <Text style={styles.timeText}>19:25</Text>
                  <Text style={styles.codeText}>{origin.code}</Text>
                </View>

                <View style={styles.flightDurationCol}>
                  <Text style={styles.durationText}>2h 25m</Text>
                  <View style={styles.flightPathLine} />
                  <Ionicons name="airplane" size={14} color="#718096" />
                </View>

                <View style={styles.timingColRight}>
                  <Text style={styles.timeText}>21:50</Text>
                  <Text style={styles.codeText}>{dest.code}</Text>
                </View>
              </View>

              <View style={styles.cardFooterDivider} />

              <View style={styles.cardPriceRow}>
                <View style={styles.priceMetaCol}>
                  <Text style={styles.perAdultLabel}>Per Adult From</Text>
                  <Text style={styles.flightPriceValue}>HKD 5,674</Text>
                </View>

                <TouchableOpacity
                  style={styles.selectFlightBtn}
                  onPress={() => handleSelectFlight('CX304', '19:25', '21:50', '2h 25m', 'HKD5,674')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.selectFlightBtnText}>Select</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* CARD 2: 1-STOP TRANSIT CX332 > CA1503 */}
            <View style={styles.flightCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.airlineBadge}>
                  <Text style={styles.flightNumberText}>CX332 • CA1503</Text>
                  <Text style={styles.transitBadge}>Transit at PEK</Text>
                </View>
                <View style={styles.seatsLeftBadge}>
                  <Text style={styles.seatsLeftText}>9 Seats Left</Text>
                </View>
              </View>

              <View style={styles.flightTimingRow}>
                <View style={styles.timingCol}>
                  <Text style={styles.timeText}>12:05</Text>
                  <Text style={styles.codeText}>{origin.code}</Text>
                </View>

                <View style={styles.flightDurationCol}>
                  <Text style={styles.durationText}>7h 50m</Text>
                  <View style={styles.flightPathLine} />
                  <Ionicons name="airplane" size={14} color="#718096" />
                </View>

                <View style={styles.timingColRight}>
                  <Text style={styles.timeText}>19:55</Text>
                  <Text style={styles.codeText}>{dest.code}</Text>
                </View>
              </View>

              <Text style={styles.operatorNoteText}>CA1503 operated by Air China</Text>

              <View style={styles.cardFooterDivider} />

              <View style={styles.cardPriceRow}>
                <View style={styles.priceMetaCol}>
                  <Text style={styles.perAdultLabel}>Per Adult From</Text>
                  <Text style={styles.flightPriceValue}>HKD 8,914</Text>
                </View>

                <TouchableOpacity
                  style={styles.selectFlightBtn}
                  onPress={() => handleSelectFlight('CX332', '12:05', '19:55', '7h 50m', 'HKD8,914')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.selectFlightBtnText}>Select</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      )}

      {/* 3. MAIN BOOK FORM (Matching Frames #75 - #78) */}
      {!showResults && (
        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
          {/* Header Hero Area */}
          <ImageBackground
            source={require('../../../assets/cathay/cathay-hero-tail.png')}
            style={styles.heroTailBackground}
            resizeMode="cover"
          >
            <SafeAreaView style={styles.heroSafeArea}>
              <View style={styles.topNavRow}>
                <Text style={styles.heroHeading}>Book a trip</Text>
                <TouchableOpacity onPress={onOpenDevMenu} style={styles.iconBtn}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </ImageBackground>

          {/* Search Card Container */}
          <View style={styles.cardOverlay}>
            <View style={styles.searchFormCard}>
              {/* Trip Type Segmented Control */}
              <View style={styles.segmentedRow}>
                {[
                  { id: 'return', label: 'Return' },
                  { id: 'oneway', label: 'One way' },
                  { id: 'multicity', label: 'Multi-city' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.segmentBtn, tripType === item.id && styles.segmentBtnActive]}
                    onPress={() => setTripType(item.id as any)}
                  >
                    <Text style={[styles.segmentLabel, tripType === item.id && styles.segmentLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Origin / Destination Row */}
              <View style={styles.routePickerRow}>
                {/* Origin */}
                <View style={styles.airportCol}>
                  <Text style={styles.airportCodeLabel}>{origin.code}</Text>
                  <Text style={styles.airportCityLabel}>{origin.city}</Text>
                </View>

                {/* Swap Button */}
                <TouchableOpacity style={styles.swapBtn} onPress={handleSwapAirports} activeOpacity={0.8}>
                  <Ionicons name="swap-horizontal" size={20} color="#006564" />
                </TouchableOpacity>

                {/* Destination */}
                <View style={styles.airportColRight}>
                  <Text style={styles.airportCodeLabelRight}>{dest.code}</Text>
                  <Text style={styles.airportCityLabelRight}>{dest.city}</Text>
                </View>
              </View>

              {/* Dates Row */}
              <View style={styles.datePickerRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateSubLabel}>Departing on</Text>
                  <Text style={styles.dateValText}>{departDate}</Text>
                </View>

                {tripType === 'return' && (
                  <View style={styles.dateColRight}>
                    <Text style={styles.dateSubLabel}>Returning</Text>
                    <Text style={styles.dateValText}>{returnDate}</Text>
                  </View>
                )}
              </View>

              {/* Cabin Class & Passengers Dropdown */}
              <TouchableOpacity
                style={styles.cabinPickerRow}
                onPress={() => setShowCabinSheet(true)}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={styles.dateSubLabel}>Cabin class and passengers</Text>
                  <Text style={styles.cabinValText}>{cabin}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#718096" />
              </TouchableOpacity>

              {/* Promo Accordion */}
              <View style={styles.promoSection}>
                <TouchableOpacity style={styles.promoRow} activeOpacity={0.7}>
                  <Ionicons name="pricetag-outline" size={16} color="#006564" />
                  <Text style={styles.promoText}>Add a promotion code</Text>
                </TouchableOpacity>

                <View style={styles.promoTagsRow}>
                  <View style={styles.promoPill}>
                    <Text style={styles.promoPillText}>Double 11 flight offer &gt;</Text>
                  </View>
                  <View style={styles.promoPill}>
                    <Text style={styles.promoPillText}>Up to 25% off travel ins...</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.redeemMilesRow}>
                  <Text style={styles.redeemMilesText}>Redeem flight with miles</Text>
                </TouchableOpacity>
              </View>

              {/* Price Indicator */}
              <View style={styles.indicativePriceRow}>
                <Text style={styles.indicativePriceText}>
                  Price per adult from <Text style={styles.boldText}>HKD5,674</Text>
                </Text>
              </View>

              {/* Search Flight Action Button */}
              <TouchableOpacity style={styles.searchFlightButton} onPress={handleTriggerSearch} activeOpacity={0.85}>
                <Text style={styles.searchFlightButtonText}>Search flight</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Cabin Picker Bottom Sheet Modal */}
      <Modal visible={showCabinSheet} transparent animationType="slide" onRequestClose={() => setShowCabinSheet(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.cabinSheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cabin class & passengers</Text>
              <TouchableOpacity onPress={() => setShowCabinSheet(false)}>
                <Ionicons name="close" size={24} color="#718096" />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetCabinOptions}>
              {['Economy', 'Premium Economy', 'Business', 'First'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.sheetCabinPill, cabin.startsWith(c) && styles.sheetCabinPillActive]}
                  onPress={() => setCabin(`${c}, ${adultCount} Adult`)}
                >
                  <Text style={[styles.sheetCabinPillText, cabin.startsWith(c) && styles.sheetCabinPillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.passengerCountRow}>
              <Text style={styles.paxLabel}>Adults (12+ years)</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setAdultCount(Math.max(1, adultCount - 1))}
                >
                  <Ionicons name="remove" size={18} color="#1C2024" />
                </TouchableOpacity>
                <Text style={styles.counterVal}>{adultCount}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setAdultCount(adultCount + 1)}
                >
                  <Ionicons name="add" size={18} color="#1C2024" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmSheetBtn}
              onPress={() => setShowCabinSheet(false)}
            >
              <Text style={styles.confirmSheetBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroTailBackground: {
    width: '100%',
    height: 180,
  },
  heroSafeArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  iconBtn: {
    padding: 6,
  },
  cardOverlay: {
    paddingHorizontal: 16,
    marginTop: -40,
  },
  searchFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  segmentLabelActive: {
    color: '#006564',
    fontWeight: '700',
  },
  routePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  airportCol: {
    flex: 1,
  },
  airportColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  airportCodeLabel: {
    fontSize: 28,
    fontWeight: '700',
    color: '#006564',
  },
  airportCityLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  airportCodeLabelRight: {
    fontSize: 28,
    fontWeight: '700',
    color: '#006564',
  },
  airportCityLabelRight: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  dateCol: {
    flex: 1,
  },
  dateColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dateSubLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  dateValText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 4,
  },
  cabinPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  cabinValText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 4,
  },
  promoSection: {
    paddingVertical: 14,
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  promoText: {
    fontSize: 13,
    color: '#006564',
    fontWeight: '500',
  },
  promoTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  promoPill: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  promoPillText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
  },
  redeemMilesRow: {
    alignSelf: 'center',
    marginVertical: 4,
  },
  redeemMilesText: {
    fontSize: 13,
    color: '#006564',
    fontWeight: '500',
  },
  indicativePriceRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  indicativePriceText: {
    fontSize: 13,
    color: '#64748B',
  },
  boldText: {
    fontWeight: '700',
    color: '#1C2024',
  },
  searchFlightButton: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  searchFlightButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  loadingHeroImage: {
    width: '100%',
    height: 380,
    justifyContent: 'flex-start',
  },
  loadingOverlay: {
    padding: 24,
    paddingTop: 32,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  loadingHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  loadingSub: {
    fontSize: 14,
    color: '#E2E8F0',
    marginTop: 6,
  },
  loadingRouteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
    marginVertical: 24,
  },
  routeCodeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#006564',
  },
  progressLineWrapper: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#CBD5E1',
  },
  planeIconAnimated: {
    position: 'absolute',
  },
  loadingFooter: {
    alignItems: 'center',
    paddingBottom: 60,
    gap: 16,
  },
  searchingText: {
    fontSize: 15,
    color: '#475569',
  },
  resultsSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  resultsBackBtn: {
    padding: 6,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  headerSpacer: {
    width: 36,
  },
  dateRibbon: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  dateRibbonItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  dateRibbonItemActive: {
    borderBottomColor: '#006564',
  },
  dateRibbonDay: {
    fontSize: 11,
    color: '#64748B',
  },
  dateRibbonDayActive: {
    color: '#006564',
    fontWeight: '700',
  },
  dateRibbonPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 2,
  },
  dateRibbonPriceActive: {
    color: '#006564',
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C2024',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#006564',
    fontWeight: '600',
  },
  cabinTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  cabinTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cabinTabBtnActive: {
    backgroundColor: '#006564',
    borderColor: '#006564',
  },
  cabinTabLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  cabinTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  flightResultsScroll: {
    flex: 1,
  },
  flightResultsContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  flightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  airlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flightNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C2024',
  },
  nonStopBadge: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transitBadge: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowestFareTag: {
    backgroundColor: '#E6F4F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lowestFareText: {
    fontSize: 11,
    color: '#006564',
    fontWeight: '600',
  },
  seatsLeftBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  seatsLeftText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  flightTimingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  timingCol: {
    alignItems: 'flex-start',
  },
  timingColRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C2024',
  },
  codeText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  flightDurationCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  durationText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  flightPathLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 4,
  },
  operatorNoteText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  cardFooterDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  cardPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceMetaCol: {},
  perAdultLabel: {
    fontSize: 11,
    color: '#718096',
  },
  flightPriceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
    marginTop: 1,
  },
  selectFlightBtn: {
    backgroundColor: '#006564',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 6,
  },
  selectFlightBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  cabinSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
  },
  sheetCabinOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  sheetCabinPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  sheetCabinPillActive: {
    borderColor: '#006564',
    backgroundColor: '#E6F4F2',
  },
  sheetCabinPillText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  sheetCabinPillTextActive: {
    color: '#006564',
    fontWeight: '700',
  },
  passengerCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  paxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C2024',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  counterVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
  },
  confirmSheetBtn: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmSheetBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
