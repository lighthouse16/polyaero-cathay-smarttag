import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export interface CathayHomeScreenProps {
  onOpenDevMenu?: () => void;
  onSearchPress?: () => void;
  onOffersPress?: () => void;
}

interface DestinationOffer {
  id: string;
  city: string;
  cabin: string;
  currency: string;
  price: string;
  image: any;
}

const DESTINATION_OFFERS: DestinationOffer[] = [
  {
    id: 'nanjing',
    city: 'Nanjing',
    cabin: 'Economy',
    currency: 'HKD',
    price: '3,030',
    image: require('../../../assets/cathay/dest-nanjing.png'),
  },
  {
    id: 'beijing',
    city: 'Beijing',
    cabin: 'Economy',
    currency: 'HKD',
    price: '3,670',
    image: require('../../../assets/cathay/dest-beijing.png'),
  },
  {
    id: 'seoul',
    city: 'Seoul',
    cabin: 'Economy',
    currency: 'HKD',
    price: '2,450',
    image: require('../../../assets/cathay/dest-seoul.png'),
  },
];

export const CathayHomeScreen: React.FC<CathayHomeScreenProps> = ({
  onOpenDevMenu,
  onSearchPress,
  onOffersPress,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleTabPress = (tabName: string) => {
    if (tabName === 'Home') return;
    if (tabName === 'My trips') {
      showToast('My trips pending reference in Phase 1B. SmartTag prototype is available in Dev Menu.');
    } else {
      showToast(`${tabName} screen is pending reference in Phase 1B.`);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Subtle Feedback Banner for Non-Implemented Features */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Non-Functional Auth Demo Dialog */}
      <Modal
        visible={showAuthModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Authentication Notice</Text>
            <Text style={styles.modalBody}>
              Member sign in and registration require Cathay Pacific identity integration.
              In this hackathon prototype, passenger flows run in guest mode.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAuthModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseText}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header Area with Clean Photographic Skyline Background */}
        <ImageBackground
          source={require('../../../assets/cathay/cathay-hero-skyline.png')}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <SafeAreaView style={styles.headerSafeArea}>
            {/* Top Navigation Row */}
            <View style={styles.headerNavRow}>
              {/* Invisible secret trigger zone for dev menu */}
              <TouchableOpacity
                style={styles.headerSpacer}
                onLongPress={onOpenDevMenu}
                activeOpacity={1}
                accessibilityLabel="Dev menu trigger"
              />

              {/* Center White Brushwing Logo */}
              <View style={styles.brushwingContainer}>
                <Image
                  source={require('../../../assets/cathay/cathay-brushwing-white.png')}
                  style={styles.brushwingIcon}
                  resizeMode="contain"
                />
              </View>

              {/* Right Action Icons (Notifications + More) */}
              <View style={styles.headerIconsGroup}>
                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.7}
                  onPress={() => showToast('No new notifications.')}
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.7}
                  onPress={onOpenDevMenu}
                  accessibilityLabel="More options"
                >
                  <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Member Prompt Banner */}
            <View style={styles.memberPromptRow}>
              <Text style={styles.memberPromptTitle}>Become a Cathay member</Text>

              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => setShowAuthModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>Sign in / Sign up</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>

        {/* Flight Search Card (Floats over hero) */}
        <View style={styles.searchCardWrapper}>
          <View style={styles.searchCard}>
            <Text style={styles.searchCardTitle}>Where can we take you?</Text>

            <TouchableOpacity
              style={styles.routeSelectorRow}
              onPress={onSearchPress || (() => showToast('Flight booking flow scheduled for Phase 1B.'))}
              activeOpacity={0.85}
              testID="flight-search-selector"
            >
              {/* Origin */}
              <View style={styles.originCol}>
                <Text style={styles.routeLabel}>From</Text>
                <Text style={styles.airportCode}>HKG</Text>
                <Text style={styles.cityName}>Hong Kong</Text>
              </View>

              {/* Center Airplane Badge */}
              <View style={styles.airplaneBadge}>
                <Ionicons name="airplane" size={16} color="#006564" />
              </View>

              {/* Destination */}
              <View style={styles.destCol}>
                <Text style={styles.routeLabelRight}>To</Text>
                <Text style={styles.searchCode}>Search</Text>
                <Text style={styles.cityNameRight}>Destination</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Our Latest Offers Section */}
        <View style={styles.offersSection}>
          <Text style={styles.sectionTitle}>Our latest offers</Text>

          {/* Promo Callout Card (Accurate #DDE7E6 surface) */}
          <TouchableOpacity
            style={styles.promoBanner}
            onPress={onOffersPress || (() => showToast('Promotions browser scheduled for Phase 1B.'))}
            activeOpacity={0.85}
            testID="promo-callout-banner"
          >
            <Ionicons name="ticket-outline" size={22} color="#1C2024" />
            <View style={styles.promoTextContainer}>
              <Text style={styles.promoText} numberOfLines={2}>
                <Text style={styles.promoBold}>Flying soon? </Text>
                Browse our lowest fares for next 60 days.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#718096" />
          </TouchableOpacity>

          {/* Origin Indicator */}
          <View style={styles.originIndicatorRow}>
            <Text style={styles.fromLabel}>
              From: <Text style={styles.fromCity}>Hong Kong</Text>
            </Text>
          </View>

          {/* Destination Horizontal Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carouselScrollView}
            contentContainerStyle={styles.carouselContainer}
          >
            {DESTINATION_OFFERS.map((offer) => (
              <TouchableOpacity
                key={offer.id}
                style={styles.destinationCard}
                activeOpacity={0.9}
                onPress={() => showToast(`Selected destination: ${offer.city}`)}
              >
                <Image source={offer.image} style={styles.destinationImage} resizeMode="cover" />
                <View style={styles.destinationDetails}>
                  <Text style={styles.destinationCity}>{offer.city}</Text>
                  <Text style={styles.destinationCabin}>{offer.cabin}</Text>

                  <Text style={styles.priceLabel}>from</Text>
                  <Text style={styles.priceValue}>
                    {offer.currency}
                    {offer.price}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Padding for Bottom Nav Bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed Bottom Tab Bar (Home is locked active; other tabs show status notice) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.8}
          testID="tab-home"
        >
          <Ionicons name="home" size={22} color="#006564" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('Book')}
          activeOpacity={0.8}
          testID="tab-book"
        >
          <Ionicons name="airplane-outline" size={22} color="#718096" />
          <Text style={[styles.tabLabel, styles.tabLabelInactive]}>Book</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('My trips')}
          activeOpacity={0.8}
          testID="tab-trips"
        >
          <Ionicons name="briefcase-outline" size={22} color="#718096" />
          <Text style={[styles.tabLabel, styles.tabLabelInactive]}>My trips</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('Profile')}
          activeOpacity={0.8}
          testID="tab-profile"
        >
          <Ionicons name="person-outline" size={22} color="#718096" />
          <Text style={[styles.tabLabel, styles.tabLabelInactive]}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('Travel tools')}
          activeOpacity={0.8}
          testID="tab-tools"
        >
          <Ionicons name="grid-outline" size={22} color="#718096" />
          <Text style={[styles.tabLabel, styles.tabLabelInactive]}>Travel tools</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
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
  modalCloseButton: {
    backgroundColor: '#006564',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  mainScroll: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 20,
    width: '100%',
    maxWidth: '100%',
  },
  carouselScrollView: {
    width: '100%',
    maxWidth: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  heroBackground: {
    width: '100%',
    height: 220,
    justifyContent: 'space-between',
  },
  headerSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 32 : 8,
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  headerSpacer: {
    width: 60,
    height: 44,
  },
  brushwingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushwingIcon: {
    width: 26,
    height: 24,
  },
  headerIconsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    justifyContent: 'flex-end',
    gap: 12,
  },
  iconButton: {
    position: 'relative',
    padding: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  memberPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 44,
    paddingHorizontal: 4,
  },
  memberPromptTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  signInButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  searchCardWrapper: {
    marginHorizontal: 16,
    marginTop: -32,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
    letterSpacing: -0.2,
  },
  routeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  originCol: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '400',
  },
  airportCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#006564',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  cityName: {
    fontSize: 13,
    color: '#4A5568',
    marginTop: 2,
  },
  airplaneBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  destCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  routeLabelRight: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '400',
  },
  searchCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#006564',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  cityNameRight: {
    fontSize: 13,
    color: '#4A5568',
    marginTop: 2,
  },
  offersSection: {
    marginTop: 24,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: '#1C2024',
    paddingHorizontal: 16,
    letterSpacing: -0.3,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DDE7E6',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 14,
  },
  promoTextContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  promoText: {
    fontSize: 13.5,
    lineHeight: 18,
    color: '#1A202C',
  },
  promoBold: {
    fontWeight: '700',
  },
  originIndicatorRow: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  fromLabel: {
    fontSize: 14,
    color: '#4A5568',
  },
  fromCity: {
    color: '#006564',
    fontWeight: '600',
  },
  carouselContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  destinationCard: {
    width: 154,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  destinationImage: {
    width: '100%',
    height: 104,
  },
  destinationDetails: {
    padding: 12,
  },
  destinationCity: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#1C2024',
  },
  destinationCabin: {
    fontSize: 12.5,
    color: '#718096',
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 11,
    color: '#718096',
    marginTop: 12,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
    marginTop: 1,
  },
  bottomSpacer: {
    height: 70,
  },
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#006564',
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: '#718096',
    fontWeight: '400',
  },
});
