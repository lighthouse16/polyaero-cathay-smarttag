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
  SmartTagScanResult,
} from '@polyaero/shared';

export default function StartupScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SmartTagScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSimulateNfcTap = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    try {
      const result = await nfcService.readTagUid();
      setScanResult(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unexpected NFC operation error.');
      }
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
            <Text style={styles.taglineText}>POLYAERO • CATHAY HACKATHON 2026</Text>
          </View>
          <Text style={styles.title}>Cathay SmartTag</Text>
          <Text style={styles.subtitle}>
            Reusable Digital Baggage Identity Platform
          </Text>
        </View>

        {/* Phase 0 Status Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerHeading}>Engineering Foundation Ready</Text>
          <Text style={styles.bannerBody}>
            Native Expo environment, strict TypeScript contracts, and NFC service
            abstraction initialized.
          </Text>
          <Text style={styles.bannerNotice}>
            Research prototype for Cathay Hackathon 2026. Awaiting Cathay App screenshots for UI reconstruction.
          </Text>
        </View>

        {/* Passenger Profile Pill */}
        <View style={styles.passengerRow}>
          <Text style={styles.passengerLabel}>Logged In Passenger:</Text>
          <Text style={styles.passengerName}>
            {mockPassenger.firstName} {mockPassenger.lastName} ({mockPassenger.tierStatus})
          </Text>
        </View>

        {/* Live SmartTag Prototype Preview */}
        <SmartTagCard tag={mockSmartTag} baggage={mockBaggageList[0]} />

        {/* NFC Interaction Simulation Card */}
        <View style={styles.nfcCard}>
          <Text style={styles.nfcTitle}>Passive NFC Interface</Text>
          <Text style={styles.nfcDesc}>
            Simulate contactless tag touch and E-ink data inspection.
          </Text>

          <TouchableOpacity
            style={[styles.nfcButton, isScanning && styles.nfcButtonDisabled]}
            onPress={handleSimulateNfcTap}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nfcButtonText}>Simulate NFC Touch</Text>
            )}
          </TouchableOpacity>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {scanResult && (
            <View style={styles.scanResultBox}>
              <Text style={styles.scanResultTitle}>
                NFC Tag Read: SUCCESS {scanResult.isMockSimulation ? '(SIMULATED)' : ''}
              </Text>
              <Text style={styles.scanResultDetail}>
                UID: {scanResult.tagUid}
              </Text>
              {scanResult.payload && (
                <Text style={styles.scanResultDetail}>
                  Flight: {scanResult.payload.flightNumber} ({scanResult.payload.originAirport} → {scanResult.payload.destinationAirport})
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PolyAero Engineering Foundation</Text>
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
  errorBox: {
    backgroundColor: colors.status.dangerBackground,
    borderColor: colors.status.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.caption,
    color: colors.status.danger,
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
