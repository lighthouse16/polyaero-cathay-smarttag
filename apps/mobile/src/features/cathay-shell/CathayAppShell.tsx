import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CathaySplashScreen } from './CathaySplashScreen';
import { CathayLanguageModal } from './CathayLanguageModal';
import { CathayMemberWelcomeScreen } from './CathayMemberWelcomeScreen';
import { CathayHomeScreen } from './CathayHomeScreen';
import { SmartTagCard } from '../smarttag/SmartTagCard';
import { nfcService } from '../../services/nfc';
import {
  mockSmartTag,
  mockBaggageList,
  mockPassenger,
  SmartTagScanResult,
} from '@polyaero/shared';
import { colors, spacing, radii, typography, shadows } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export type CathayScreenId = 'splash' | 'language' | 'welcome' | 'home' | 'trips';

export const CathayAppShell: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<CathayScreenId>('splash');
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

  const renderCurrentScreen = () => {
    switch (activeScreen) {
      case 'splash':
        return (
          <CathaySplashScreen
            onContinue={() => setActiveScreen('language')}
            autoAdvance={true}
          />
        );

      case 'language':
        return (
          <CathayLanguageModal
            onConfirm={() => setActiveScreen('welcome')}
          />
        );

      case 'welcome':
        return (
          <CathayMemberWelcomeScreen
            onSignUp={() => setActiveScreen('home')}
            onSignIn={() => setActiveScreen('home')}
            onContinueAsGuest={() => setActiveScreen('home')}
          />
        );

      case 'home':
        return (
          <CathayHomeScreen
            activeTab="home"
            onSelectTab={(tab) => {
              if (tab === 'trips') {
                setActiveScreen('trips');
              }
            }}
            onSignInPress={() => setActiveScreen('welcome')}
          />
        );

      case 'trips':
        return (
          <View style={styles.tripsScreenContainer}>
            <SafeAreaView style={styles.tripsHeader}>
              <View style={styles.tripsNavRow}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setActiveScreen('home')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color="#006564" />
                  <Text style={styles.backButtonText}>Cathay Home</Text>
                </TouchableOpacity>

                <Text style={styles.tripsTitle}>My Trips & Baggage</Text>
                <View style={styles.backButtonPlaceholder} />
              </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.tripsContent}>
              <View style={styles.taglineBadge}>
                <Text style={styles.taglineText}>POLYAERO • CATHAY SMARTTAG</Text>
              </View>

              <View style={styles.passengerRow}>
                <Text style={styles.passengerLabel}>Logged In Passenger:</Text>
                <Text style={styles.passengerName}>
                  {mockPassenger.firstName} {mockPassenger.lastName} ({mockPassenger.tierStatus})
                </Text>
              </View>

              {/* Digital Baggage SmartTag Prototype */}
              <SmartTagCard tag={mockSmartTag} baggage={mockBaggageList[0]} />

              {/* NFC Interaction Simulation Card */}
              <View style={styles.nfcCard}>
                <Text style={styles.nfcHeading}>NFC Hardware Interaction</Text>
                <Text style={styles.nfcDescription}>
                  Simulate bringing an NFC-enabled smartphone close to the physical SmartTag.
                </Text>

                <TouchableOpacity
                  style={[styles.nfcButton, isScanning && styles.nfcButtonDisabled]}
                  onPress={handleSimulateNfcTap}
                  disabled={isScanning}
                  activeOpacity={0.8}
                >
                  {isScanning ? (
                    <ActivityIndicator color={colors.text.inverse} />
                  ) : (
                    <Text style={styles.nfcButtonText}>Simulate NFC Tag Tap</Text>
                  )}
                </TouchableOpacity>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {scanResult && (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultHeading}>Tag Scanned Successfully</Text>
                    <Text style={styles.resultRow}>
                      <Text style={styles.resultLabel}>UID: </Text>
                      {scanResult.tagUid}
                    </Text>
                    {scanResult.payload?.baggageTagNumber && (
                      <Text style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Tag Number: </Text>
                        {scanResult.payload.baggageTagNumber}
                      </Text>
                    )}
                    {scanResult.payload?.flightNumber && (
                      <Text style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Flight: </Text>
                        {scanResult.payload.flightNumber}
                      </Text>
                    )}
                    <Text style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Mode: </Text>
                      {scanResult.isMockSimulation ? 'Simulated RFID/NFC Tag' : 'Hardware NFC'}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      {/* Screen Presentation */}
      <View style={styles.screenArea}>{renderCurrentScreen()}</View>

      {/* Screen Switcher Bar (For evaluation & demo across all 4 screens) */}
      <View style={styles.screenSwitcherBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.switcherContent}
        >
          <Text style={styles.switcherLabel}>SCREEN:</Text>
          {(['splash', 'language', 'welcome', 'home', 'trips'] as const).map((screen) => (
            <TouchableOpacity
              key={screen}
              style={[
                styles.switcherPill,
                activeScreen === screen && styles.switcherPillActive,
              ]}
              onPress={() => setActiveScreen(screen)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.switcherPillText,
                  activeScreen === screen && styles.switcherPillTextActive,
                ]}
              >
                {screen === 'language' ? 'Language Modal' : screen === 'trips' ? 'SmartTag' : screen.charAt(0).toUpperCase() + screen.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screenArea: {
    flex: 1,
  },
  screenSwitcherBar: {
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  switcherContent: {
    alignItems: 'center',
    gap: 6,
  },
  switcherLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  switcherPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  switcherPillActive: {
    backgroundColor: '#006564',
  },
  switcherPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  switcherPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tripsScreenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tripsHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  tripsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#006564',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 2,
  },
  backButtonPlaceholder: {
    width: 60,
  },
  tripsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
  },
  tripsContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  taglineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.jadeLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  taglineText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand.jadePrimary,
    letterSpacing: 0.5,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  passengerLabel: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  passengerName: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  nfcCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    ...shadows.md,
  },
  nfcHeading: {
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  nfcDescription: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.bodySm,
    marginBottom: spacing.lg,
  },
  nfcButton: {
    backgroundColor: colors.brand.jadePrimary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcButtonDisabled: {
    opacity: 0.6,
  },
  nfcButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.status.dangerBackground,
    borderRadius: radii.sm,
  },
  errorText: {
    color: colors.status.danger,
    fontSize: typography.fontSize.bodySm,
  },
  resultBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.status.successBackground,
    borderRadius: radii.sm,
  },
  resultHeading: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.bold,
    color: colors.status.success,
    marginBottom: spacing.xs,
  },
  resultRow: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.primary,
    marginTop: spacing.xxs,
  },
  resultLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
});
