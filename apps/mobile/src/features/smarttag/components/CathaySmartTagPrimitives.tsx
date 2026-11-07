/**
 * PolyAero Cathay SmartTag — Reusable UI Foundation Components (Phase 2)
 *
 * Implements the restrained Cathay design language from the five approved mockups:
 *   - `CathayScreenHeader`
 *   - `CathayPrimaryButton`
 *   - `CathaySecondaryButton`
 *   - `CathayCard`
 *   - `FlightSummaryCard`
 *   - `BaggageDetailsCard`
 *   - `StatusBadge`
 *   - `SmartTagIdentityCard`
 *   - `BaggageJourneyTimeline`
 *   - `SmartTagProgressIndicator`
 *   - `InlineNotice`
 *   - `SuitcaseWithTagGlyph` & `NfcPhoneToTagIllustration`
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BagSetupRecord,
  JourneyTimelineItem,
  NfcSyncMachineState,
  OwnedSmartTagDevice,
  PassengerItinerary,
  encodeInterleaved2Of5,
} from '@polyaero/shared';

// ---------------------------------------------------------------------------
// Palette Constants (Matched to Design 01–05 Mockups)
// ---------------------------------------------------------------------------

export const CATHAY_JADE = '#1C6258';
export const CATHAY_JADE_DARK = '#164E46';
export const CATHAY_MINT_SURFACE = '#E6F1EE';
export const CATHAY_MINT_BADGE = '#DCECE8';
export const CATHAY_WARM_CREAM = '#FBF7EF';
export const CATHAY_BG = '#F7F8F7';
export const CATHAY_TEXT_PRIMARY = '#181C1F';
export const CATHAY_TEXT_SECONDARY = '#5A6168';
export const CATHAY_TEXT_MUTED = '#767E85';
export const CATHAY_BORDER = '#ECEEEF';

export const cardShadowStyle: ViewStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

// ---------------------------------------------------------------------------
// 1. CathayScreenHeader
// ---------------------------------------------------------------------------

export interface CathayScreenHeaderProps {
  title: string;
  onBack?: () => void;
  onLongPressTitle?: () => void;
  backIcon?: 'arrow-back' | 'chevron-back';
}

export const CathayScreenHeader: React.FC<CathayScreenHeaderProps> = ({
  title,
  onBack,
  onLongPressTitle,
  backIcon = 'chevron-back',
}) => {
  return (
    <View style={styles.headerWrap}>
      {onBack ? (
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="smarttag-back-btn"
        >
          <Ionicons name={backIcon} size={24} color={CATHAY_JADE} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSideSpacer} />
      )}

      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPressTitle}
        disabled={!onLongPressTitle}
      >
        <Text style={styles.headerTitle}>{title}</Text>
      </TouchableOpacity>

      <View style={styles.headerSideSpacer} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// 2. CathayPrimaryButton & 3. CathaySecondaryButton
// ---------------------------------------------------------------------------

export interface CathayPrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
}

export const CathayPrimaryButton: React.FC<CathayPrimaryButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  testID,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        (disabled || loading) && styles.primaryBtnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

export interface CathaySecondaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'link' | 'rowChevron';
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}

export const CathaySecondaryButton: React.FC<CathaySecondaryButtonProps> = ({
  label,
  onPress,
  variant = 'outline',
  disabled = false,
  testID,
  style,
}) => {
  if (variant === 'link') {
    return (
      <TouchableOpacity
        style={[styles.linkBtn, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
        testID={testID}
      >
        <Text style={styles.linkBtnText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'rowChevron') {
    return (
      <TouchableOpacity
        style={[styles.rowChevronBtn, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
        testID={testID}
      >
        <Text style={styles.rowChevronText}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color="#374151" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.outlineBtn, disabled && styles.primaryBtnDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      testID={testID}
    >
      <Text style={styles.outlineBtnText}>{label}</Text>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// 4. CathayCard
// ---------------------------------------------------------------------------

export const CathayCard: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

// ---------------------------------------------------------------------------
// 5. StatusBadge
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  label: string;
  tone?: 'jade' | 'amber' | 'red' | 'neutral';
  showClockIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone = 'neutral',
  showClockIcon = false,
}) => {
  const bg =
    tone === 'jade'
      ? CATHAY_MINT_BADGE
      : tone === 'amber'
        ? '#FEF3C7'
        : tone === 'red'
          ? '#FEE2E2'
          : '#EFEFEF';
  const fg =
    tone === 'jade'
      ? CATHAY_JADE
      : tone === 'amber'
        ? '#92400E'
        : tone === 'red'
          ? '#991B1B'
          : '#374151';

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      {showClockIcon && (
        <Ionicons name="time-outline" size={14} color={fg} style={styles.badgeIcon} />
      )}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Custom Suitcase-with-Luggage-Tag Glyph (Matches Design 01, 02, 04)
// ---------------------------------------------------------------------------

export const SuitcaseWithTagGlyph: React.FC<{ size?: 'lg' | 'sm' }> = ({
  size = 'lg',
}) => {
  const boxSize = size === 'lg' ? 68 : 44;
  const bodyW = size === 'lg' ? 30 : 21;
  const bodyH = size === 'lg' ? 34 : 24;
  const handleW = size === 'lg' ? 14 : 10;
  const handleH = size === 'lg' ? 6 : 4;

  return (
    <View
      style={[
        styles.suitcaseTile,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: size === 'lg' ? 12 : 9,
        },
      ]}
    >
      {/* Top luggage handle */}
      <View
        style={{
          width: handleW,
          height: handleH,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderWidth: 1.8,
          borderBottomWidth: 0,
          borderColor: CATHAY_JADE_DARK,
          marginBottom: -1,
        }}
      />
      {/* Suitcase body */}
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderRadius: 5,
          borderWidth: 1.8,
          borderColor: CATHAY_JADE_DARK,
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingRight: size === 'lg' ? 4 : 2,
        }}
      >
        {/* Hanging SmartTag luggage tag inside suitcase outline */}
        <View
          style={{
            width: size === 'lg' ? 11 : 8,
            height: size === 'lg' ? 16 : 11,
            borderRadius: 2,
            borderWidth: 1.5,
            borderColor: CATHAY_JADE_DARK,
            backgroundColor: CATHAY_MINT_SURFACE,
            transform: [{ rotate: '-14deg' }],
            alignItems: 'center',
            paddingTop: 2,
          }}
        >
          <View
            style={{
              width: 2.5,
              height: 2.5,
              borderRadius: 1.5,
              backgroundColor: CATHAY_JADE_DARK,
            }}
          />
        </View>
      </View>
      {/* Tiny wheels */}
      <View style={{ flexDirection: 'row', width: bodyW - 8, justifyContent: 'space-between', marginTop: 1 }}>
        <View style={{ width: 3, height: 2, backgroundColor: CATHAY_JADE_DARK, borderRadius: 1 }} />
        <View style={{ width: 3, height: 2, backgroundColor: CATHAY_JADE_DARK, borderRadius: 1 }} />
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// 6. FlightSummaryCard (Shared across Designs 01, 02, 05)
// ---------------------------------------------------------------------------

export interface FlightSummaryCardProps {
  itinerary: PassengerItinerary;
  /** Optional header override for Journey screen (shows Bag ID + StatusBadge instead of Date + PNR) */
  bagHeader?: {
    displayBagCode: string;
    statusLabel: string;
    statusTone: 'jade' | 'amber' | 'red' | 'neutral';
  };
  showPassengerCount?: boolean;
  children?: React.ReactNode;
}

export const FlightSummaryCard: React.FC<FlightSummaryCardProps> = ({
  itinerary,
  bagHeader,
  showPassengerCount = true,
  children,
}) => {
  const { flight, booking, travelDateDisplay, passengerCount } = itinerary;

  return (
    <CathayCard style={styles.flightCard}>
      {/* Top metadata row: Either Date + Booking ref (Design 01/02) or Bag ID + Status pill (Design 05) */}
      {bagHeader ? (
        <View style={styles.flightTopMetaRow}>
          <Text style={styles.bagHeaderLabel}>
            Bag ID{'  '}
            <Text style={styles.bagHeaderCode}>{bagHeader.displayBagCode}</Text>
          </Text>
          <StatusBadge label={bagHeader.statusLabel} tone={bagHeader.statusTone} />
        </View>
      ) : (
        <View style={styles.flightTopMetaRow}>
          <Text style={styles.flightDateText}>{travelDateDisplay}</Text>
          <View style={styles.bookingRefRow}>
            <Text style={styles.bookingRefCaption}>Booking reference{'  '}</Text>
            <Text style={styles.bookingRefValue}>{booking.bookingReference}</Text>
          </View>
        </View>
      )}

      {/* Airport route row: HKG  (plane)  NRT */}
      <View style={styles.routeMainRow}>
        <View style={styles.airportColLeft}>
          <Text style={styles.airportIataText}>{flight.origin}</Text>
          <Text style={styles.airportCityText}>{flight.originCity}</Text>
        </View>

        <View style={styles.planeCircleWrap}>
          <View style={styles.planeCircle}>
            <Ionicons name="airplane" size={16} color={CATHAY_JADE} />
          </View>
        </View>

        <View style={styles.airportColRight}>
          <Text style={styles.airportIataText}>{flight.destination}</Text>
          <Text style={styles.airportCityText}>{flight.destinationCity}</Text>
        </View>
      </View>

      {/* Flight number & passenger count row */}
      <View style={styles.flightMetaSubRow}>
        <View style={styles.flightMetaItem}>
          <Ionicons
            name="airplane-outline"
            size={15}
            color="#5A6168"
            style={{ transform: [{ rotate: '-25deg' }] }}
          />
          <Text style={styles.flightMetaText}>{flight.flightNumber}</Text>
        </View>

        <View style={styles.verticalDivider} />

        {showPassengerCount && (
          <View style={styles.flightMetaItem}>
            <Ionicons name="person-outline" size={15} color="#5A6168" />
            <Text style={styles.flightMetaText}>
              {passengerCount} {passengerCount === 1 ? 'passenger' : 'passengers'}
            </Text>
          </View>
        )}
      </View>

      {children}
    </CathayCard>
  );
};

// ---------------------------------------------------------------------------
// 7. BaggageDetailsCard (Design 02 — Prepare SmartTag Section B)
// ---------------------------------------------------------------------------

export interface BaggageDetailsCardProps {
  bagCount: number;
  maxBags: number;
  selectedSmartTagCode: string;
  ownedTags: OwnedSmartTagDevice[];
  syncStatusLabel: string;
  syncStatusTone: 'jade' | 'amber' | 'red' | 'neutral';
  onCycleBagCount: () => void;
  onSelectSmartTagCode?: (code: string) => void;
}

export const BaggageDetailsCard: React.FC<BaggageDetailsCardProps> = ({
  bagCount,
  selectedSmartTagCode,
  ownedTags,
  syncStatusLabel,
  syncStatusTone,
  onCycleBagCount,
  onSelectSmartTagCode,
}) => {
  return (
    <CathayCard style={styles.sectionCard}>
      <View style={styles.cardIconHeadingRow}>
        <SuitcaseWithTagGlyph size="sm" />
        <Text style={styles.cardSectionHeading}>Baggage details</Text>
      </View>

      {/* Row 1: Number of bags */}
      <TouchableOpacity
        style={styles.detailRow}
        onPress={onCycleBagCount}
        activeOpacity={0.7}
        testID="row-bag-count"
      >
        <Text style={styles.detailLabel}>Number of bags</Text>
        <View style={styles.detailValueRight}>
          <Text style={styles.detailValueJade}>
            {bagCount} {bagCount === 1 ? 'checked bag' : 'checked bags'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#374151" />
        </View>
      </TouchableOpacity>

      <View style={styles.hairline} />

      {/* Row 2: SmartTag ID */}
      <TouchableOpacity
        style={styles.detailRow}
        onPress={() => {
          if (!onSelectSmartTagCode || ownedTags.length < 2) return;
          const next = ownedTags.find((t) => t.smartTagCode !== selectedSmartTagCode);
          if (next) onSelectSmartTagCode(next.smartTagCode);
        }}
        activeOpacity={0.75}
        testID="row-smarttag-id"
      >
        <Text style={styles.detailLabel}>SmartTag ID</Text>
        <Text style={styles.detailValueJade}>
          {bagCount === 1
            ? selectedSmartTagCode
            : ownedTags
                .slice(0, bagCount)
                .map((t) => t.smartTagCode)
                .join(', ')}
        </Text>
      </TouchableOpacity>

      <View style={styles.hairline} />

      {/* Row 3: Check-in status */}
      <View style={[styles.detailRow, { paddingBottom: 2 }]}>
        <Text style={styles.detailLabel}>Check-in status</Text>
        <StatusBadge
          label={syncStatusLabel}
          tone={syncStatusTone}
          showClockIcon={syncStatusTone === 'neutral' || syncStatusTone === 'amber'}
        />
      </View>
    </CathayCard>
  );
};

// ---------------------------------------------------------------------------
// 8. NfcPhoneToTagIllustration (Design 03 — Sync SmartTag Section A)
// ---------------------------------------------------------------------------

export const NfcPhoneToTagIllustration: React.FC<{
  activeState: NfcSyncMachineState;
}> = ({ activeState }) => {
  const isPulsing =
    activeState === 'SCANNING' ||
    activeState === 'TAG_DETECTED' ||
    activeState === 'WRITING' ||
    activeState === 'VERIFYING';

  return (
    <View style={styles.illustrationBanner}>
      <View style={styles.illustrationStage}>
        {/* Tilted Smartphone Outline */}
        <View style={styles.phoneWrap}>
          <View style={styles.phoneBody}>
            <View style={styles.phoneNotch} />
            <Ionicons
              name="airplane"
              size={20}
              color={CATHAY_JADE}
              style={{ transform: [{ rotate: '-35deg' }] }}
            />
          </View>
          <View style={styles.illustrationShadowOval} />
        </View>

        {/* NFC Wave Arcs */}
        <View style={styles.nfcWavesWrap}>
          <View
            style={[
              styles.nfcArc,
              styles.nfcArcSmall,
              isPulsing && styles.nfcArcActive,
            ]}
          />
          <View
            style={[
              styles.nfcArc,
              styles.nfcArcMedium,
              isPulsing && styles.nfcArcActive,
            ]}
          />
          <View
            style={[
              styles.nfcArc,
              styles.nfcArcLarge,
              isPulsing && styles.nfcArcActive,
            ]}
          />
        </View>

        {/* Physical SmartTag E-ink Enclosure */}
        <View style={styles.tagEnclosureWrap}>
          <View style={styles.tagEnclosureBody}>
            <View style={styles.tagHoleDot} />
            <Ionicons
              name="airplane"
              size={17}
              color={CATHAY_JADE}
              style={{ transform: [{ rotate: '-35deg' }] }}
            />
          </View>
          <View style={styles.illustrationShadowOval} />
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// 9. SmartTagIdentityCard (Design 03 "What will be written" & Design 04 "Tag details")
// ---------------------------------------------------------------------------

export interface SmartTagIdentityCardProps {
  variant: 'preview' | 'ready';
  itinerary: PassengerItinerary;
  bag: BagSetupRecord;
  showMonochromeEinkPreview?: boolean;
}

export const SmartTagIdentityCard: React.FC<SmartTagIdentityCardProps> = ({
  variant,
  itinerary,
  bag,
  showMonochromeEinkPreview = false,
}) => {
  const { flight } = itinerary;
  const barcodeModules = React.useMemo(
    () => encodeInterleaved2Of5(bag.baggage.tagNumber),
    [bag.baggage.tagNumber]
  );

  if (variant === 'preview') {
    const statusText =
      bag.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED'
        ? 'Verified on SmartTag'
        : bag.setupState === 'SIMULATED_WRITE_COMPLETED'
          ? 'Simulated — Ready for bag-drop'
          : 'Ready for bag-drop';

    return (
      <CathayCard style={styles.sectionCard}>
        <Text style={styles.previewCardHeading}>What will be written</Text>

        <View style={styles.previewRow}>
          <View style={styles.previewRowLeft}>
            <Ionicons
              name="airplane-outline"
              size={16}
              color="#5A6168"
              style={{ transform: [{ rotate: '-25deg' }] }}
            />
            <Text style={styles.detailLabel}>Route</Text>
          </View>
          <Text style={styles.detailValueJade}>
            {flight.origin} → {flight.destination}
          </Text>
        </View>

        <View style={styles.hairline} />

        <View style={styles.previewRow}>
          <View style={styles.previewRowLeft}>
            <Ionicons name="ticket-outline" size={16} color="#5A6168" />
            <Text style={styles.detailLabel}>Flight</Text>
          </View>
          <Text style={styles.detailValueJade}>{flight.flightNumber}</Text>
        </View>

        <View style={styles.hairline} />

        <View style={styles.previewRow}>
          <View style={styles.previewRowLeft}>
            <Ionicons name="briefcase-outline" size={16} color="#5A6168" />
            <Text style={styles.detailLabel}>Bag ID</Text>
          </View>
          <Text style={styles.detailValueJade}>{bag.displayBagCode}</Text>
        </View>

        <View style={styles.hairline} />

        <View style={[styles.previewRow, { paddingBottom: showMonochromeEinkPreview ? 10 : 2 }]}>
          <View style={styles.previewRowLeft}>
            <Ionicons name="checkbox-outline" size={16} color="#5A6168" />
            <Text style={styles.detailLabel}>Status</Text>
          </View>
          <Text style={styles.detailValueJade}>{statusText}</Text>
        </View>

        {showMonochromeEinkPreview && (
          <View style={styles.einkPreviewBox}>
            <View style={styles.einkMetaTopRow}>
              <Text style={styles.einkMetaLabel}>
                2.9&quot; E-INK MONOCHROME PREVIEW (296×128)
              </Text>
              <Text style={styles.einkMetaLabel}>{bag.smartTagCode}</Text>
            </View>
            <View style={styles.einkScreenFrame}>
              <View style={styles.einkRouteBar}>
                <Text style={styles.einkRouteStrong}>
                  {flight.origin} → {flight.destination}
                </Text>
                <Text style={styles.einkFlightStrong}>{flight.flightNumber}</Text>
              </View>
              <View style={styles.barcodeRow}>
                {barcodeModules.map((m, idx) => (
                  <View
                    key={idx}
                    style={{
                      height: 26,
                      flex: m.widthUnits,
                      backgroundColor: m.isBar ? '#111111' : 'transparent',
                    }}
                  />
                ))}
              </View>
              <Text style={styles.einkLicenseDigits}>
                IATA LP {bag.baggage.tagNumber} • {bag.displayBagCode}
              </Text>
            </View>
          </View>
        )}
      </CathayCard>
    );
  }

  // Variant: 'ready' (Design 04 — Tag details card)
  const writeStatusLabel =
    bag.setupState === 'PHYSICALLY_WRITTEN_AND_VERIFIED'
      ? 'Awaiting bag-drop'
      : 'Awaiting bag-drop';

  return (
    <CathayCard style={styles.sectionCard}>
      <View style={styles.cardIconHeadingRow}>
        <SuitcaseWithTagGlyph size="sm" />
        <Text style={styles.cardSectionHeading}>Tag details</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Bag ID</Text>
        <Text style={styles.detailValueJade}>{bag.displayBagCode}</Text>
      </View>

      <View style={styles.hairline} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Route</Text>
        <Text style={styles.detailValueJade}>
          {flight.origin} → {flight.destination}
        </Text>
      </View>

      <View style={styles.hairline} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Flight</Text>
        <Text style={styles.detailValueJade}>{flight.flightNumber}</Text>
      </View>

      <View style={styles.hairline} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>SmartTag ID</Text>
        <Text style={styles.detailValueJade}>
          {bag.smartTagCode} ({bag.baggage.tagNumber})
        </Text>
      </View>

      <View style={styles.hairline} />

      <View style={[styles.detailRow, { paddingBottom: 2 }]}>
        <Text style={styles.detailLabel}>Status</Text>
        <Text style={styles.detailValueJade}>{writeStatusLabel}</Text>
      </View>
    </CathayCard>
  );
};

// ---------------------------------------------------------------------------
// 10. SmartTagProgressIndicator (Screen 03 NFC Sync State Banner)
// ---------------------------------------------------------------------------

export const SmartTagProgressIndicator: React.FC<{
  state: NfcSyncMachineState;
  message: string;
  isSimulated: boolean;
  onCancel?: () => void;
}> = ({ state, message, isSimulated, onCancel }) => {
  if (state === 'IDLE') return null;

  const isBusy =
    state === 'CHECKING_AVAILABILITY' ||
    state === 'READY_TO_SCAN' ||
    state === 'SCANNING' ||
    state === 'TAG_DETECTED' ||
    state === 'WRITING' ||
    state === 'VERIFYING';

  const toneBg =
    state === 'SUCCESS'
      ? CATHAY_MINT_SURFACE
      : state === 'FAILED' || state === 'UNSUPPORTED'
        ? '#FEF2F2'
        : '#F3F6F5';

  const toneColor =
    state === 'SUCCESS'
      ? CATHAY_JADE
      : state === 'FAILED' || state === 'UNSUPPORTED'
        ? '#991B1B'
        : CATHAY_TEXT_PRIMARY;

  return (
    <View style={[styles.progressStrip, { backgroundColor: toneBg }]}>
      <View style={styles.progressLeft}>
        {isBusy ? (
          <ActivityIndicator size="small" color={CATHAY_JADE} />
        ) : (
          <Ionicons
            name={
              state === 'SUCCESS'
                ? 'checkmark-circle'
                : state === 'CANCELLED'
                  ? 'close-circle-outline'
                  : 'alert-circle-outline'
            }
            size={18}
            color={toneColor}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.progressText, { color: toneColor }]}>{message}</Text>
          {isSimulated && (
            <Text style={styles.progressSimBadge}>DEMO SIMULATION MODE</Text>
          )}
        </View>
      </View>
      {isBusy && onCancel && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelScanLink}>
          <Text style={styles.cancelScanLinkText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 11. BaggageJourneyTimeline (Design 05 — Chronological Handling Timeline)
// ---------------------------------------------------------------------------

export const BaggageJourneyTimeline: React.FC<{
  items: JourneyTimelineItem[];
}> = ({ items }) => {
  return (
    <View style={styles.timelineContainer}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const isDone = item.state === 'completed';
        const isCurrent = item.state === 'current';
        const isException = item.state === 'exception' || item.state === 'delayed';

        const nextDone = !isLast && items[idx + 1]?.state === 'completed';

        return (
          <View key={item.key} style={styles.timelineRow}>
            {/* Left indicator column */}
            <View style={styles.timelineNodeCol}>
              {isDone ? (
                <View style={styles.nodeCircleDone}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              ) : isException ? (
                <View style={styles.nodeCircleException}>
                  <Ionicons name="alert" size={14} color="#FFFFFF" />
                </View>
              ) : isCurrent ? (
                <View style={styles.nodeCircleCurrent}>
                  <View style={styles.nodeInnerDotCurrent} />
                </View>
              ) : (
                <View style={styles.nodeCirclePending} />
              )}

              {!isLast && (
                <View
                  style={[
                    styles.timelineConnector,
                    (isDone || nextDone) && styles.timelineConnectorActive,
                  ]}
                />
              )}
            </View>

            {/* Right content column */}
            <View style={[styles.timelineContentCol, isLast && { borderBottomWidth: 0 }]}>
              <Text style={styles.timelineTitle}>{item.title}</Text>
              <Text
                style={[
                  styles.timelineSubtitle,
                  isException && { color: '#B91C1C', fontWeight: '500' },
                ]}
              >
                {item.subtitle}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 12. InlineNotice
// ---------------------------------------------------------------------------

export const InlineNotice: React.FC<{
  title?: string;
  message: string;
  tone?: 'info' | 'warning' | 'danger' | 'demo';
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}> = ({
  title,
  message,
  tone = 'info',
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  const bg =
    tone === 'danger'
      ? '#FEF2F2'
      : tone === 'warning'
        ? '#FFFBEB'
        : tone === 'demo'
          ? CATHAY_WARM_CREAM
          : CATHAY_MINT_SURFACE;
  const border =
    tone === 'danger'
      ? '#FECACA'
      : tone === 'warning'
        ? '#FDE68A'
        : tone === 'demo'
          ? '#EFE6D5'
          : '#CFE3DE';
  const iconColor =
    tone === 'danger'
      ? '#B91C1C'
      : tone === 'warning'
        ? '#B45309'
        : CATHAY_JADE;

  return (
    <View style={[styles.noticeBox, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.noticeTopRow}>
        <Ionicons
          name={
            tone === 'danger'
              ? 'alert-circle-outline'
              : tone === 'warning'
                ? 'warning-outline'
                : 'information-circle-outline'
          }
          size={18}
          color={iconColor}
          style={{ marginTop: 1 }}
        />
        <View style={{ flex: 1 }}>
          {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      </View>

      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.noticeActionsRow}>
          {actionLabel && onAction && (
            <TouchableOpacity style={styles.noticeActionBtn} onPress={onAction}>
              <Text style={styles.noticeActionBtnText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <TouchableOpacity
              style={[styles.noticeActionBtn, styles.noticeSecondaryBtn]}
              onPress={onSecondaryAction}
            >
              <Text style={styles.noticeSecondaryBtnText}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrap: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  headerSideSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.2,
  },

  primaryBtn: {
    backgroundColor: CATHAY_JADE,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.48,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  outlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7B8B5',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: CATHAY_JADE,
    fontSize: 15.5,
    fontWeight: '600',
  },

  linkBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnText: {
    color: CATHAY_JADE,
    fontSize: 15,
    fontWeight: '500',
  },

  rowChevronBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 2,
  },
  rowChevronText: {
    color: CATHAY_JADE,
    fontSize: 15,
    fontWeight: '500',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F2F2',
    ...cardShadowStyle,
  },

  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeIcon: {
    marginRight: 5,
  },
  badgeText: {
    fontSize: 12.5,
    fontWeight: '600',
  },

  suitcaseTile: {
    backgroundColor: CATHAY_MINT_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  flightCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  flightTopMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flightDateText: {
    fontSize: 14,
    color: '#2B3035',
    fontWeight: '400',
  },
  bookingRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingRefCaption: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
  },
  bookingRefValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: CATHAY_JADE,
  },
  bagHeaderLabel: {
    fontSize: 14,
    color: '#2B3035',
  },
  bagHeaderCode: {
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
  },

  routeMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  airportColLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  airportColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  airportIataText: {
    fontSize: 28,
    fontWeight: '700',
    color: CATHAY_JADE,
    letterSpacing: -0.4,
  },
  airportCityText: {
    fontSize: 13.5,
    color: '#3B4148',
    marginTop: 2,
  },
  planeCircleWrap: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F7F6',
    borderWidth: 1,
    borderColor: '#E3ECEA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  flightMetaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  flightMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  flightMetaText: {
    fontSize: 13.5,
    color: '#3B4148',
  },
  verticalDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E6E8',
    marginHorizontal: 18,
  },

  sectionCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardIconHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardSectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  previewCardHeading: {
    fontSize: 16.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  previewRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: 14.5,
    color: '#4B5259',
  },
  detailValueRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValueJade: {
    fontSize: 14.5,
    fontWeight: '600',
    color: CATHAY_JADE,
  },
  hairline: {
    height: 1,
    backgroundColor: CATHAY_BORDER,
  },

  illustrationBanner: {
    backgroundColor: CATHAY_MINT_SURFACE,
    borderRadius: 14,
    height: 166,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  illustrationStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  phoneWrap: {
    alignItems: 'center',
  },
  phoneBody: {
    width: 66,
    height: 118,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: CATHAY_JADE_DARK,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
  },
  phoneNotch: {
    position: 'absolute',
    top: 7,
    width: 20,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: CATHAY_JADE_DARK,
  },
  nfcWavesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginHorizontal: 2,
  },
  nfcArc: {
    borderRightWidth: 2.5,
    borderTopWidth: 2.5,
    borderBottomWidth: 2.5,
    borderLeftWidth: 0,
    borderColor: '#8FB9B2',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  nfcArcSmall: {
    width: 6,
    height: 16,
  },
  nfcArcMedium: {
    width: 8,
    height: 26,
  },
  nfcArcLarge: {
    width: 10,
    height: 36,
  },
  nfcArcActive: {
    borderColor: CATHAY_JADE,
  },
  tagEnclosureWrap: {
    alignItems: 'center',
  },
  tagEnclosureBody: {
    width: 86,
    height: 58,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CATHAY_JADE_DARK,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tagHoleDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8FB9B2',
  },
  illustrationShadowOval: {
    width: 56,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(22, 78, 70, 0.10)',
    marginTop: 10,
  },

  einkPreviewBox: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CATHAY_BORDER,
  },
  einkMetaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  einkMetaLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: CATHAY_TEXT_MUTED,
    letterSpacing: 0.3,
  },
  einkScreenFrame: {
    backgroundColor: '#F3F2EE',
    borderWidth: 1.5,
    borderColor: '#2B3035',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  einkRouteBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2B3035',
    paddingBottom: 4,
    marginBottom: 6,
  },
  einkRouteStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  einkFlightStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    marginVertical: 2,
  },
  einkLicenseDigits: {
    fontSize: 10.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: '#111111',
    textAlign: 'center',
    marginTop: 4,
  },

  progressStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 10,
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  progressText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  progressSimBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 2,
  },
  cancelScanLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelScanLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },

  timelineContainer: {
    marginTop: 4,
    paddingHorizontal: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineNodeCol: {
    width: 30,
    alignItems: 'center',
  },
  nodeCircleDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: CATHAY_JADE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  nodeCircleException: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  nodeCircleCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CATHAY_JADE,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  nodeInnerDotCurrent: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CATHAY_JADE,
  },
  nodeCirclePending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: '#B8BFC6',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  timelineConnector: {
    width: 1.8,
    flex: 1,
    backgroundColor: '#CBD2D9',
    marginVertical: 2,
  },
  timelineConnectorActive: {
    backgroundColor: CATHAY_JADE,
  },
  timelineContentCol: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 11,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CATHAY_BORDER,
  },
  timelineTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  timelineSubtitle: {
    fontSize: 13.5,
    color: CATHAY_TEXT_SECONDARY,
    marginTop: 3,
  },

  noticeBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  noticeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  noticeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  noticeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    marginLeft: 27,
  },
  noticeActionBtn: {
    backgroundColor: CATHAY_JADE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  noticeActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  noticeSecondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CATHAY_JADE,
  },
  noticeSecondaryBtnText: {
    color: CATHAY_JADE,
    fontSize: 12.5,
    fontWeight: '600',
  },
});
