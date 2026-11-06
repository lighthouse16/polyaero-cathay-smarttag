import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, typography, shadows } from '../src/theme';
import { SmartTagCard } from '../src/features/smarttag/SmartTagCard';
import { nfcService } from '../src/services/nfc';
import {
  mockSmartTag,
  mockBaggageList,
  mockPassenger,
  NfcScanResult,
} from '@polyaero/shared';

export default function StartupScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<NfcScanResult | null>(null);

  const handleSimulateNfcTap = async () => {
    setIsScanning(true);
    try {
      const result = await nfcService.startScan(700);
      setLastScanResult(result);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Prototype Header */}
        <View style={styles.header}>
          <View style={styles.taglineBadge}>
            <Text style={styles.taglineText}>CATHAY HACKATHON 2026</Text>
          </View>
          <Text style={styles.title}>PolyAero SmartTag</Text>
          <Text style={styles.subtitle}>
            Digital Baggage Identity Platform Prototype
          </Text>
        </View>

        {/* Phase 0 Status Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerHeading}>Phase 0: Scaffold Ready</Text>
          <Text style={styles.bannerBody}>
            Native Expo mobile shell, TypeScript strict contracts, and NFC mock
            service successfully initialized.
          </Text>
          <Text style={styles.bannerNotice}>
            * Unofficial PolyAero Hackathon Concept. Awaiting Cathay App screenshots for pixel-perfect UI reconstruction.
          </Text>
        </View>

        {/* Passenger Profile Pill */}
        <View style={styles.passengerRow}>
          <Text style={styles.passengerLabel}>Logged In Mock Passenger:</Text>
          <Text style={styles.passengerName}>
            {mockPassenger.firstName} {mockPassenger.lastName} ({mockPassenger.tierStatus})
          </Text>
        </View>

        {/* Live SmartTag Prototype Preview */}
        <SmartTagCard tag={mockSmartTag} baggage={mockBaggageList[0]} />

        {/* NFC Interaction Simulation Card */}
        <View style={styles.nfcCard}>
          <Text style={styles.nfcTitle}>NFC Hardware Simulator</Text>
          <Text style={styles.nfcDesc}>
            Test contactless E-ink sync and tag reading without physical hardware.
          </Text>

          <TouchableOpacity
            style={[styles.nfcButton, isScanning && styles.nfcButtonDisabled]}
            onPress={handleSimulateNfcTap}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nfcButtonText}>Simulate NFC Tap to Tag</Text>
            )}
          </TouchableOpacity>

          {lastScanResult && (
            <View style={styles.scanResultBox}>
              <Text style={styles.scanResultTitle}>
                Scan Status: {lastScanResult.status}
              </Text>
              <Text style={styles.scanResultDetail}>
                UID: {lastScanResult.tagUid}
              </Text>
              {lastScanResult.payload && (
                <Text style={styles.scanResultDetail}>
                  Flight: {lastScanResult.payload.flightNumber} → {lastScanResult.payload.destinationAirport}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PolyAero Engineering • 2026</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  container: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  taglineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.jadeLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  taglineText: {
    color: colors.brand.jadePrimary,
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.fontSize.display,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  banner: {
    backgroundColor: '#EEF6F6',
    borderColor: colors.brand.jadePrimary,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerHeading: {
    fontSize: typography.fontSize.subtitle,
    fontWeight: '700',
    color: colors.brand.jadeDark,
    marginBottom: spacing.xs,
  },
  bannerBody: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  bannerNotice: {
    fontSize: 11,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  passengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  passengerLabel: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.secondary,
  },
  passengerName: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: '700',
    color: colors.brand.jadePrimary,
  },
  nfcCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.sm,
    marginTop: spacing.md,
  },
  nfcTitle: {
    fontSize: typography.fontSize.subtitle,
    fontWeight: '700',
    color: colors.text.primary,
  },
  nfcDesc: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.secondary,
    marginVertical: spacing.xs,
  },
  nfcButton: {
    backgroundColor: colors.brand.jadePrimary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  nfcButtonDisabled: {
    opacity: 0.6,
  },
  nfcButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.body,
    fontWeight: '600',
  },
  scanResultBox: {
    backgroundColor: colors.status.successBackground,
    borderColor: colors.status.success,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  scanResultTitle: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: '700',
    color: colors.status.success,
  },
  scanResultDetail: {
    fontSize: typography.fontSize.caption,
    color: colors.text.primary,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing.lg,
  },
  footerText: {
    fontSize: typography.fontSize.caption,
    color: colors.text.muted,
  },
});
