/**
 * PolyAero Cathay SmartTag — Reusable UI Foundation Components (Phase 2)
 *
 * Uses authentic Cathay Pacific design tokens and extracted high-resolution
 * artwork assets (`icon-suitcase-tag.png`, `illustration-nfc-sync.png`,
 * `icon-plane-takeoff.png`, `icon-req-*.png`, `icon-step-*.png`).
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
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

const BRUSHWING_WHITE = require('../../../../assets/cathay/cathay-brushwing-white.png');
export const ICON_SUITCASE_TAG = require('../../../../assets/cathay/smarttag/icon-suitcase-tag.png');
export const ICON_PLANE_TAKEOFF = require('../../../../assets/cathay/smarttag/icon-plane-takeoff.png');
export const ILLUSTRATION_NFC_SYNC = require('../../../../assets/cathay/smarttag/illustration-nfc-sync.png');
export const ICON_REQ_WARNING = require('../../../../assets/cathay/smarttag/icon-req-warning.png');
export const ICON_REQ_KIOSK = require('../../../../assets/cathay/smarttag/icon-req-kiosk.png');
export const ICON_REQ_TAG = require('../../../../assets/cathay/smarttag/icon-req-tag.png');
export const ICON_STEP_TAG = require('../../../../assets/cathay/smarttag/icon-step-tag.png');
export const ICON_STEP_QR = require('../../../../assets/cathay/smarttag/icon-step-qr.png');
export const ICON_STEP_BELT = require('../../../../assets/cathay/smarttag/icon-step-belt.png');

// Handoff Premium V3 Assets
export const SMARTTAG_ENTRY_ART = require('../../../../assets/smarttag-design/illustrations/smarttag_entry_art.png');
export const NFC_PHONE_TAG_SCENE = require('../../../../assets/smarttag-design/illustrations/nfc_phone_tag_scene.png');
export const SMARTTAG_SUCCESS_ART = require('../../../../assets/smarttag-design/illustrations/smarttag_success_art.png');
export const BOOKING_JADE_WAVE = require('../../../../assets/smarttag-design/surfaces/booking_jade_wave_2x.png');
export const HEADER_SOFT_MINT_WAVE = require('../../../../assets/smarttag-design/surfaces/header_soft_mint_wave_2x.png');
export const NFC_HALO = require('../../../../assets/smarttag-design/surfaces/nfc_halo_2x.png');
export const STATUS_JADE_WAVE = require('../../../../assets/smarttag-design/surfaces/status_jade_wave_2x.png');
export const CONCEPT_BRUSHWING = require('../../../../assets/smarttag-design/icons/concept_brushwing_extracted.png');
export const ICON_CATHAY_SUITCASE = require('../../../../assets/cathay/smarttag/icon-cathay-suitcase.png');

// ---------------------------------------------------------------------------
// Authentic Cathay Pacific Design System Tokens
// ---------------------------------------------------------------------------

export const CATHAY_JADE = '#195A58';
export const CATHAY_JADE_LIGHT = '#1C6258';
export const CATHAY_JADE_DARK = '#164E46';
export const CATHAY_MINT_SURFACE = '#EAF3F2';
export const CATHAY_MINT_BADGE = '#DCECE8';
export const CATHAY_WARM_CREAM = '#FAF5EA';
export const CATHAY_WARM_BORDER = '#EDE4D3';
export const CATHAY_BG = '#F6F7F7';
export const CATHAY_TEXT_PRIMARY = '#1C2024';
export const CATHAY_TEXT_SECONDARY = '#52565A';
export const CATHAY_TEXT_MUTED = '#76777A';
export const CATHAY_BORDER = '#ECEEEF';

export const CATHAY_FONT_FAMILY = Platform.select({
  ios: undefined,
  android: 'sans-serif',
  default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});

export const CATHAY_SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", Garamond, serif',
});

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
        <Ionicons name="chevron-forward" size={18} color="#2C3034" />
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
        ? '#F4EFE4'
        : tone === 'red'
          ? '#FDE8E8'
          : '#EFEFEF';
  const fg =
    tone === 'jade'
      ? CATHAY_JADE
      : tone === 'amber'
        ? '#785D2A'
        : tone === 'red'
          ? '#9B1C1C'
          : '#3B4148';

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      {showClockIcon && (
        <Ionicons name="time-outline" size={13.5} color={fg} style={styles.badgeIcon} />
      )}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Authentic Suitcase-with-SmartTag Icon Tile (Cropped High-Res Vector Asset)
// ---------------------------------------------------------------------------

export const SuitcaseWithTagGlyph: React.FC<{ size?: 'lg' | 'sm' }> = ({
  size = 'lg',
}) => {
  const boxSize = size === 'lg' ? 68 : 44;
  const imgW = size === 'lg' ? 38 : 26;
  const imgH = size === 'lg' ? 40 : 27;

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
      <Image
        source={ICON_SUITCASE_TAG}
        style={{ width: imgW, height: imgH }}
        resizeMode="contain"
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// 6. FlightSummaryCard (Shared across Designs 01, 02, 05)
// ---------------------------------------------------------------------------

export interface FlightSummaryCardProps {
  itinerary: PassengerItinerary;
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
          <Image
            source={ICON_PLANE_TAKEOFF}
            style={styles.takeoffPlaneIcon}
            resizeMode="contain"
          />
          <Text style={styles.flightMetaText}>{flight.flightNumber}</Text>
        </View>

        {showPassengerCount && (
          <>
            <View style={styles.verticalDivider} />
            <View style={styles.flightMetaItem}>
              <Ionicons name="person-outline" size={15} color={CATHAY_TEXT_SECONDARY} />
              <Text style={styles.flightMetaText}>
                {passengerCount} {passengerCount === 1 ? 'passenger' : 'passengers'}
              </Text>
            </View>
          </>
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
          <Text style={styles.detailValueInteractive}>
            {bagCount} {bagCount === 1 ? 'checked bag' : 'checked bags'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#2C3034" />
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
        <Text style={styles.detailValueInteractive}>
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
// 8. NfcPhoneToTagIllustration (Design 03 — Authentic High-Res Artwork)
// ---------------------------------------------------------------------------

export const NfcPhoneToTagIllustration: React.FC<{
  activeState: NfcSyncMachineState;
}> = () => {
  return (
    <View style={styles.illustrationBanner}>
      <Image
        source={ILLUSTRATION_NFC_SYNC}
        style={styles.illustrationHeroImg}
        resizeMode="contain"
      />
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
        : 'Ready for bag-drop';

    return (
      <CathayCard style={styles.sectionCard}>
        <Text style={styles.previewCardHeading}>What will be written</Text>

        <View style={styles.previewRow}>
          <View style={styles.previewRowLeft}>
            <Image
              source={ICON_PLANE_TAKEOFF}
              style={styles.takeoffPlaneIcon}
              resizeMode="contain"
            />
            <Text style={styles.detailLabel}>Route</Text>
          </View>
          <Text style={styles.detailValueInteractive}>
            {flight.origin} → {flight.destination}
          </Text>
        </View>

        <View style={styles.hairline} />

        <View style={styles.previewRow}>
          <View style={styles.previewRowLeft}>
            <Ionicons name="ticket-outline" size={16} color={CATHAY_TEXT_SECONDARY} />
            <Text style={styles.detailLabel}>Flight</Text>
          </View>
          <Text style={styles.detailValueInteractive}>{flight.flightNumber}</Text>
        </View>

        <View style={styles.hairline} />

        <View style={styles.previewRow}>
          <View style={styles.previewRowLeft}>
            <Ionicons name="briefcase-outline" size={16} color={CATHAY_TEXT_SECONDARY} />
            <Text style={styles.detailLabel}>Bag ID</Text>
          </View>
          <Text style={styles.detailValueInteractive}>{bag.displayBagCode}</Text>
        </View>

        <View style={styles.hairline} />

        <View style={[styles.previewRow, { paddingBottom: showMonochromeEinkPreview ? 10 : 2 }]}>
          <View style={styles.previewRowLeft}>
            <Ionicons name="checkbox-outline" size={16} color={CATHAY_TEXT_SECONDARY} />
            <Text style={styles.detailLabel}>Status</Text>
          </View>
          <Text style={styles.detailValueInteractive}>{statusText}</Text>
        </View>

        {showMonochromeEinkPreview && (
          <View style={styles.einkPreviewBox}>
            <View style={styles.einkMetaTopRow}>
              <Text style={styles.einkMetaLabel}>
                E-INK DISPLAY PREVIEW (296×128)
              </Text>
              <Text style={styles.einkMetaLabel}>{bag.smartTagCode}</Text>
            </View>
            <View style={styles.einkScreenFrame}>
              <View style={styles.einkRouteBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Image
                    source={BRUSHWING_WHITE}
                    style={{ width: 13, height: 13, tintColor: '#111111' }}
                    resizeMode="contain"
                  />
                  <Text style={styles.einkRouteStrong}>
                    {flight.origin} → {flight.destination}
                  </Text>
                </View>
                <Text style={styles.einkFlightStrong}>{flight.flightNumber}</Text>
              </View>
              <View style={styles.barcodeRow}>
                {barcodeModules.map((m, idx) => (
                  <View
                    key={idx}
                    style={{
                      height: 28,
                      flex: m.widthUnits,
                      backgroundColor: m.isBar ? '#111111' : 'transparent',
                    }}
                  />
                ))}
              </View>
              <Text style={styles.einkLicenseDigits}>
                {bag.baggage.tagNumber}  •  {bag.displayBagCode}
              </Text>
            </View>
          </View>
        )}
      </CathayCard>
    );
  }

  return (
    <CathayCard style={styles.sectionCard}>
      <View style={styles.cardIconHeadingRow}>
        <SuitcaseWithTagGlyph size="sm" />
        <Text style={styles.cardSectionHeading}>Tag details</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Bag ID</Text>
        <Text style={styles.detailValueInteractive}>{bag.displayBagCode}</Text>
      </View>

      <View style={styles.hairline} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Route</Text>
        <Text style={styles.detailValueInteractive}>
          {flight.origin} → {flight.destination}
        </Text>
      </View>

      <View style={styles.hairline} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Flight</Text>
        <Text style={styles.detailValueInteractive}>{flight.flightNumber}</Text>
      </View>

      <View style={styles.hairline} />

      <View style={[styles.detailRow, { paddingBottom: 2 }]}>
        <Text style={styles.detailLabel}>Status</Text>
        <Text style={styles.detailValueInteractive}>Awaiting bag-drop</Text>
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
  isSimulated?: boolean;
  onCancel?: () => void;
}> = ({ state, message, isSimulated: _isSimulated, onCancel }) => {
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
        : CATHAY_MINT_SURFACE;

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

            <View
              style={[
                styles.timelineContentCol,
                isLast && { borderBottomWidth: 0, paddingBottom: 4, marginBottom: 0 },
              ]}
            >
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
      : tone === 'warning' || tone === 'demo'
        ? CATHAY_WARM_CREAM
        : CATHAY_MINT_SURFACE;
  const border =
    tone === 'danger'
      ? '#FECACA'
      : tone === 'warning' || tone === 'demo'
        ? CATHAY_WARM_BORDER
        : '#D0E6E4';
  const iconColor =
    tone === 'danger'
      ? '#B91C1C'
      : tone === 'warning' || tone === 'demo'
        ? '#785D2A'
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
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  headerSideSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 18.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.2,
  },

  primaryBtn: {
    backgroundColor: CATHAY_JADE,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  outlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7B8B5',
    borderRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: CATHAY_JADE,
    fontSize: 15,
    fontWeight: '600',
  },

  linkBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnText: {
    color: CATHAY_JADE,
    fontSize: 14.5,
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
    paddingVertical: 15,
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
    color: CATHAY_JADE_LIGHT,
  },
  bagHeaderLabel: {
    fontSize: 14,
    color: '#2B3035',
  },
  bagHeaderCode: {
    fontWeight: '500',
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
    color: CATHAY_JADE_LIGHT,
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
  takeoffPlaneIcon: {
    width: 17,
    height: 13,
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
    paddingVertical: 15,
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
    letterSpacing: -0.2,
  },
  previewCardHeading: {
    fontSize: 16.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9.5,
  },
  previewRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: 14.5,
    color: '#4B5259',
    fontWeight: '400',
  },
  detailValueRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValuePrimary: {
    fontSize: 14.5,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
  },
  detailValueInteractive: {
    fontSize: 14.5,
    fontWeight: '600',
    color: CATHAY_JADE_LIGHT,
  },
  hairline: {
    height: 1,
    backgroundColor: CATHAY_BORDER,
  },

  illustrationBanner: {
    backgroundColor: CATHAY_MINT_SURFACE,
    borderRadius: 14,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  illustrationHeroImg: {
    width: 268,
    height: 150,
  },

  einkPreviewBox: {
    marginTop: 8,
    paddingTop: 12,
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
    fontWeight: '500',
    color: CATHAY_TEXT_MUTED,
    letterSpacing: 0.3,
  },
  einkScreenFrame: {
    backgroundColor: '#F4F3EE',
    borderWidth: 1.5,
    borderColor: '#2C3034',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  einkRouteBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2C3034',
    paddingBottom: 6,
    marginBottom: 8,
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
    height: 28,
    marginVertical: 2,
  },
  einkLicenseDigits: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: '#111111',
    textAlign: 'center',
    marginTop: 5,
    letterSpacing: 0.4,
  },

  progressStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0E6E4',
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  progressText: {
    fontSize: 13.5,
    fontWeight: '500',
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
    backgroundColor: CATHAY_JADE_LIGHT,
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
    borderColor: CATHAY_JADE_LIGHT,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  nodeInnerDotCurrent: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CATHAY_JADE_LIGHT,
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
    backgroundColor: CATHAY_JADE_LIGHT,
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
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2C3034',
  },
  noticeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    marginLeft: 28,
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

  // -------------------------------------------------------------------------
  // Handoff V3 Styles
  // -------------------------------------------------------------------------
  ticketContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    ...cardShadowStyle,
  },
  ticketTopSection: {
    height: 175,
    position: 'relative',
    backgroundColor: CATHAY_JADE,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  ticketTopOverlay: {
    zIndex: 2,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  ticketFlightCode: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  ticketRoute: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: CATHAY_SERIF,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  ticketDate: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13.5,
    fontWeight: '500',
  },
  ticketBottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#ECEEEF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  ticketInfoCol: {
    flex: 1,
    alignItems: 'center',
  },
  ticketInfoLabel: {
    fontSize: 11,
    color: CATHAY_TEXT_MUTED,
    marginBottom: 4,
    fontWeight: '500',
  },
  ticketInfoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  ticketInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 14,
    ...cardShadowStyle,
  },
  entryCardArtTile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#F0F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  entryCardArt: {
    width: 44,
    height: 44,
  },
  entryCardTextCol: {
    flex: 1,
    marginRight: 8,
  },
  entryCardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 3,
  },
  entryCardSubtitle: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 17,
  },

  yourBaggageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
    ...cardShadowStyle,
  },
  yourBaggageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  yourBaggageIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EBF4F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  yourBaggageTitleCol: {
    flex: 1,
  },
  yourBaggageTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 2,
  },
  yourBaggageSubtitle: {
    fontSize: 13,
    color: CATHAY_TEXT_SECONDARY,
  },
  yourBaggageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CATHAY_JADE,
    borderRadius: 28,
    height: 52,
    gap: 6,
  },
  yourBaggageBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },

  // Brushwing Flight Summary Card
  brushwingFlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    ...cardShadowStyle,
  },
  brushwingFlightLogo: {
    width: 30,
    height: 18,
  },
  brushwingHairline: {
    width: 1,
    height: 26,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 14,
  },
  brushwingFlightTextCol: {
    flex: 1,
  },
  brushwingFlightTitle: {
    fontSize: 14.5,
    marginBottom: 3,
  },
  brushwingFlightCode: {
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  brushwingFlightRoute: {
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  brushwingFlightDate: {
    fontSize: 12.5,
    color: CATHAY_TEXT_MUTED,
  },

  headerSoftWaveImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    width: '100%',
    opacity: 0.7,
  },

  checklistSectionWrap: {
    marginBottom: 16,
  },
  checklistSectionHeading: {
    fontSize: 15.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 12,
  },
  floatingCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 10,
    ...cardShadowStyle,
  },
  checklistBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: '#FFFFFF',
  },
  checklistBadgeDone: {
    backgroundColor: CATHAY_JADE,
    borderColor: CATHAY_JADE,
  },
  checklistCirclePending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  checklistTextCol: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  checklistSubtitle: {
    fontSize: 12.5,
    color: CATHAY_TEXT_MUTED,
    marginTop: 2,
  },

  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 20,
    ...cardShadowStyle,
  },
  guideSectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 16,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  guideBadgeCol: {
    width: 26,
    alignItems: 'center',
    marginRight: 14,
  },
  guideNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: CATHAY_JADE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideNumberText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  guideLine: {
    width: 1.5,
    height: 26,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
  },
  guideTextCol: {
    flex: 1,
    paddingTop: 2,
  },
  guideTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  guideSubtitle: {
    fontSize: 12.5,
    color: CATHAY_TEXT_MUTED,
    marginTop: 2,
  },

  statusCardWrap: {
    height: 112,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: CATHAY_JADE,
    marginBottom: 16,
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...cardShadowStyle,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  statusCardLeft: {
    flex: 1,
  },
  statusCardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: CATHAY_SERIF,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  statusCardSubtitle: {
    color: '#A2D9D2',
    fontSize: 14,
    fontWeight: '500',
  },
  statusCardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardSuitcaseIcon: {
    width: 28,
    height: 24,
  },
});

// ---------------------------------------------------------------------------
// 14. JadeBookingTicketCard (Design 01 Hero Card)
// ---------------------------------------------------------------------------
export interface JadeBookingTicketCardProps {
  flightNumber: string;
  route: string;
  dateStr: string;
  departureTime: string;
  terminal: string;
  gate: string;
  onPress?: () => void;
}

export const JadeBookingTicketCard: React.FC<JadeBookingTicketCardProps> = ({
  flightNumber,
  route,
  dateStr,
  departureTime,
  terminal,
  gate,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      style={styles.ticketContainer}
    >
      <View style={styles.ticketTopSection}>
        <Image
          source={BOOKING_JADE_WAVE}
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          resizeMode="cover"
        />
        <View style={styles.ticketTopOverlay}>
          <View style={styles.ticketHeaderRow}>
            <Ionicons name="airplane" size={16} color="#FFFFFF" />
            <Text style={styles.ticketFlightCode}>{flightNumber}</Text>
          </View>
          <Text style={styles.ticketRoute}>{route}</Text>
          <Text style={styles.ticketDate}>{dateStr}</Text>
        </View>
      </View>

      <View style={styles.ticketBottomSection}>
        <View style={styles.ticketInfoCol}>
          <Text style={styles.ticketInfoLabel}>Departure</Text>
          <Text style={styles.ticketInfoValue}>{departureTime}</Text>
        </View>
        <View style={styles.ticketInfoDivider} />
        <View style={styles.ticketInfoCol}>
          <Text style={styles.ticketInfoLabel}>Terminal</Text>
          <Text style={styles.ticketInfoValue}>{terminal}</Text>
        </View>
        <View style={styles.ticketInfoDivider} />
        <View style={styles.ticketInfoCol}>
          <Text style={styles.ticketInfoLabel}>Gate</Text>
          <Text style={styles.ticketInfoValue}>{gate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// 15. SmartTagEntryCard (Design 01)
// ---------------------------------------------------------------------------
export interface SmartTagEntryCardProps {
  onPress: () => void;
}

export const SmartTagEntryCard: React.FC<SmartTagEntryCardProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={onPress}
      activeOpacity={0.8}
      testID="smarttag-entry-card"
    >
      <View style={styles.entryCardArtTile}>
        <Image source={SMARTTAG_ENTRY_ART} style={styles.entryCardArt} resizeMode="contain" />
      </View>
      <View style={styles.entryCardTextCol}>
        <Text style={styles.entryCardTitle}>Cathay SmartTag</Text>
        <Text style={styles.entryCardSubtitle}>
          Manage your baggage tag for a smoother journey.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// 16. YourBaggageCard (Design 01)
// ---------------------------------------------------------------------------
export interface YourBaggageCardProps {
  bagCountStr?: string;
  onPress: () => void;
}

export const YourBaggageCard: React.FC<YourBaggageCardProps> = ({
  bagCountStr = '1 checked bag',
  onPress,
}) => {
  return (
    <View style={styles.yourBaggageCard}>
      <View style={styles.yourBaggageHeaderRow}>
        <View style={styles.yourBaggageIconWrap}>
          <Ionicons name="briefcase-outline" size={20} color={CATHAY_JADE} />
        </View>
        <View style={styles.yourBaggageTitleCol}>
          <Text style={styles.yourBaggageTitle}>Your baggage</Text>
          <Text style={styles.yourBaggageSubtitle}>{bagCountStr}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.yourBaggageBtn}
        onPress={onPress}
        activeOpacity={0.85}
        testID="btn-prepare-smarttag"
      >
        <Text style={styles.yourBaggageBtnText}>Prepare SmartTag</Text>
        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// 17. HeaderSoftWave
// ---------------------------------------------------------------------------
export const HeaderSoftWave: React.FC = () => {
  return (
    <Image
      source={HEADER_SOFT_MINT_WAVE}
      style={styles.headerSoftWaveImg}
      resizeMode="cover"
    />
  );
};

// ---------------------------------------------------------------------------
// 18. BeforeYouContinueChecklist (Design 02)
// ---------------------------------------------------------------------------
export interface ChecklistItem {
  id: string;
  title: string;
  subtitle: string;
  checked: boolean;
}

export const BeforeYouContinueChecklist: React.FC<{ items?: ChecklistItem[] }> = ({ items }) => {
  const defaultItems: ChecklistItem[] = items || [
    {
      id: '1',
      title: 'Booking confirmed',
      subtitle: 'E-ticket and baggage allowance verified',
      checked: true,
    },
    {
      id: '2',
      title: 'Baggage within allowance',
      subtitle: '1 checked bag (≤ 23 kg)',
      checked: true,
    },
    {
      id: '3',
      title: 'Have your SmartTag ready',
      subtitle: 'A Cathay SmartTag with NFC',
      checked: false,
    },
  ];

  return (
    <View style={styles.checklistSectionWrap}>
      <Text style={styles.checklistSectionHeading}>Before you continue</Text>
      {defaultItems.map((item) => (
        <View key={item.id} style={styles.floatingCheckCard}>
          <View style={[styles.checklistBadge, item.checked && styles.checklistBadgeDone]}>
            {item.checked ? (
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            ) : (
              <View style={styles.checklistCirclePending} />
            )}
          </View>
          <View style={styles.checklistTextCol}>
            <Text style={styles.checklistTitle}>{item.title}</Text>
            <Text style={styles.checklistSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 19. AirportGuideSteps (Design 04)
// ---------------------------------------------------------------------------
export const AirportGuideSteps: React.FC = () => {
  const steps = [
    { num: '1', title: 'Attach', desc: 'Secure the SmartTag to your bag.' },
    { num: '2', title: 'Bag drop', desc: 'Use the dedicated bag drop counter.' },
    { num: '3', title: 'Track', desc: "Follow your bag's journey in the app." },
  ];

  return (
    <View style={styles.guideCard}>
      <Text style={styles.guideSectionTitle}>At the airport, it’s simple</Text>
      {steps.map((s, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <View key={s.num} style={styles.guideRow}>
            <View style={styles.guideBadgeCol}>
              <View style={styles.guideNumberBadge}>
                <Text style={styles.guideNumberText}>{s.num}</Text>
              </View>
              {!isLast && <View style={styles.guideLine} />}
            </View>
            <View style={styles.guideTextCol}>
              <Text style={styles.guideTitle}>{s.title}</Text>
              <Text style={styles.guideSubtitle}>{s.desc}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 20. JadeStatusCard (Design 05)
// ---------------------------------------------------------------------------
export interface JadeStatusCardProps {
  title?: string;
  subtitle?: string;
}

export const JadeStatusCard: React.FC<JadeStatusCardProps> = ({
  title = 'Arrived in Tokyo',
  subtitle = 'Awaiting collection',
}) => {
  return (
    <View style={styles.statusCardWrap}>
      <Image
        source={STATUS_JADE_WAVE}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />
      <View style={styles.statusCardContent}>
        <View style={styles.statusCardLeft}>
          <Text style={styles.statusCardTitle}>{title}</Text>
          <Text style={styles.statusCardSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.statusCardIconBox}>
          <Image
            source={ICON_CATHAY_SUITCASE}
            style={styles.statusCardSuitcaseIcon}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// 21. BrushwingFlightSummaryCard (Design 02 & 06)
// ---------------------------------------------------------------------------
export interface BrushwingFlightSummaryCardProps {
  flightNumber?: string;
  route?: string;
  dateStr?: string;
  onPress?: () => void;
}

export const BrushwingFlightSummaryCard: React.FC<BrushwingFlightSummaryCardProps> = ({
  flightNumber = 'CX548',
  route = 'HKG → NRT',
  dateStr = 'Tue, 11 Nov 2026 · 10:35',
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.brushwingFlightCard}
      activeOpacity={onPress ? 0.75 : 1}
      onPress={onPress}
    >
      <Image
        source={CONCEPT_BRUSHWING}
        style={styles.brushwingFlightLogo}
        resizeMode="contain"
      />
      <View style={styles.brushwingHairline} />
      <View style={styles.brushwingFlightTextCol}>
        <Text style={styles.brushwingFlightTitle}>
          <Text style={styles.brushwingFlightCode}>{flightNumber}</Text>
          {'   '}
          <Text style={styles.brushwingFlightRoute}>{route}</Text>
        </Text>
        <Text style={styles.brushwingFlightDate}>{dateStr}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
};

