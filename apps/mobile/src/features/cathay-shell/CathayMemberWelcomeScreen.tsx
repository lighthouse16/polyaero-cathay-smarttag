import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface CathayMemberWelcomeScreenProps {
  onContinueAsGuest?: () => void;
}

export const CathayMemberWelcomeScreen: React.FC<CathayMemberWelcomeScreenProps> = ({
  onContinueAsGuest,
}) => {
  const [authNoticeType, setAuthNoticeType] = useState<'signin' | 'signup' | null>(null);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Non-Functional Auth Demo Modal */}
      <Modal
        visible={authNoticeType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAuthNoticeType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {authNoticeType === 'signup' ? 'Member Registration' : 'Member Sign In'}
            </Text>
            <Text style={styles.modalBody}>
              Production Cathay member authentication is not active in this hackathon prototype.
              You can explore the passenger experience and SmartTag features in guest mode.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setAuthNoticeType(null);
                onContinueAsGuest?.();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>Continue as Guest Passenger</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => setAuthNoticeType(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Tail Hero Image (Accurate 215pt height) */}
          <View style={styles.heroWrapper}>
            <Image
              source={require('../../../assets/cathay/cathay-hero-tail.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            <Text style={styles.heading}>
              Become a Cathay member{'\n'}today
            </Text>

            <Text style={styles.subheading}>
              Unlock a world of exclusive member benefits and rewards:
            </Text>

            <View style={styles.benefitList}>
              <Text style={styles.benefitItem}>– 48-hour priority online check-in</Text>
              <Text style={styles.benefitItem}>– 24-hour free cancellation</Text>
            </View>

            <Text style={styles.programmeNotice}>
              Our{' '}
              <Text style={styles.programmeLink}>enhanced membership programme</Text>
              {' '}launches in 2027. Any renewal, upgrade, or newly signed up membership within this
              year will end on <Text style={styles.boldText}>31 December 2026</Text>. Your Status
              Points will be reset to zero on 1 January 2027 while Asia Miles earned will remain active
              with one eligible transaction every 18 months.
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setAuthNoticeType('signup')}
                activeOpacity={0.85}
                testID="welcome-signup-button"
              >
                <Text style={styles.primaryButtonText}>Sign up now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setAuthNoticeType('signin')}
                activeOpacity={0.7}
                testID="welcome-signin-button"
              >
                <Text style={styles.secondaryButtonText}>Sign in</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tertiaryButton}
                onPress={onContinueAsGuest}
                activeOpacity={0.6}
                testID="welcome-guest-button"
              >
                <Text style={styles.tertiaryButtonText}>Continue without signing in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroWrapper: {
    width: '100%',
    height: 215,
    backgroundColor: '#D1E0E5',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  heading: {
    fontSize: 27,
    fontWeight: '400',
    color: '#1C2024',
    letterSpacing: -0.3,
    lineHeight: 35,
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  benefitList: {
    marginBottom: 18,
  },
  benefitItem: {
    fontSize: 15,
    lineHeight: 24,
    color: '#2D3748',
  },
  programmeNotice: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4A5568',
    marginBottom: 28,
  },
  programmeLink: {
    color: '#006564',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '700',
    color: '#1A202C',
  },
  actionsContainer: {
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#284239',
    borderRadius: 3,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#006564',
    borderRadius: 3,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#006564',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  tertiaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButtonText: {
    color: '#006564',
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A5568',
    marginBottom: 20,
  },
  modalPrimaryBtn: {
    backgroundColor: '#006564',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSecondaryBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
});
