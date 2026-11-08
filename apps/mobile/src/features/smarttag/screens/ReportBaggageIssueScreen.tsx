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
import {
  BaggageIssueType,
  PassengerRecoveryRecord,
} from '@polyaero/shared';
import {
  CATHAY_JADE,
  CATHAY_TEXT_PRIMARY,
  CATHAY_TEXT_SECONDARY,
  CATHAY_TEXT_MUTED,
  CathayPrimaryButton,
  InlineNotice,
} from '../components/CathaySmartTagPrimitives';
import { smartTagController, smartTagRepository, useSmartTagStore } from '../store';

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

  const [issueLabel, setIssueLabel] = useState<string>("My bag didn't arrive");
  const [description, setDescription] = useState<string>('');
  const [hasPhoto, setHasPhoto] = useState<boolean>(false);
  const [submittedCase, setSubmittedCase] = useState<PassengerRecoveryRecord | null>(
    existingRecovery
  );

  if (!itinerary || !bag) {
    return (
      <View style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
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
    const res = smartTagRepository.createRecoveryCase({
      itineraryId: itinerary.id,
      bagSetupId: bag.id,
      issueType: 'NOT_LOCATED' as BaggageIssueType,
      description: description || issueLabel,
      contactEmail: defaultEmail,
      contactPhone: defaultPhone,
    });
    if (res.record) {
      setSubmittedCase(res.record);
    }
  };

  return (
    <View style={styles.root}>
      {/* Top Bar with Back Chevron */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
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
        <View style={styles.flightSummaryCard}>
          <View style={styles.flightSummaryLeft}>
            <View style={styles.flightPlaneWrap}>
              <Ionicons name="airplane" size={16} color={CATHAY_JADE} />
            </View>
            <View style={styles.flightSummaryTextCol}>
              <Text style={styles.flightRouteTitle}>
                {itinerary.flight.flightNumber} {itinerary.flight.origin} → {itinerary.flight.destination}
              </Text>
              <Text style={styles.flightDateSub}>
                Tue, 11 Nov 2026 · 10:35
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </View>

        {submittedCase ? (
          <View style={styles.successBlock}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={28} color={CATHAY_JADE} />
            </View>
            <Text style={styles.successTitle}>Report submitted</Text>
            <Text style={styles.successRef}>Reference ID: {submittedCase.recoveryCase.id}</Text>
            <Text style={styles.successDesc}>
              Our baggage tracing team at Tokyo Narita (NRT) has received your details. We will update your baggage journey as soon as new information is verified.
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
                onPress={() => {
                  setIssueLabel((prev) =>
                    prev === "My bag didn't arrive"
                      ? 'SmartTag damaged or unreadable'
                      : prev === 'SmartTag damaged or unreadable'
                      ? 'Baggage delayed at arrival'
                      : "My bag didn't arrive"
                  );
                }}
              >
                <Text style={styles.selectBoxText}>{issueLabel}</Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Field 2: Tell us more */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Tell us more (optional)</Text>
              <TextInput
                style={styles.multilineInput}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Please share any details that might help (e.g. bag description, last seen location)."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Field 3: Add photo (optional) */}
            <TouchableOpacity
              style={styles.addPhotoRow}
              activeOpacity={0.7}
              onPress={() => setHasPhoto(!hasPhoto)}
            >
              <View style={styles.photoLeft}>
                <Ionicons name="camera-outline" size={20} color={CATHAY_TEXT_SECONDARY} />
                <Text style={styles.photoText}>
                  {hasPhoto ? 'Photo attached (luggage.jpg)' : 'Add photo (optional)'}
                </Text>
              </View>
              <Ionicons
                name={hasPhoto ? 'checkmark-circle' : 'add'}
                size={20}
                color={hasPhoto ? CATHAY_JADE : '#9CA3AF'}
              />
            </TouchableOpacity>

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
    paddingTop: Platform.OS === 'android' ? 12 : 0,
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
    fontWeight: '800',
    color: CATHAY_TEXT_PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: CATHAY_TEXT_SECONDARY,
    lineHeight: 20,
  },

  flightSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  flightSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flightPlaneWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EBF4F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  flightSummaryTextCol: {
    flex: 1,
  },
  flightRouteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
    marginBottom: 2,
  },
  flightDateSub: {
    fontSize: 12.5,
    color: CATHAY_TEXT_MUTED,
  },

  formCard: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CATHAY_TEXT_PRIMARY,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectBoxText: {
    fontSize: 14.5,
    color: CATHAY_TEXT_PRIMARY,
    fontWeight: '500',
  },
  multilineInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: CATHAY_TEXT_PRIMARY,
    minHeight: 100,
    lineHeight: 20,
  },

  addPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  photoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoText: {
    fontSize: 14,
    color: CATHAY_TEXT_PRIMARY,
    fontWeight: '500',
  },

  submitBtn: {
    marginTop: 10,
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
