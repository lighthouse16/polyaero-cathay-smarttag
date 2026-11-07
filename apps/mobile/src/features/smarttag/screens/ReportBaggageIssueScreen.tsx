/**
 * Screen 06 — Report a Baggage Issue & Recovery Confirmation
 *
 * Completes the passenger recovery workflow using the restrained Cathay design language:
 *   - Pre-filled booking & baggage identity (`CX548`, `HKG → NRT`, `CX880123456`, `ST-2048`)
 *   - Selectable issue type (`DELAYED`, `NOT_LOCATED`, `TAG_DAMAGED_OR_UNREADABLE`, `GENERAL_ASSISTANCE`)
 *   - Validated description, contact email/phone, optional last-seen location
 *   - Creates a `RecoveryCase` in the local demo store (`REC-2026-xxxx`) and displays
 *     confirmation with clear disclosure that the case is stored locally in the demo
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BaggageIssueType,
  PassengerRecoveryRecord,
} from '@polyaero/shared';
import {
  CATHAY_BG,
  CATHAY_BORDER,
  CATHAY_JADE,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CathayCard,
  CathayPrimaryButton,
  CathayScreenHeader,
  CathaySecondaryButton,
  InlineNotice,
  StatusBadge,
} from '../components/CathaySmartTagPrimitives';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

export interface ReportBaggageIssueScreenProps {
  defaultEmail?: string;
  defaultPhone?: string;
  onOpenDevMenu?: () => void;
}

const ISSUE_OPTIONS: { id: BaggageIssueType; label: string; subtitle: string }[] = [
  {
    id: 'DELAYED',
    label: 'Baggage delayed at arrival',
    subtitle: 'Bag did not arrive on the expected baggage carousel',
  },
  {
    id: 'NOT_LOCATED',
    label: 'Baggage cannot be located',
    subtitle: 'Need tracing assistance across transfer or arrival stations',
  },
  {
    id: 'TAG_DAMAGED_OR_UNREADABLE',
    label: 'SmartTag damaged or unreadable',
    subtitle: 'Physical E-ink display or strap requires replacement or manual lookup',
  },
  {
    id: 'GENERAL_ASSISTANCE',
    label: 'Other baggage assistance',
    subtitle: 'General enquiry regarding checked baggage handling',
  },
];

export const ReportBaggageIssueScreen: React.FC<ReportBaggageIssueScreenProps> = ({
  defaultEmail = 'haidang.trinh@gmail.com',
  defaultPhone = '+852 70516618',
  onOpenDevMenu,
}) => {
  const { repo } = useSmartTagStore();
  const itinerary =
    (repo.activeItineraryId
      ? repo.itineraries.find((i) => i.id === repo.activeItineraryId)
      : repo.itineraries[0]) ?? null;

  const bags = itinerary ? repo.bagSetupsByItinerary[itinerary.id] ?? [] : [];
  const bag =
    (repo.activeBagSetupId ? bags.find((b) => b.id === repo.activeBagSetupId) : bags[0]) ??
    bags[0] ??
    null;

  const existingRecovery = bag ? repo.recoveryByBagSetupId[bag.id] ?? null : null;

  const [issueType, setIssueType] = useState<BaggageIssueType>(
    existingRecovery?.issueType ?? 'DELAYED'
  );
  const [description, setDescription] = useState<string>(
    existingRecovery?.passengerDescription ??
      'Checked suitcase did not appear on Carousel 5 after CX548 arrival at Tokyo Narita.'
  );
  const [contactEmail, setContactEmail] = useState<string>(
    existingRecovery?.contactEmail ?? defaultEmail
  );
  const [contactPhone, setContactPhone] = useState<string>(
    existingRecovery?.contactPhone ?? defaultPhone
  );
  const [lastSeenLocation, setLastSeenLocation] = useState<string>(
    existingRecovery?.recoveryCase.reportedLocation ??
      'HKG Terminal 1 Self Bag-Drop'
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] =
    useState<PassengerRecoveryRecord | null>(null);

  if (!itinerary || !bag) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Report a baggage issue"
          onBack={() => smartTagController.goBack()}
          onLongPressTitle={onOpenDevMenu}
        />
        <View style={{ padding: 20 }}>
          <InlineNotice
            tone="warning"
            title="No baggage record selected"
            message="Return to My bookings and select an upcoming journey first."
            actionLabel="Back to My bookings"
            onAction={() => smartTagController.navigateTo('bookings')}
          />
        </View>
      </View>
    );
  }

  const handleSubmit = () => {
    const res = smartTagRepository.createRecoveryCase({
      itineraryId: itinerary.id,
      bagSetupId: bag.id,
      issueType,
      description,
      contactEmail,
      contactPhone,
      lastSeenLocation,
    });

    if (res.validationError || !res.record) {
      setValidationError(
        res.validationError ?? 'Please check the required fields and try again.'
      );
      return;
    }

    setValidationError(null);
    setSubmittedRecord(res.record);
  };

  if (submittedRecord) {
    return (
      <View style={styles.root}>
        <CathayScreenHeader
          title="Issue reported"
          onBack={() => smartTagController.goBack()}
          onLongPressTitle={onOpenDevMenu}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.confirmHero}>
            <View style={styles.confirmCircle}>
              <Ionicons name="checkmark" size={28} color={CATHAY_JADE} />
            </View>
            <Text style={styles.confirmTitle}>Recovery case recorded</Text>
            <Text style={styles.confirmSub}>
              Saved in the local demo store. This prototype does not transmit live reports to Cathay or airport baggage systems.
            </Text>
          </View>

          <CathayCard style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Case reference</Text>
              <Text style={styles.summaryValueJade}>
                {submittedRecord.recoveryCase.caseNumber}
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Booking & Flight</Text>
              <Text style={styles.summaryValue}>
                {itinerary.booking.bookingReference} • {itinerary.flight.flightNumber} ({itinerary.flight.origin} → {itinerary.flight.destination})
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bag ID / SmartTag</Text>
              <Text style={styles.summaryValue}>
                {bag.displayBagCode} ({bag.smartTagCode})
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Status</Text>
              <StatusBadge label="Case submitted (Demo)" tone="amber" />
            </View>
          </CathayCard>

          <CathayPrimaryButton
            label="Return to Baggage journey"
            onPress={() =>
              smartTagController.navigateTo('journey', {
                itineraryId: itinerary.id,
                bagSetupId: bag.id,
                replace: true,
              })
            }
            testID="btn-recovery-back-journey"
          />

          <CathaySecondaryButton
            label="Back to My bookings"
            variant="link"
            onPress={() => smartTagController.navigateTo('bookings')}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CathayScreenHeader
        title="Report a baggage issue"
        onBack={() => smartTagController.goBack()}
        onLongPressTitle={onOpenDevMenu}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Pre-filled Journey & Bag Identity Card */}
        <CathayCard style={styles.card}>
          <Text style={styles.sectionHeading}>Journey & baggage identity</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Booking reference</Text>
            <Text style={styles.summaryValueJade}>
              {itinerary.booking.bookingReference}
            </Text>
          </View>
          <View style={styles.hairline} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Flight & route</Text>
            <Text style={styles.summaryValue}>
              {itinerary.flight.flightNumber} • {itinerary.flight.origin} → {itinerary.flight.destination}
            </Text>
          </View>
          <View style={styles.hairline} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bag ID</Text>
            <Text style={styles.summaryValueJade}>{bag.displayBagCode}</Text>
          </View>
          <View style={styles.hairline} />

          <View style={[styles.summaryRow, { paddingBottom: 2 }]}>
            <Text style={styles.summaryLabel}>SmartTag ID</Text>
            <Text style={styles.summaryValue}>
              {bag.smartTagCode} ({bag.baggage.tagNumber})
            </Text>
          </View>
        </CathayCard>

        {/* Issue Type Selector */}
        <CathayCard style={styles.card}>
          <Text style={styles.sectionHeading}>What is the issue?</Text>
          {ISSUE_OPTIONS.map((opt, idx) => {
            const selected = issueType === opt.id;
            return (
              <React.Fragment key={opt.id}>
                <TouchableOpacity
                  style={styles.radioOptionRow}
                  onPress={() => {
                    setIssueType(opt.id);
                    setValidationError(null);
                  }}
                  activeOpacity={0.75}
                  testID={`issue-type-${opt.id.toLowerCase()}`}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      selected && styles.radioOuterSelected,
                    ]}
                  >
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioTitle}>{opt.label}</Text>
                    <Text style={styles.radioSubtitle}>{opt.subtitle}</Text>
                  </View>
                </TouchableOpacity>
                {idx < ISSUE_OPTIONS.length - 1 && <View style={styles.hairline} />}
              </React.Fragment>
            );
          })}
        </CathayCard>

        {/* Description & Contact Details */}
        <CathayCard style={styles.card}>
          <Text style={styles.sectionHeading}>Details & contact</Text>

          <Text style={styles.inputLabel}>SHORT DESCRIPTION *</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={(v) => {
              setDescription(v);
              setValidationError(null);
            }}
            placeholder="Describe your bag and the issue"
            placeholderTextColor="#9CA3AF"
            multiline
            testID="input-issue-description"
          />

          <Text style={styles.inputLabel}>CONTACT EMAIL *</Text>
          <TextInput
            style={styles.textInput}
            value={contactEmail}
            onChangeText={(v) => {
              setContactEmail(v);
              setValidationError(null);
            }}
            placeholder="passenger@example.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="input-issue-email"
          />

          <Text style={styles.inputLabel}>CONTACT PHONE (OPTIONAL)</Text>
          <TextInput
            style={styles.textInput}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+852 9123 4567"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>LAST SEEN LOCATION (OPTIONAL)</Text>
          <TextInput
            style={styles.textInput}
            value={lastSeenLocation}
            onChangeText={setLastSeenLocation}
            placeholder="e.g. HKG Terminal 1 Self Bag-Drop"
            placeholderTextColor="#9CA3AF"
          />
        </CathayCard>

        {validationError && (
          <InlineNotice tone="danger" message={validationError} />
        )}

        <InlineNotice
          tone="demo"
          message="Demo mode: Submitting this form creates a synthetic recovery case in the local application store so you can test recovery status transitions."
        />

        <CathayPrimaryButton
          label="Submit baggage issue report"
          onPress={handleSubmit}
          testID="btn-submit-recovery-case"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CATHAY_BG,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  card: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 13.5,
    color: CATHAY_TEXT_SECONDARY,
  },
  summaryValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
  },
  summaryValueJade: {
    fontSize: 14,
    fontWeight: '700',
    color: CATHAY_JADE,
  },
  hairline: {
    height: 1,
    backgroundColor: CATHAY_BORDER,
  },
  radioOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 11,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: CATHAY_JADE,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CATHAY_JADE,
  },
  radioTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
  },
  radioSubtitle: {
    fontSize: 12.5,
    color: CATHAY_TEXT_SECONDARY,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: CATHAY_TEXT_PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  confirmHero: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#DCECE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
  confirmSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: CATHAY_TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 6,
  },
});
