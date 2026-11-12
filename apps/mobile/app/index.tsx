import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, shadows } from '../src/theme';
import { nfcService } from '../src/services/nfc';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://localhost:8000/api/v1');

const PASSENGER_PROFILES = [
  {
    tagNumber: '0160892012',
    tagUid: '04:A2:3B:4C:5D:6E:70',
    displayName: 'Timothy Chan',
    apiName: 'CHAN/TIMOTHY',
    tierLabel: 'DIAMOND • E-INK SMARTTAG EXCLUSIVE',
    defaultFlight: 'CX888',
    origin: 'HKG',
    dest: 'YVR',
    cityDest: 'Vancouver',
    cabin: 'PRIORITY J',
    weight: 22.4,
    isHardwareTag: true,
  },
  {
    tagNumber: '0160892014',
    tagUid: '04:B3:7C:1D:9E:2F:81',
    displayName: 'Victor Wong',
    apiName: 'WONG/VICTOR',
    tierLabel: 'GOLD • UNIVERSAL DIGITAL BAG TAG',
    defaultFlight: 'CX255',
    origin: 'HKG',
    dest: 'NRT',
    cityDest: 'Tokyo Narita',
    cabin: 'BUSINESS',
    weight: 28.5,
    isHardwareTag: false,
  },
];

interface BaggageEventItem {
  id: string;
  event_type: string;
  timestamp: string;
  location_code: string;
  station_name: string;
  scanner_type: string;
  notes?: string;
}

interface LiveBagState {
  tag_number: string;
  tag_code: string;
  booking_reference: string;
  passenger_name: string;
  tier_status: string;
  cabin_class: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  seat_number: string;
  weight_kg: number;
  status: string;
  last_known_location: string;
  carousel_assigned: string;
  is_rush_bag: boolean;
  risk_score: number;
  risk_level: string;
  copilot_approval_status?: string;
  passenger_recovery_choice?: string | null;
  eink_banner: string;
  updated_at: string;
  events: BaggageEventItem[];
}

export default function PassengerSmartTagScreen() {
  const [profileIdx, setProfileIdx] = useState(0);
  const profile = PASSENGER_PROFILES[profileIdx];

  const [bag, setBag] = useState<LiveBagState | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isSyncingNfc, setIsSyncingNfc] = useState(false);
  const [isDroppingBag, setIsDroppingBag] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [nfcFeedback, setNfcFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'TRIP' | 'BAG_DROP' | 'JOURNEY'>('TRIP');

  const fetchLiveBag = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/baggage/${profile.tagNumber}`);
      if (!res.ok) throw new Error('API offline');
      const data: LiveBagState = await res.json();
      setBag(data);
      setIsLive(true);
    } catch {
      setIsLive(false);
    }
  }, [profile.tagNumber]);

  useEffect(() => {
    fetchLiveBag();
    const timer = setInterval(fetchLiveBag, 3000);
    return () => clearInterval(timer);
  }, [fetchLiveBag]);

  const handleNfcSync = async () => {
    if (!termsAccepted) {
      setNfcFeedback('Please accept the Carriage Terms & Conditions first.');
      return;
    }
    setIsSyncingNfc(true);
    setNfcFeedback(null);
    try {
      await nfcService.writeEinkDisplay({
        tagUid: profile.tagUid,
        baggageTagNumber: profile.tagNumber,
        flightNumber: bag?.flight_number || profile.defaultFlight,
        originAirport: bag?.departure_airport || profile.origin,
        destinationAirport: bag?.arrival_airport || profile.dest,
        passengerInitials: profile.displayName.slice(0, 2).toUpperCase(),
        departureDate: '2026-11-14',
        barcodeSymbology: 'INTERLEAVED_2_OF_5',
      });

      const res = await fetch(`${API_BASE}/baggage/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_number: profile.tagNumber,
          tag_code: profile.tagUid,
          passenger_name: profile.apiName,
          flight_number: bag?.flight_number || profile.defaultFlight,
          departure_airport: bag?.departure_airport || profile.origin,
          arrival_airport: bag?.arrival_airport || profile.dest,
          cabin_class: profile.cabin,
          weight_kg: profile.weight,
          connection_minutes: profile.isHardwareTag ? 95 : 35,
        }),
      });
      if (res.ok) {
        const updated: LiveBagState = await res.json();
        setBag(updated);
      }
      setNfcFeedback(
        profile.isHardwareTag
          ? '✓ Check-In Risk Scored & Diamond SmartTag E-Ink Updated!'
          : '✓ Check-In Risk Scored & Universal Digital Bag Tag Activated!'
      );
    } catch (err: unknown) {
      setNfcFeedback(err instanceof Error ? err.message : 'Check-in sync completed.');
    } finally {
      setIsSyncingNfc(false);
    }
  };

  const handlePassengerChoice = async (choice: 'EXPRESS_NEXT_FLIGHT' | 'DIRECT_HOTEL_DELIVERY') => {
    setIsChoosing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/${profile.tagNumber}/passenger/choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      if (res.ok) {
        const updated: LiveBagState = await res.json();
        setBag(updated);
      }
    } finally {
      setIsChoosing(false);
    }
  };

  const handleCompleteSelfBagDrop = async () => {
    setIsDroppingBag(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/${profile.tagNumber}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'CHECKED_IN',
          location_code: 'HKG-T1-SBD-04',
          station_name: 'HKIA Self Bag-Drop Counter 04',
          scanner_type: 'OPTICAL_BARCODE',
          notes: `Boarding pass, biometric face ID, digital barcode & ${profile.weight} kg scale verified`,
        }),
      });
      if (res.ok) {
        const updated: LiveBagState = await res.json();
        setBag(updated);
        setActiveTab('JOURNEY');
      }
    } finally {
      setIsDroppingBag(false);
    }
  };

  const currentFlight = bag?.flight_number || profile.defaultFlight;
  const origin = bag?.departure_airport || profile.origin;
  const destination = bag?.arrival_airport || profile.dest;
  const currentStatus = bag?.status || 'LOADED';
  const isRerouted = bag?.is_rush_bag || currentStatus === 'MISROUTED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandEyebrow}>CATHAY • BAGGAGE RECOVERY COPILOT</Text>
          <Text style={styles.headerGreeting}>Hello, {profile.displayName}</Text>
        </View>
        <View style={[styles.connPill, isLive ? styles.connPillLive : styles.connPillOffline]}>
          <Text style={[styles.connPillText, isLive ? styles.connTextLive : styles.connTextOffline]}>
            {isLive ? '● COPILOT LIVE' : '○ LOCAL'}
          </Text>
        </View>
      </View>

      <View style={styles.profileSwitcher}>
        {PASSENGER_PROFILES.map((p, idx) => (
          <TouchableOpacity
            key={p.tagNumber}
            style={[styles.profileChip, profileIdx === idx && styles.profileChipActive]}
            onPress={() => {
              setProfileIdx(idx);
              setNfcFeedback(null);
            }}
          >
            <Text style={[styles.profileChipText, profileIdx === idx && styles.profileChipTextActive]}>
              {p.displayName} ({p.isHardwareTag ? 'SmartTag' : 'Digital Tag'})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isRerouted && (
        <View style={styles.irropsBanner}>
          <Text style={styles.irropsTitle}>⚡ BAGGAGE RECOVERY COPILOT ALERT</Text>
          <Text style={styles.irropsBody}>
            Schedule disruption detected on {profile.tagNumber} ({currentFlight} {origin}→{destination}). Select your preferred recovery option:
          </Text>

          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[
                styles.choiceBtn,
                bag?.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT' && styles.choiceBtnSelected,
              ]}
              onPress={() => handlePassengerChoice('EXPRESS_NEXT_FLIGHT')}
              disabled={isChoosing}
            >
              <Text style={styles.choiceBtnText}>
                {bag?.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT'
                  ? `✓ Express Transfer (${currentFlight})`
                  : `Option A: Express Transfer (${currentFlight})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.choiceBtn,
                bag?.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY' && styles.choiceBtnSelected,
              ]}
              onPress={() => handlePassengerChoice('DIRECT_HOTEL_DELIVERY')}
              disabled={isChoosing}
            >
              <Text style={styles.choiceBtnText}>
                {bag?.passenger_recovery_choice === 'DIRECT_HOTEL_DELIVERY'
                  ? '✓ Direct Hotel Delivery'
                  : 'Option B: Deliver to Hotel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.tabRow}>
        {[
          { key: 'TRIP', label: '1. Check-In Sync' },
          { key: 'BAG_DROP', label: '2. Self Bag-Drop' },
          { key: 'JOURNEY', label: '3. Live Journey' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key as 'TRIP' | 'BAG_DROP' | 'JOURNEY')}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.flightCard}>
          <View style={styles.flightHeader}>
            <Text style={styles.pnrText}>PNR: {bag?.booking_reference || 'CX7K9M'}</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>{profile.tierLabel}</Text>
            </View>
          </View>

          <View style={styles.routeRow}>
            <View>
              <Text style={styles.iataCode}>{origin}</Text>
              <Text style={styles.cityLabel}>Hong Kong</Text>
            </View>
            <View style={styles.flightCenter}>
              <Text style={styles.flightNumText}>{currentFlight}</Text>
              <Text style={styles.planeIcon}>✈ ──────</Text>
              <Text style={styles.seatText}>Seat {bag?.seat_number || '12A'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.iataCode}>{destination}</Text>
              <Text style={styles.cityLabel}>{profile.cityDest}</Text>
            </View>
          </View>
        </View>

        <View style={styles.smartTagContainer}>
          <View style={styles.smartTagHeader}>
            <Text style={styles.smartTagTitle}>
              {profile.isHardwareTag
                ? 'OPTIONAL SMARTTAG E-INK INTERFACE'
                : 'UNIVERSAL DIGITAL APP BAG TAG'}
            </Text>
            <Text style={styles.smartTagMeta}>{profile.tagUid}</Text>
          </View>

          <View style={styles.einkScreen}>
            <View style={styles.einkTop}>
              <Text style={styles.einkFlight}>{currentFlight}</Text>
              <Text style={styles.einkDest}>{destination}</Text>
            </View>
            <View style={styles.einkRule} />
            <View style={styles.einkMetaRow}>
              <View>
                <Text style={styles.einkLabel}>IATA LICENSE PLATE</Text>
                <Text style={styles.einkVal}>{profile.tagNumber}</Text>
              </View>
              <View>
                <Text style={styles.einkLabel}>WEIGHT</Text>
                <Text style={styles.einkVal}>{bag?.weight_kg ?? profile.weight} KG</Text>
              </View>
              <View>
                <Text style={styles.einkLabel}>STATUS</Text>
                <Text style={styles.einkVal}>{currentStatus}</Text>
              </View>
            </View>
            <View style={styles.barcodeBox}>
              <Text style={styles.barcodeLines}>
                |||| || ||| | |||| ||| || | |||| ||| || ||| || |||| || |||
              </Text>
              <Text style={styles.barcodeNum}>{profile.tagNumber}</Text>
            </View>
            <View style={[styles.einkBannerBar, isRerouted && styles.einkBannerAlert]}>
              <Text style={styles.einkBannerText}>{bag?.eink_banner || 'ON TRACK'}</Text>
            </View>
          </View>
        </View>

        {activeTab === 'TRIP' && (
          <View style={styles.actionCard}>
            <Text style={styles.cardHeading}>Digital Check-In & Risk Evaluation</Text>
            <Text style={styles.cardSub}>
              {profile.isHardwareTag
                ? 'Triggers AI mishandling risk scoring at check-in and wirelessly updates your Diamond E-Ink SmartTag via NFC.'
                : 'Triggers AI mishandling risk scoring at check-in and activates your universal digital bag tag — no physical tag required.'}
            </Text>

            <TouchableOpacity style={styles.termsRow} onPress={() => setTermsAccepted(!termsAccepted)}>
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I confirm no restricted dangerous goods and agree to Cathay Baggage Copilot Terms.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, isSyncingNfc && styles.btnDisabled]}
              onPress={handleNfcSync}
              disabled={isSyncingNfc}
            >
              {isSyncingNfc ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {profile.isHardwareTag
                    ? '📲 Check-In & NFC Sync SmartTag'
                    : '📲 Check-In & Activate Digital Tag'}
                </Text>
              )}
            </TouchableOpacity>

            {nfcFeedback && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{nfcFeedback}</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'BAG_DROP' && (
          <View style={styles.actionCard}>
            <Text style={styles.cardHeading}>HKIA Self Bag-Drop Verification</Text>
            <Text style={styles.cardSub}>
              Skip paper tag printing kiosks completely. Place your bag on the drop belt:
            </Text>

            {[
              '1. Mobile Boarding Pass scanned',
              '2. HKIA Biometric Face Token verified',
              '3. Digital / E-Ink IATA Barcode optically read',
              `4. Scale weight logged (${bag?.weight_kg ?? profile.weight} kg)`,
            ].map((step, idx) => (
              <View key={idx} style={styles.checkRow}>
                <Text style={styles.checkMark}>✓</Text>
                <Text style={styles.checkLabel}>{step}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.primaryBtn, isDroppingBag && styles.btnDisabled]}
              onPress={handleCompleteSelfBagDrop}
              disabled={isDroppingBag}
            >
              {isDroppingBag ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Confirm Bag Drop & Dispatch</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'JOURNEY' && (
          <View style={styles.actionCard}>
            <View style={styles.journeyHeader}>
              <Text style={styles.cardHeading}>Real-Time Baggage Journey</Text>
              <Text style={styles.riskChip}>Copilot Risk: {bag?.risk_level || 'LOW'}</Text>
            </View>

            {(bag?.events || []).map((ev, index) => (
              <View key={ev.id || index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineEvent}>{ev.event_type}</Text>
                  <Text style={styles.timelineStation}>{ev.station_name}</Text>
                  {ev.notes ? <Text style={styles.timelineNotes}>{ev.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.background },
  topBar: {
    backgroundColor: colors.brand.jadePrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandEyebrow: { color: '#A7D7D6', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  headerGreeting: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 2 },
  connPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  connPillLive: { backgroundColor: '#E3FCEF' },
  connPillOffline: { backgroundColor: '#FFEBE6' },
  connPillText: { fontSize: 10, fontWeight: '700' },
  connTextLive: { color: '#006644' },
  connTextOffline: { color: '#BF2600' },
  profileSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#004D4C',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    gap: 8,
  },
  profileChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  profileChipActive: { backgroundColor: '#C49A45' },
  profileChipText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600' },
  profileChipTextActive: { color: '#0B2545', fontWeight: '700' },
  irropsBanner: { backgroundColor: '#B91C1C', padding: spacing.md },
  irropsTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  irropsBody: { color: '#FFFFFF', fontSize: 12, marginTop: 2 },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  choiceBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  choiceBtnSelected: { backgroundColor: '#006564', borderColor: '#E3FCEF' },
  choiceBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: colors.brand.jadePrimary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  tabTextActive: { color: colors.brand.jadePrimary, fontWeight: '700' },
  container: { padding: spacing.lg, paddingBottom: 40 },
  flightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  flightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pnrText: { fontSize: 11, fontWeight: '700', color: colors.text.secondary },
  tierBadge: { backgroundColor: colors.brand.goldLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tierText: { fontSize: 9, fontWeight: '800', color: '#7A5200' },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iataCode: { fontSize: 28, fontWeight: '800', color: colors.text.primary },
  cityLabel: { fontSize: 12, color: colors.text.secondary },
  flightCenter: { alignItems: 'center' },
  flightNumText: { fontSize: 14, fontWeight: '700', color: colors.brand.jadePrimary },
  planeIcon: { fontSize: 14, color: colors.text.muted, marginVertical: 2 },
  seatText: { fontSize: 11, color: colors.text.secondary },
  smartTagContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.md,
    marginBottom: spacing.md,
  },
  smartTagHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  smartTagTitle: { fontSize: 10, fontWeight: '800', color: colors.brand.jadePrimary },
  smartTagMeta: { fontSize: 10, fontWeight: '600', color: colors.text.muted },
  einkScreen: {
    backgroundColor: colors.eink.displayBackground,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  einkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  einkFlight: { fontSize: 24, fontWeight: '800', color: '#111111' },
  einkDest: { fontSize: 26, fontWeight: '800', color: colors.brand.jadePrimary },
  einkRule: { height: 2, backgroundColor: '#111111', marginVertical: 8 },
  einkMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  einkLabel: { fontSize: 9, fontWeight: '700', color: '#555555' },
  einkVal: { fontSize: 13, fontWeight: '700', color: '#111111', marginTop: 2 },
  barcodeBox: { alignItems: 'center', marginTop: 10, paddingVertical: 4 },
  barcodeLines: { fontSize: 16, fontWeight: '900', letterSpacing: 1, color: '#111111' },
  barcodeNum: { fontSize: 10, fontWeight: '700', color: '#111111', marginTop: 2 },
  einkBannerBar: {
    marginTop: 8,
    backgroundColor: '#111111',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
  },
  einkBannerAlert: { backgroundColor: '#8B0000' },
  einkBannerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.sm,
  },
  cardHeading: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
  cardSub: { fontSize: 13, color: colors.text.secondary, lineHeight: 19, marginBottom: 12 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.brand.jadePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.brand.jadePrimary },
  checkboxTick: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  termsText: { flex: 1, fontSize: 12, color: colors.text.secondary, lineHeight: 17 },
  primaryBtn: {
    backgroundColor: colors.brand.jadePrimary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  successBox: {
    backgroundColor: colors.status.successBackground,
    borderColor: colors.status.success,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: 12,
  },
  successText: { color: colors.status.success, fontSize: 12, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkMark: { color: colors.status.success, fontWeight: '800', marginRight: 8, fontSize: 14 },
  checkLabel: { fontSize: 13, color: colors.text.primary },
  journeyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  riskChip: {
    backgroundColor: colors.brand.jadeLight,
    color: colors.brand.jadePrimary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timelineItem: { flexDirection: 'row', marginBottom: 14 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand.jadePrimary,
    marginTop: 4,
    marginRight: 10,
  },
  timelineContent: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  timelineEvent: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  timelineStation: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  timelineNotes: { fontSize: 12, color: colors.text.primary, marginTop: 4 },
});
