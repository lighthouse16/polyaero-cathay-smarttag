import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  SafeAreaView,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlightBooking } from './CathayTypes';

interface CathayBookScreenProps {
  onFlightSelected: (booking: FlightBooking) => void;
  onOpenDevMenu?: () => void;
}

const HERO_TAIL = require('../../../assets/cathay/cathay-hero-tail.png');
const WINDOW_ARIA = require('../../../assets/cathay/airplane-window-aria.jpg');

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
  const [selectedDateIdx, setSelectedDateIdx] = useState(1);

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
    setTimeout(() => {
      setIsSearching(false);
      setShowResults(true);
    }, 1800);
  };

  const handleSelectFlight = (flightNo: string, depTime: string, arrTime: string, dur: string) => {
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
      {/* 1. AIRPLANE WINDOW LOADING ANIMATION MODAL (Authentic Frame #171) */}
      <Modal visible={isSearching} animationType="fade" transparent={false}>
        <SafeAreaView style={styles.loadingSafeArea}>
          <View style={styles.loadingWindowWrap}>
            <Image
              source={WINDOW_ARIA}
              style={styles.loadingWindowImg}
              resizeMode="contain"
            />
          </View>

          <View style={styles.loadingRouteBar}>
            <View style={styles.loadingRouteLineRow}>
              <View style={styles.loadingLineActive} />
              <Ionicons name="airplane" size={20} color="#2E6E6D" style={styles.loadingPlaneIcon} />
              <View style={styles.loadingLineRemaining} />
            </View>
            <View style={styles.loadingAirportCodesRow}>
              <Text style={styles.loadingOriginCode}>{origin.code}</Text>
              <Text style={styles.loadingDestCode}>{dest.code}</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 2. FLIGHT SEARCH RESULTS SCREEN (Authentic Frame #174) */}
      {showResults && (
        <SafeAreaView style={styles.resultsSafeArea}>
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
              { day: 'Sat, 07 Nov', price: '5,674' },
              { day: 'Sun, 08 Nov', price: '5,674' },
              { day: 'Mon, 09 Nov', price: '5,674' },
              { day: 'Tue, 10 Nov', price: '5,674' },
            ].map((item, idx) => {
              const isActive = selectedDateIdx === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dateRibbonItem, isActive && styles.dateRibbonItemActive]}
                  onPress={() => setSelectedDateIdx(idx)}
                >
                  <Text style={[styles.dateRibbonDay, isActive && styles.dateRibbonDayActive]}>
                    {item.day}
                  </Text>
                  <Text style={[styles.dateRibbonPrice, isActive && styles.dateRibbonPriceActive]}>
                    HKD<Text style={styles.dateRibbonPriceBold}>{item.price}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 27 Results & Filter Sliders Icon */}
          <View style={styles.filterBar}>
            <Text style={styles.resultsCountText}>27 Results</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Ionicons name="options-outline" size={22} color="#195A58" />
            </TouchableOpacity>
          </View>

          {/* Unified 3-Column Cabin Selector Box (Frame #174) */}
          <View style={styles.cabinUnifiedBox}>
            <TouchableOpacity
              style={[
                styles.cabinUnifiedCol,
                selectedCabinTab === 'Economy' && styles.cabinUnifiedColActive,
              ]}
              onPress={() => setSelectedCabinTab('Economy')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.cabinUnifiedTitle,
                  selectedCabinTab === 'Economy' && styles.cabinUnifiedTextActive,
                ]}
              >
                Economy
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cabinUnifiedCol,
                selectedCabinTab === 'Premium Economy' && styles.cabinUnifiedColActive,
              ]}
              onPress={() => setSelectedCabinTab('Premium Economy')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.cabinUnifiedTitle,
                  selectedCabinTab === 'Premium Economy' && styles.cabinUnifiedTextActive,
                ]}
                numberOfLines={1}
              >
                Premium Econo...
              </Text>
              <Text
                style={[
                  styles.cabinUnifiedSubPrice,
                  selectedCabinTab === 'Premium Economy' && styles.cabinUnifiedTextActive,
                ]}
              >
                +HKD<Text style={{ fontWeight: '700' }}>10,784</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cabinUnifiedCol,
                selectedCabinTab === 'Business' && styles.cabinUnifiedColActive,
              ]}
              onPress={() => setSelectedCabinTab('Business')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.cabinUnifiedTitle,
                  selectedCabinTab === 'Business' && styles.cabinUnifiedTextActive,
                ]}
              >
                Business
              </Text>
              <Text
                style={[
                  styles.cabinUnifiedSubPrice,
                  selectedCabinTab === 'Business' && styles.cabinUnifiedTextActive,
                ]}
              >
                +HKD<Text style={{ fontWeight: '700' }}>8,984</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2-Column Split Flight Cards List (Exact Frame #174) */}
          <ScrollView
            style={styles.flightResultsScroll}
            contentContainerStyle={styles.flightResultsContent}
            showsVerticalScrollIndicator={false}
          >
            {/* CARD 1: CX304 Direct */}
            <TouchableOpacity
              style={styles.splitFlightCard}
              onPress={() => handleSelectFlight('CX304', '19:25', '21:50', '2h 25m')}
              activeOpacity={0.85}
            >
              <View style={styles.splitCardLeft}>
                <View style={styles.splitTimeRouteRow}>
                  <View>
                    <Text style={styles.splitTimeTeal}>19:25</Text>
                    <Text style={styles.splitAirportCode}>{origin.code}</Text>
                  </View>

                  <View style={styles.splitDurationMid}>
                    <Text style={styles.splitDurationText}>2h 25m</Text>
                    <View style={styles.splitLineRow}>
                      <Ionicons name="airplane" size={14} color="#1C2024" />
                      <View style={styles.splitGreyLine} />
                      <View style={styles.splitEndDot} />
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.splitTimeTeal}>21:50</Text>
                    <Text style={styles.splitAirportCode}>{dest.code}</Text>
                  </View>
                </View>

                <Text style={styles.splitFlightNumText}>CX304</Text>
              </View>

              <View style={styles.splitCardRight}>
                <Text style={styles.splitRightTag}>Lowest Fare</Text>
                <View style={styles.splitRightPriceGroup}>
                  <Text style={styles.splitRightPrice}>
                    HKD<Text style={styles.splitRightPriceBold}>5,674</Text>
                  </Text>
                  <Text style={styles.splitRightPerAdult}>Per Adult From</Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={18} color="#195A58" />
              </View>
            </TouchableOpacity>

            {/* CARD 2: CX332 > CA1503 Transit at PEK */}
            <TouchableOpacity
              style={styles.splitFlightCard}
              onPress={() => handleSelectFlight('CX332', '12:05', '19:55', '7h 50m')}
              activeOpacity={0.85}
            >
              <View style={styles.splitCardLeft}>
                <View style={styles.mixedCabinPill}>
                  <Text style={styles.mixedCabinPillText}>Mixed Cabin</Text>
                </View>

                <View style={styles.splitTimeRouteRow}>
                  <View>
                    <Text style={styles.splitTimeTeal}>12:05</Text>
                    <Text style={styles.splitAirportCode}>{origin.code}</Text>
                  </View>

                  <View style={styles.splitDurationMid}>
                    <Text style={styles.splitDurationText}>7h 50m</Text>
                    <View style={styles.splitLineRow}>
                      <Ionicons name="airplane" size={14} color="#1C2024" />
                      <View style={styles.splitGreyLine} />
                      <View style={styles.splitStopBlackDot} />
                      <View style={styles.splitGreyLine} />
                      <View style={styles.splitEndDot} />
                    </View>
                    <Text style={styles.transitLabelText}>
                      Transit at <Text style={{ fontWeight: '700' }}>PEK</Text>
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.splitTimeTeal}>19:55</Text>
                    <Text style={styles.splitAirportCode}>{dest.code}</Text>
                  </View>
                </View>

                <Text style={styles.splitFlightNumText}>CX332 &gt; CA1503</Text>
                <Text style={styles.splitOperatorSub}>
                  CA1503 operated by <Text style={{ fontWeight: '600' }}>Air China</Text>
                </Text>
              </View>

              <View style={styles.splitCardRight}>
                <Text style={styles.splitRightTag}>9 Seats Left</Text>
                <View style={styles.splitRightPriceGroup}>
                  <Text style={styles.splitRightPrice}>
                    HKD<Text style={styles.splitRightPriceBold}>8,914</Text>
                  </Text>
                  <Text style={styles.splitRightPerAdult}>Per Adult From</Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={18} color="#195A58" />
              </View>
            </TouchableOpacity>

            {/* CARD 3: CX336 > CA1819 Transit at PEK */}
            <TouchableOpacity
              style={styles.splitFlightCard}
              onPress={() => handleSelectFlight('CX336', '14:50', '22:50', '8h 0m')}
              activeOpacity={0.85}
            >
              <View style={styles.splitCardLeft}>
                <View style={styles.mixedCabinPill}>
                  <Text style={styles.mixedCabinPillText}>Mixed Cabin</Text>
                </View>

                <View style={styles.splitTimeRouteRow}>
                  <View>
                    <Text style={styles.splitTimeTeal}>14:50</Text>
                    <Text style={styles.splitAirportCode}>{origin.code}</Text>
                  </View>

                  <View style={styles.splitDurationMid}>
                    <Text style={styles.splitDurationText}>8h 0m</Text>
                    <View style={styles.splitLineRow}>
                      <Ionicons name="airplane" size={14} color="#1C2024" />
                      <View style={styles.splitGreyLine} />
                      <View style={styles.splitStopBlackDot} />
                      <View style={styles.splitGreyLine} />
                      <View style={styles.splitEndDot} />
                    </View>
                    <Text style={styles.transitLabelText}>
                      Transit at <Text style={{ fontWeight: '700' }}>PEK</Text>
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.splitTimeTeal}>22:50</Text>
                    <Text style={styles.splitAirportCode}>{dest.code}</Text>
                  </View>
                </View>

                <Text style={styles.splitFlightNumText}>CX336 &gt; CA1819</Text>
                <Text style={styles.splitOperatorSub}>
                  CA1819 operated by <Text style={{ fontWeight: '600' }}>Air China</Text>
                </Text>
              </View>

              <View style={styles.splitCardRight}>
                <Text style={styles.splitRightTag}>1 Seats Left</Text>
                <View style={styles.splitRightPriceGroup}>
                  <Text style={styles.splitRightPrice}>
                    HKD<Text style={styles.splitRightPriceBold}>9,164</Text>
                  </Text>
                  <Text style={styles.splitRightPerAdult}>Per Adult From</Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={18} color="#195A58" />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      )}

      {/* 3. MAIN BOOK A TRIP SCREEN (Exact Frame #170) */}
      {!showResults && (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Tail Image Header */}
          <View style={styles.heroWrap}>
            <ImageBackground
              source={HERO_TAIL}
              style={styles.heroTailBackground}
              imageStyle={styles.heroTailImageStyle}
              resizeMode="cover"
            >
              <View style={styles.heroSafeArea}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={onOpenDevMenu}
                  style={styles.heroHeadingWrap}
                >
                  <Text style={styles.heroHeading}>Book a trip</Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          </View>

          {/* Main Floating Search Card */}
          <View style={styles.cardOverlay}>
            <View style={styles.searchFormCard}>
              {/* Underline Tab Bar: Return | One way | Multi-city */}
              <View style={styles.underlineTabRow}>
                {[
                  { id: 'return', label: 'Return' },
                  { id: 'oneway', label: 'One way' },
                  { id: 'multicity', label: 'Multi-city' },
                ].map((item) => {
                  const isActive = tripType === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.underlineTabBtn}
                      onPress={() => setTripType(item.id as 'return' | 'oneway' | 'multicity')}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.underlineTabLabel, isActive && styles.underlineTabLabelActive]}>
                        {item.label}
                      </Text>
                      {isActive && <View style={styles.underlineActiveBar} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Origin / Destination Picker Row */}
              <View style={styles.routePickerRow}>
                <View style={styles.airportCol}>
                  <Text style={styles.airportCodeLabel}>{origin.code}</Text>
                  <Text style={styles.airportCityLabel}>{origin.city}</Text>
                </View>

                <TouchableOpacity
                  style={styles.swapCircleBtn}
                  onPress={handleSwapAirports}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={20} color="#2E6E6D" />
                </TouchableOpacity>

                <View style={styles.airportColRight}>
                  <Text style={styles.airportCodeLabel}>{dest.code}</Text>
                  <Text style={styles.airportCityLabel}>{dest.city}</Text>
                </View>
              </View>

              {/* Departing / Returning Dates Row */}
              <View style={styles.datePickerRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.fieldSmallLabel}>Departing on</Text>
                  <Text style={styles.fieldValueText}>{departDate}</Text>
                </View>

                {tripType === 'return' && (
                  <View style={styles.dateColRight}>
                    <Text style={styles.fieldSmallLabel}>Returning</Text>
                    <Text style={styles.fieldValueText}>{returnDate}</Text>
                  </View>
                )}
              </View>

              {/* Cabin Class & Passengers Row */}
              <TouchableOpacity
                style={styles.cabinPickerRow}
                onPress={() => setShowCabinSheet(true)}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={styles.fieldSmallLabel}>Cabin class and passengers</Text>
                  <Text style={styles.fieldValueText}>{cabin}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#1C2024" />
              </TouchableOpacity>

              {/* Promotion Code & Peach Offer Pills */}
              <View style={styles.promoSection}>
                <TouchableOpacity style={styles.promoLinkRow} activeOpacity={0.7}>
                  <Ionicons name="pricetag-outline" size={17} color="#2E6E6D" />
                  <Text style={styles.promoLinkText}>Add a promotion code</Text>
                </TouchableOpacity>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.promoPillsScroll}
                >
                  <View style={styles.peachPromoPill}>
                    <Text style={styles.peachPromoPillText}>Double 11 flight offer  &gt;</Text>
                  </View>
                  <View style={styles.peachPromoPill}>
                    <Text style={styles.peachPromoPillText}>Up to 25% off travel together</Text>
                  </View>
                </ScrollView>

                {/* Right-Aligned Redeem & Price Per Adult */}
                <View style={styles.rightAlignedSummary}>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.redeemMilesText}>Redeem flight with miles</Text>
                  </TouchableOpacity>

                  <Text style={styles.indicativePriceLine}>
                    Price per adult from{' '}
                    <Text style={styles.priceCurrencyText}>HKD</Text>
                    <Text style={styles.priceAmountBold}>5,674</Text>
                  </Text>
                </View>
              </View>

              {/* Dark Forest Green Search Flight Button */}
              <TouchableOpacity
                style={styles.searchFlightButton}
                onPress={handleTriggerSearch}
                activeOpacity={0.85}
              >
                <Text style={styles.searchFlightButtonText}>Search flight</Text>
              </TouchableOpacity>
            </View>

            {/* Separate Floating Card: Check your favorite flights (Frame #170) */}
            <TouchableOpacity style={styles.favoriteFlightsCard} activeOpacity={0.8}>
              <Ionicons name="heart-outline" size={20} color="#1C2024" style={styles.favHeartIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.favCardTitle}>Check your favorite flights</Text>
                <Text style={styles.favCardSub}>0 available flight</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#1C2024" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Cabin Picker Bottom Sheet Modal */}
      <Modal
        visible={showCabinSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCabinSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cabinSheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cabin class & passengers</Text>
              <TouchableOpacity onPress={() => setShowCabinSheet(false)}>
                <Ionicons name="close" size={24} color="#52565A" />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetCabinOptions}>
              {['Economy', 'Premium Economy', 'Business', 'First'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.sheetCabinPill, cabin.startsWith(c) && styles.sheetCabinPillActive]}
                  onPress={() => setCabin(`${c}, ${adultCount} Adult`)}
                >
                  <Text style={[styles.sheetCabinPillText, cabin.startsWith(c) && styles.sheetCabinPillTextActive]}>
                    {c}
                  </Text>
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
              style={styles.searchFlightButton}
              onPress={() => setShowCabinSheet(false)}
            >
              <Text style={styles.searchFlightButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },

  /* Hero Header */
  heroWrap: {
    width: '100%',
    height: 270,
    overflow: 'hidden',
  },
  heroTailBackground: {
    width: '100%',
    height: '100%',
  },
  heroTailImageStyle: {
    borderBottomLeftRadius: 56,
  },
  heroSafeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
  },
  heroHeadingWrap: {
    marginTop: 20,
  },
  heroHeading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  /* Floating Card Overlay */
  cardOverlay: {
    paddingHorizontal: 20,
    marginTop: -150,
  },
  searchFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    ...cardShadow,
  },

  /* Underline Tabs: Return | One way | Multi-city */
  underlineTabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    marginBottom: 18,
  },
  underlineTabBtn: {
    paddingBottom: 12,
    position: 'relative',
  },
  underlineTabLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1C2024',
  },
  underlineTabLabelActive: {
    color: '#195A58',
    fontWeight: '600',
  },
  underlineActiveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 3.5,
    backgroundColor: '#195A58',
    borderRadius: 2,
  },

  /* Route Picker Row */
  routePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  airportCol: {
    flex: 1,
  },
  airportColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  airportCodeLabel: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2E6E6D',
    letterSpacing: -0.5,
  },
  airportCityLabel: {
    fontSize: 13,
    color: '#2C3034',
    marginTop: 2,
  },
  swapCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },

  /* Date & Cabin Rows */
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dateCol: {
    flex: 1,
  },
  dateColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  fieldSmallLabel: {
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: '400',
  },
  fieldValueText: {
    fontSize: 15.5,
    fontWeight: '400',
    color: '#1C2024',
    marginTop: 4,
  },
  cabinPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  /* Promo & Right-Aligned Price Section */
  promoSection: {
    paddingTop: 18,
    paddingBottom: 14,
  },
  promoLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  promoLinkText: {
    fontSize: 14.5,
    color: '#2E6E6D',
    fontWeight: '400',
  },
  promoPillsScroll: {
    gap: 8,
    paddingBottom: 6,
  },
  peachPromoPill: {
    backgroundColor: '#FCEEE9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  peachPromoPillText: {
    fontSize: 12.5,
    color: '#9E3E1E',
    fontWeight: '400',
  },
  rightAlignedSummary: {
    alignItems: 'flex-end',
    marginTop: 18,
  },
  redeemMilesText: {
    fontSize: 14.5,
    color: '#2E6E6D',
    fontWeight: '400',
    marginBottom: 10,
  },
  indicativePriceLine: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceCurrencyText: {
    fontSize: 18,
    color: '#1C2024',
    fontWeight: '400',
  },
  priceAmountBold: {
    fontSize: 18,
    color: '#1C2024',
    fontWeight: '700',
  },

  /* Dark Forest Green Search Flight Button */
  searchFlightButton: {
    backgroundColor: '#233D3B',
    borderRadius: 6,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  searchFlightButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },

  /* Check Your Favorite Flights Card */
  favoriteFlightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...cardShadow,
  },
  favHeartIcon: {
    marginRight: 12,
    marginTop: -14,
  },
  favCardTitle: {
    fontSize: 15.5,
    fontWeight: '400',
    color: '#1C2024',
  },
  favCardSub: {
    fontSize: 13.5,
    color: '#6B7280',
    marginTop: 3,
  },

  /* Loading Modal (Frame #171) */
  loadingSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  loadingWindowWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWindowImg: {
    width: '100%',
    height: '92%',
  },
  loadingRouteBar: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  loadingRouteLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingLineActive: {
    flex: 0.45,
    height: 2,
    backgroundColor: '#2E6E6D',
  },
  loadingPlaneIcon: {
    marginHorizontal: 4,
  },
  loadingLineRemaining: {
    flex: 0.55,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  loadingAirportCodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadingOriginCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E6E6D',
  },
  loadingDestCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
  },

  /* Results Screen (Frame #174) */
  resultsSafeArea: {
    flex: 1,
    backgroundColor: '#F5F6F7',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
    backgroundColor: '#FFFFFF',
  },
  resultsBackBtn: {
    padding: 6,
  },
  resultsTitle: {
    fontSize: 16.5,
    fontWeight: '400',
    color: '#1C2024',
  },
  headerSpacer: {
    width: 36,
  },
  dateRibbon: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateRibbonItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  dateRibbonItemActive: {
    borderBottomColor: '#195A58',
  },
  dateRibbonDay: {
    fontSize: 12,
    color: '#1C2024',
  },
  dateRibbonDayActive: {
    color: '#195A58',
    fontWeight: '700',
  },
  dateRibbonPrice: {
    fontSize: 12,
    color: '#1C2024',
    marginTop: 2,
  },
  dateRibbonPriceBold: {
    fontWeight: '700',
  },
  dateRibbonPriceActive: {
    color: '#195A58',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  resultsCountText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#1C2024',
  },

  /* Unified 3-Column Cabin Box */
  cabinUnifiedBox: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cabinUnifiedCol: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinUnifiedColActive: {
    backgroundColor: '#195A58',
  },
  cabinUnifiedTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E4E68',
  },
  cabinUnifiedSubPrice: {
    fontSize: 11.5,
    color: '#1E4E68',
    marginTop: 2,
  },
  cabinUnifiedTextActive: {
    color: '#FFFFFF',
  },

  /* 2-Column Split Flight Cards */
  flightResultsScroll: {
    flex: 1,
  },
  flightResultsContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 12,
  },
  splitFlightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    ...cardShadow,
  },
  splitCardLeft: {
    flex: 1.65,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#EEEEEE',
    justifyContent: 'space-between',
  },
  mixedCabinPill: {
    backgroundColor: '#FCEEE9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  mixedCabinPillText: {
    fontSize: 11,
    color: '#9E3E1E',
  },
  splitTimeRouteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  splitTimeTeal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#195A58',
  },
  splitAirportCode: {
    fontSize: 15,
    color: '#1C2024',
    marginTop: 4,
  },
  splitDurationMid: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  splitDurationText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  splitLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  splitGreyLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#D1D5DB',
  },
  splitStopBlackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1C2024',
  },
  splitEndDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  transitLabelText: {
    fontSize: 11.5,
    color: '#1C2024',
    marginTop: 6,
  },
  splitFlightNumText: {
    fontSize: 12.5,
    color: '#52565A',
  },
  splitOperatorSub: {
    fontSize: 10.5,
    color: '#52565A',
    marginTop: 4,
  },
  splitCardRight: {
    flex: 1,
    padding: 14,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  splitRightTag: {
    fontSize: 11.5,
    color: '#9E3E1E',
  },
  splitRightPriceGroup: {
    alignItems: 'flex-end',
    marginVertical: 12,
  },
  splitRightPrice: {
    fontSize: 16,
    color: '#1C2024',
  },
  splitRightPriceBold: {
    fontWeight: '700',
  },
  splitRightPerAdult: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 2,
  },

  /* Cabin Bottom Sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  cabinSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C4C6CA',
    backgroundColor: '#FFFFFF',
  },
  sheetCabinPillActive: {
    borderColor: '#195A58',
    backgroundColor: '#EEF5F5',
  },
  sheetCabinPillText: {
    fontSize: 14,
    color: '#2C3034',
  },
  sheetCabinPillTextActive: {
    color: '#195A58',
    fontWeight: '600',
  },
  passengerCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  paxLabel: {
    fontSize: 15,
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
    borderColor: '#C4C6CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterVal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
});
