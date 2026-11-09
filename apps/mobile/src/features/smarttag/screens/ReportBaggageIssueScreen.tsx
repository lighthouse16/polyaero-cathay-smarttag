/**
 * Screen 06 — Report an Issue (Matches references/06_report_issue.png)
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
import { BaggageIssueType } from '@polyaero/shared';
import {
  CATHAY_JADE,
  CATHAY_SERIF,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CATHAY_TEXT_MUTED,
  CathayPrimaryButton,
  InlineNotice,
  BrushwingFlightSummaryCard,
} from '../components/CathaySmartTagPrimitives';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

const ISSUE_OPTIONS: { value: BaggageIssueType; label: string }[] = [
  { value: 'NOT_LOCATED', label: "My bag didn't arrive" },
  { value: 'TAG_DAMAGED_OR_UNREADABLE', label: 'SmartTag damaged or unreadable' },
  { value: 'DELAYED', label: 'Baggage delayed at arrival' },
  { value: 'GENERAL_ASSISTANCE', label: 'Other baggage assistance' },
];

export interface ReportBaggageIssueScreenProps {
  defaultEmail?: string;
  defaultPhone?: string;
  onOpenDevMenu?: () => void;
}

export const ReportBaggageIssueScreen: React.FC<ReportBaggageIssueScreenProps> = ({
  defaultEmail = 'haidang.trinh@gmail.com',
  defaultPhone = '+852 70516618',
  onOpenDevMenu: _onOpenDevMenu,
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

  const [selectedIssue, setSelectedIssue] = useState(ISSUE_OPTIONS[0]);
  const [issueOptionsOpen, setIssueOptionsOpen] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedCase = existingRecovery;

  if (!itinerary || !bag) {
    return (
      <View style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => smartTagController.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={CATHAY_JADE} />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 20 }}>
          <InlineNotice
            tone="warning"
            title="No baggage selected"
            message="Please select a baggage journey before reporting an issue."
            actionLabel="Back to Baggage journey"
            onAction={() => smartTagController.navigateTo('journey')}
          />
        </View>
      </View>
    );
  }

  const handleSubmit = () => {
    setSubmitError(null);
    try {
      const res = smartTagRepository.createRecoveryCase({
        itineraryId: itinerary.id,
        bagSetupId: bag.id,
        issueType: selectedIssue.value,
        description: description.trim() || selectedIssue.label,
        contactEmail: defaultEmail,
        contactPhone: defaultPhone,
      });
      if (!res.record) {
        setSubmitError(res.validationError ?? 'Your report could not be saved. Please try again.');
      }
    } catch {
      setSubmitError('Your report could not be saved. Your details are still here; please try again.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Top Bar with Back Chevron */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => smartTagController.goBack()}
          testID="smarttag-back-btn"
        >
          <Ionicons name="chevron-back" size={24} color={CATHAY_JADE} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Block matching references/06_report_issue.png */}
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>Report an issue</Text>
          <Text style={styles.headerSubtitle}>
            Tell us what happened with your baggage. We’ll get it sorted as quickly as possible.
          </Text>
        </View>

        {/* Flight summary card */}
        <BrushwingFlightSummaryCard
          flightNumber={itinerary.flight.flightNumber}
          route={`${itinerary.flight.origin} → ${itinerary.flight.destination}`}
          dateStr="Tue, 11 Nov 2026 · 10:35"
        />

        {submittedCase ? (
          <View style={styles.successBlock}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={28} color={CATHAY_JADE} />
            </View>
            <Text style={styles.successTitle}>
              {submittedCase.isSimulatedDemo ? 'Demo report saved' : 'Report submitted'}
            </Text>
            <Text style={styles.successRef}>Reference ID: {submittedCase.recoveryCase.caseNumber}</Text>
            <Text style={styles.successDesc}>
              {submittedCase.isSimulatedDemo
                ? 'Your report is saved in this demo. No airline baggage team has been contacted.'
                : 'Your report details are available in your baggage journey.'}
            </Text>
            <CathayPrimaryButton
              label="Return to Baggage journey"
              onPress={() => smartTagController.navigateTo('journey')}
              style={styles.returnBtn}
            />
          </View>
        ) : (
          <View style={styles.formCard}>
            {/* Field 1: Issue type dropdown */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Issue type</Text>
              <TouchableOpacity
                style={styles.selectBox}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Issue type: ${selectedIssue.label}`}
                accessibilityHint="Show or hide available issue types"
                accessibilityState={{ expanded: issueOptionsOpen }}
                testID="issue-type-selector"
                onPress={() => setIssueOptionsOpen((open) => !open)}
              >
                <Text style={styles.selectBoxText}>{selectedIssue.label}</Text>
                <Ionicons
                  name={issueOptionsOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#6B7280"
                />
              </TouchableOpacity>
              {issueOptionsOpen ? (
                <View
                  style={styles.issueOptions}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Issue type"
                >
                  {ISSUE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.issueOption}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ checked: selectedIssue.value === option.value }}
                      testID={`issue-type-${option.value}`}
                      onPress={() => {
                        setSelectedIssue(option);
                        setIssueOptionsOpen(false);
                      }}
                    >
                      <Text style={styles.selectBoxText}>{option.label}</Text>
                      <Ionicons
                        name={selectedIssue.value === option.value ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={CATHAY_JADE}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Field 2: Description */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Tell us more (optional)</Text>
              <View style={styles.textareaWrap}>
                <TextInput
                  style={styles.multilineInput}
                  accessibilityLabel="Tell us more (optional)"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                  placeholder="Provide any details that might help us locate your bag (colour, brand, distinctive marks)..."
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                />
                <Text style={styles.charCounter}>{description.length}/500</Text>
              </View>
            </View>

            {/* ponytail: Photo uploads need a recovery attachment contract; keep unavailable until supported. */}
            <View style={styles.formGroup}>
              <View style={styles.uploadPhotoBox}>
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color="#6B7280"
                  style={styles.uploadPhotoIcon}
                />
                <Text style={styles.uploadPhotoText}>
                  {'Add photo (optional)\nNot supported in this build.'}
                </Text>
              </View>
            </View>

            {submitError ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <InlineNotice tone="danger" title="Report not submitted" message={submitError} />
              </View>
            ) : null}

            {/* Primary Action Button */}
            <CathayPrimaryButton
              label="Submit report"
              onPress={handleSubmit}
              style={styles.submitBtn}
              testID="btn-submit-issue-report"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? 48 : 36,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  backBtn: {
    padding: 4,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },

  headerBlock: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: CATHAY_SERIF,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 20,
  },

  formCard: {
    gap: 4,
  },
  formGroup: {
    marginBottom: 10,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 2,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEEEF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  issueOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEEEF',
    overflow: 'hidden',
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  selectBoxText: {
    flexShrink: 1,
    fontSize: 14.5,
    color: CATHAY_TEXT_PRIMARY,
    fontWeight: '500',
  },
  textareaWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEEEF',
    padding: 14,
  },
  multilineInput: {
    fontSize: 14,
    color: CATHAY_TEXT_PRIMARY,
    minHeight: 48,
    lineHeight: 20,
    padding: 0,
  },
  charCounter: {
    fontSize: 12,
    color: CATHAY_TEXT_MUTED,
    textAlign: 'right',
    marginTop: 6,
  },
  uploadPhotoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  uploadPhotoIcon: {
    marginRight: 2,
  },
  uploadPhotoText: {
    flex: 1,
    fontSize: 13.5,
    color: CATHAY_TEXT_MUTED,
    fontWeight: '500',
  },

  submitBtn: {
    marginTop: 0,
    marginBottom: 30,
  },

  successBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CATHAY_TEXT_PRIMARY,
  },
  successRef: {
    fontSize: 13,
    fontWeight: '700',
    color: CATHAY_JADE,
  },
  successDesc: {
    fontSize: 13.5,
    color: CATHAY_TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  returnBtn: {
    width: '100%',
  },
});
