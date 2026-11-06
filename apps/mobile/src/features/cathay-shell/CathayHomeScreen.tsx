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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export interface CathayHomeScreenProps {
  onSelectTab?: (tab: 'home' | 'book' | 'trips' | 'profile' | 'tools') => void;
  onSearchPress?: () => void;
  onOffersPress?: () => void;
  onSignInPress?: () => void;
  activeTab?: 'home' | 'book' | 'trips' | 'profile' | 'tools';
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
  onSelectTab,
  onSearchPress,
  onOffersPress,
  onSignInPress,
  activeTab = 'home',
}) => {
  const [currentTab, setCurrentTab] = useState<'home' | 'book' | 'trips' | 'profile' | 'tools'>(
    activeTab
  );

  const handleTabChange = (tab: 'home' | 'book' | 'trips' | 'profile' | 'tools') => {
    setCurrentTab(tab);
    onSelectTab?.(tab);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header Area with Skyline Background */}
        <ImageBackground
          source={require('../../../assets/cathay/cathay-hero-skyline.png')}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <SafeAreaView style={styles.headerSafeArea}>
            {/* Top Navigation Row */}
            <View style={styles.headerNavRow}>
              <View style={styles.headerSpacer} />

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
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.7}
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
                onPress={onSignInPress}
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
              onPress={onSearchPress}
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
                <Ionicons name="airplane" size={17} color="#006564" />
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

          {/* Promo Callout Card */}
          <TouchableOpacity
            style={styles.promoBanner}
            onPress={onOffersPress}
            activeOpacity={0.85}
            testID="promo-callout-banner"
          >
            <Ionicons name="ticket-outline" size={22} color="#1C2024" />
            <View style={styles.promoTextContainer}>
              <Text style={styles.promoText}>
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
            contentContainerStyle={styles.carouselContainer}
          >
            {DESTINATION_OFFERS.map((offer) => (
              <TouchableOpacity
                key={offer.id}
                style={styles.destinationCard}
                activeOpacity={0.9}
                onPress={onSearchPress}
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

      {/* Fixed Bottom Tab Bar (5 Tabs) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('home')}
          activeOpacity={0.8}
          testID="tab-home"
        >
          <Ionicons
            name="home"
            size={22}
            color={currentTab === 'home' ? '#006564' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'home' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('book')}
          activeOpacity={0.8}
          testID="tab-book"
        >
          <Ionicons
            name="airplane-outline"
            size={22}
            color={currentTab === 'book' ? '#006564' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'book' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Book
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('trips')}
          activeOpacity={0.8}
          testID="tab-trips"
        >
          <Ionicons
            name="briefcase-outline"
            size={22}
            color={currentTab === 'trips' ? '#006564' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'trips' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            My trips
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('profile')}
          activeOpacity={0.8}
          testID="tab-profile"
        >
          <Ionicons
            name="person-outline"
            size={22}
            color={currentTab === 'profile' ? '#006564' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'profile' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('tools')}
          activeOpacity={0.8}
          testID="tab-tools"
        >
          <Ionicons
            name="grid-outline"
            size={22}
            color={currentTab === 'tools' ? '#006564' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'tools' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Travel tools
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroBackground: {
    width: '100%',
    height: 250,
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
  },
  brushwingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushwingIcon: {
    width: 26,
    height: 26,
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
    paddingHorizontal: 16,
    marginTop: -28,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
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
    marginTop: 16,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
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
    marginTop: 26,
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
    backgroundColor: '#EBF4F1',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 14,
  },
  promoTextContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  promoText: {
    fontSize: 14,
    lineHeight: 19,
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
    width: 172,
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
    height: 114,
  },
  destinationDetails: {
    padding: 14,
  },
  destinationCity: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C2024',
  },
  destinationCabin: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 11,
    color: '#718096',
    marginTop: 14,
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
    height: Platform.OS === 'ios' ? 78 : 62,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
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
