import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAuthProfile } from './CathayTypes';

interface CathayWelcomeToastModalProps {
  visible: boolean;
  user: UserAuthProfile;
  onFinish: () => void;
}

export const CathayWelcomeToastModal: React.FC<CathayWelcomeToastModalProps> = ({
  visible,
  user,
  onFinish,
}) => {
  const [stage, setStage] = useState<'welcome' | 'notifications'>('welcome');

  const handleNext = () => {
    if (stage === 'welcome') {
      setStage('notifications');
    } else {
      onFinish();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onFinish}>
      <SafeAreaView style={styles.safeArea}>
        {stage === 'welcome' && (
          <View style={styles.container}>
            {/* Champagne Toast Hero Image */}
            <Image
              source={require('../../../assets/cathay/welcome-champagne.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />

            <View style={styles.content}>
              <Text style={styles.title}>Welcome to Cathay</Text>
              <Text style={styles.subtitle}>It's great to have you on board.</Text>

              {/* Membership Card Callout Box */}
              <View style={styles.cardCallout}>
                <Text style={styles.calloutHeading}>Add your membership card</Text>
                <Text style={styles.calloutText}>
                  Add your Cathay membership card to your digital wallet and use this to earn Asia Miles and Status Points, access exclusive benefits and more.
                </Text>

                {/* Green Digital Membership Card */}
                <View style={styles.digitalCard}>
                  <View style={styles.cardTopRow}>
                    <Image
                      source={require('../../../assets/cathay/cathay-brushwing-white.png')}
                      style={styles.brushwingIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.cardStatusText}>{user.tierStatus.toUpperCase()}</Text>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.cardName}>{`${user.familyName} ${user.givenName}`.toUpperCase()}</Text>
                    <Text style={styles.cardNumber}>{user.membershipNumber}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {stage === 'notifications' && (
          <View style={styles.notifContainer}>
            <View style={styles.notifContent}>
              <View style={styles.notifIconCircle}>
                <Ionicons name="airplane" size={32} color="#006564" />
              </View>

              <Text style={styles.notifTitle}>Stay up-to-date with important flight updates</Text>
              <Text style={styles.notifSubtitle}>
                Turn on notifications so you won't miss important flight updates and exclusive offers.
              </Text>

              <TouchableOpacity style={styles.primaryButton} onPress={onFinish} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Allow notifications</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryTextButton} onPress={onFinish} activeOpacity={0.7}>
                <Text style={styles.secondaryTextButtonLabel}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 190,
  },
  content: {
    padding: 24,
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C2024',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
  },
  cardCallout: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calloutHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 6,
  },
  calloutText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    marginBottom: 16,
  },
  digitalCard: {
    backgroundColor: '#568B87',
    borderRadius: 12,
    padding: 16,
    height: 130,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brushwingIcon: {
    width: 24,
    height: 22,
  },
  cardStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardBottomRow: {},
  cardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardNumber: {
    color: '#D1EAE7',
    fontSize: 12,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#233D3B',
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '400',
  },
  notifContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  notifContent: {
    alignItems: 'center',
  },
  notifIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E6F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  notifTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C2024',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  notifSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 36,
  },
  secondaryTextButton: {
    marginTop: 16,
    padding: 8,
  },
  secondaryTextButtonLabel: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
});
