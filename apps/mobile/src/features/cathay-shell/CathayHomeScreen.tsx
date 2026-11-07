import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAuthProfile, RecentSearch } from './CathayTypes';

interface CathayHomeScreenProps {
  user: UserAuthProfile;
  recentSearch?: RecentSearch | null;
  onSearchPress?: () => void;
  onOffersPress?: () => void;
  onOpenSignIn?: () => void;
  onOpenMessageCentre?: () => void;
  onOpenDevMenu?: () => void;
}

export const CathayHomeScreen: React.FC<CathayHomeScreenProps> = ({
  user,
  recentSearch,
  onSearchPress,
  onOffersPress,
  onOpenSignIn,
  onOpenMessageCentre,
  onOpenDevMenu,
}) => {
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(true);
  const hasPasskeyBanner = Boolean(user.isLoggedIn && showPasskeyPrompt);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. HERO HEADER AREA WITH SKYLINE PHOTOGRAPHY */}
        <ImageBackground
          source={require('../../../assets/cathay/cathay-hero-skyline.png')}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <SafeAreaView style={styles.headerSafeArea}>
            {/* Top Navigation Row */}
            <View style={styles.headerNavRow}>
              {/* Secret trigger zone for dev menu */}
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
                  onPress={onOpenMessageCentre}
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

            {/* Member Prompt Banner / Greeting (Matching Video frame #71 vs frame #59) */}
            <View style={styles.memberPromptRow}>
              {user.isLoggedIn ? (
                <View style={styles.memberGreetingCol}>
                  <Text style={styles.memberGreetingTitle}>Hello {user.title} {user.familyName}</Text>
                  <View style={styles.memberMilesRow}>
                    <Ionicons name="ticket-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.memberMilesText}>A {user.asiaMiles}</Text>
                    <Text style={styles.memberDotSeparator}>|</Text>
                    <Text style={styles.memberStatusPointsText}>Status Points {user.statusPoints}</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.memberPromptTitle}>Become a Cathay member</Text>
                  <TouchableOpacity
                    style={styles.signInButton}
                    onPress={onOpenSignIn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.signInButtonText}>Sign in / Sign up</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </SafeAreaView>
        </ImageBackground>

        {/* 2. PASSKEY BANNER (Matching video frame #71 / #182) */}
        {user.isLoggedIn && showPasskeyPrompt && (
          <View style={styles.passkeyBannerWrapper}>
            <View style={styles.passkeyBanner}>
              <View style={styles.passkeyIconWrap}>
                <Ionicons name="key" size={16} color="#006564" />
              </View>
              <View style={styles.passkeyTextCol}>
                <Text style={styles.passkeyTitle}>Want to stay signed in?</Text>
                <Text style={styles.passkeySub}>Create a passkey now for a safer, easier way to sign in.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPasskeyPrompt(false)} style={styles.passkeyCloseBtn}>
                <Ionicons name="close" size={18} color="#718096" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. FLIGHT SEARCH CARD (Floats over hero or sits below passkey banner) */}
        <View style={[styles.searchCardWrapper, hasPasskeyBanner && styles.searchCardWrapperWithPasskey]}>
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

        {/* 4. RECENT SEARCHES CARD (Matching video frame #182) */}
        {recentSearch && (
          <View style={styles.recentSearchesWrapper}>
            <Text style={styles.recentSectionTitle}>Recent searches</Text>
            <TouchableOpacity style={styles.recentSearchCard} onPress={onSearchPress} activeOpacity={0.85}>
              <View style={styles.recentPlaneCircle}>
                <Ionicons name="airplane" size={16} color="#006564" />
              </View>
              <View style={styles.recentTextCol}>
                <Text style={styles.recentDatesText}>{recentSearch.dates}</Text>
                <Text style={styles.recentRouteText}>{recentSearch.origin} to {recentSearch.destination}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718096" />
            </TouchableOpacity>
          </View>
        )}

        {/* 5. CONTEXTUAL PLANE WING BANNER (Crisp high-res background + native typography) */}
        {recentSearch && recentSearch.destination === 'NKG' && (
          <TouchableOpacity
            style={styles.wingBannerWrapper}
            onPress={onSearchPress}
            activeOpacity={0.9}
          >
            <ImageBackground
              source={require('../../../assets/cathay/banner-wing-nanjing.jpg')}
              style={styles.wingBannerImage}
              imageStyle={{ borderRadius: 12 }}
              resizeMode="cover"
            >
              <View style={styles.wingBannerOverlay}>
                <View style={styles.topPickPill}>
                  <Text style={styles.topPickPillText}>Top Pick</Text>
                </View>
                <View>
                  <Text style={styles.wingBannerHeading}>Nanjing on your mind?</Text>
                  <Text style={styles.wingBannerSub}>Pick it up at HKD5,674</Text>
                </View>

                <View style={styles.wingBookBtn}>
                  <Text style={styles.wingBookBtnText}>Book now</Text>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        )}

        {/* 6. OUR LATEST OFFERS SECTION */}
        <View style={styles.offersSection}>
          <Text style={styles.sectionTitle}>Our latest offers</Text>

          {/* Promo Callout Card (Accurate #DDE7E6 surface) */}
          <TouchableOpacity
            style={styles.promoBanner}
            onPress={onOffersPress || onSearchPress}
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
            <TouchableOpacity style={styles.destinationCard} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/dest-nanjing.png')} style={styles.destinationImage} resizeMode="cover" />
              <View style={styles.destinationDetails}>
                <Text style={styles.destinationCity}>Nanjing</Text>
                <Text style={styles.destinationCabin}>Economy</Text>
                <Text style={styles.priceLabel}>from</Text>
                <Text style={styles.priceValue}>HKD 3,030</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.destinationCard} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/dest-beijing.png')} style={styles.destinationImage} resizeMode="cover" />
              <View style={styles.destinationDetails}>
                <Text style={styles.destinationCity}>Beijing</Text>
                <Text style={styles.destinationCabin}>Economy</Text>
                <Text style={styles.priceLabel}>from</Text>
                <Text style={styles.priceValue}>HKD 3,670</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.destinationCard} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/dest-seoul.png')} style={styles.destinationImage} resizeMode="cover" />
              <View style={styles.destinationDetails}>
                <Text style={styles.destinationCity}>Seoul</Text>
                <Text style={styles.destinationCabin}>Economy</Text>
                <Text style={styles.priceLabel}>from</Text>
                <Text style={styles.priceValue}>HKD 2,710</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.destinationCard} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/dest-kaohsiung.jpg')} style={styles.destinationImage} resizeMode="cover" />
              <View style={styles.destinationDetails}>
                <Text style={styles.destinationCity}>Kaohsiung</Text>
                <Text style={styles.destinationCabin}>Economy</Text>
                <Text style={styles.priceLabel}>from</Text>
                <Text style={styles.priceValue}>HKD 1,892</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.destinationCard, styles.exploreCard]} activeOpacity={0.9} onPress={onSearchPress}>
              <View style={styles.exploreInner}>
                <Ionicons name="compass-outline" size={32} color="#006564" />
                <Text style={styles.exploreTitle}>Explore all 24 lowest fare destinations</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 7. DISCOVER FANTASTIC PROMOTIONS (Authentic layout: image -> headline -> date (#718096) -> price/offer (#006564)) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Discover fantastic promotions</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
            <TouchableOpacity style={styles.promoCardItem} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/promo-double11.jpg')} style={styles.promoCardImage} resizeMode="cover" />
              <View style={styles.promoCardDetails}>
                <Text style={styles.promoHeadlineText} numberOfLines={2}>Double 11 flight offer</Text>
                <View style={styles.promoDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#718096" style={styles.promoDateIcon} />
                  <Text style={styles.promoDateText}>11 Nov 2026</Text>
                </View>
                <Text style={styles.promoOfferText}>Up to 11% off</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promoCardItem} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/promo-almaty.jpg')} style={styles.promoCardImage} resizeMode="cover" />
              <View style={styles.promoCardDetails}>
                <Text style={styles.promoHeadlineText} numberOfLines={2}>Explore Almaty's wonders with direct flights</Text>
                <View style={styles.promoDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#718096" style={styles.promoDateIcon} />
                  <Text style={styles.promoDateText}>30 Nov 2026</Text>
                </View>
                <Text style={styles.promoOfferText}>From HKD 4,089</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promoCardItem} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/promo-student.jpg')} style={styles.promoCardImage} resizeMode="cover" />
              <View style={styles.promoCardDetails}>
                <Text style={styles.promoHeadlineText} numberOfLines={2}>Student Fare</Text>
                <View style={styles.promoDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#718096" style={styles.promoDateIcon} />
                  <Text style={styles.promoDateText}>31 Dec 2026</Text>
                </View>
                <Text style={styles.promoOfferText}>Up to 10% discount*</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promoCardItem} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/promo-family.jpg')} style={styles.promoCardImage} resizeMode="cover" />
              <View style={styles.promoCardDetails}>
                <Text style={styles.promoHeadlineText} numberOfLines={2}>Family Premium pass</Text>
                <View style={styles.promoDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#718096" style={styles.promoDateIcon} />
                  <Text style={styles.promoDateText}>15 Dec 2026</Text>
                </View>
                <Text style={styles.promoOfferText}>Special family perks</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promoCardItem} activeOpacity={0.9} onPress={onSearchPress}>
              <Image source={require('../../../assets/cathay/promo-offers.jpg')} style={styles.promoCardImage} resizeMode="cover" />
              <View style={styles.promoCardDetails}>
                <Text style={styles.promoHeadlineText} numberOfLines={2}>Special offers</Text>
                <View style={styles.promoDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#718096" style={styles.promoDateIcon} />
                  <Text style={styles.promoDateText}>Limited time</Text>
                </View>
                <Text style={styles.promoOfferText}>Plan your next journey</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 8. MORE WAYS TO EARN AND REDEEM MILES (Authentic carousel with charcoal icons matching video frames #62 & #183) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>More ways to earn and redeem miles</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moreWaysScrollContainer}
          >
            <TouchableOpacity style={styles.moreWaysItem} activeOpacity={0.7} onPress={onSearchPress}>
              <View style={styles.moreWaysCircle}>
                <Ionicons name="bed-outline" size={26} color="#1C2024" />
              </View>
              <Text style={styles.moreWaysLabel}>Book a hotel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreWaysItem} activeOpacity={0.7} onPress={onSearchPress}>
              <View style={styles.moreWaysCircle}>
                <Ionicons name="briefcase-outline" size={25} color="#1C2024" />
              </View>
              <Text style={styles.moreWaysLabel}>Book a package</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreWaysItem} activeOpacity={0.7} onPress={onSearchPress}>
              <View style={styles.moreWaysCircle}>
                <Ionicons name="umbrella-outline" size={26} color="#1C2024" />
              </View>
              <Text style={styles.moreWaysLabel}>Travel Insurance</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreWaysItem} activeOpacity={0.7} onPress={onSearchPress}>
              <View style={styles.moreWaysCircle}>
                <Ionicons name="car-outline" size={26} color="#1C2024" />
              </View>
              <Text style={styles.moreWaysLabel}>Rent a car</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreWaysItem} activeOpacity={0.7} onPress={onSearchPress}>
              <View style={styles.moreWaysCircle}>
                <Ionicons name="cart-outline" size={25} color="#1C2024" />
              </View>
              <Text style={styles.moreWaysLabel}>Cathay Shop</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 9. TRAVEL INSPIRATION (Authentic editorial carousel matching video frames #184-#188) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Travel inspiration</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
            <TouchableOpacity style={styles.articleCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/insp-macao.jpg')} style={styles.articleCardImage} resizeMode="cover" />
              <View style={styles.articleCardDetails}>
                <Text style={styles.articleLocation}>Macao (Macau) • Travel</Text>
                <Text style={styles.articleTitle} numberOfLines={2}>Cool Macao: where to find music, art and film</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.articleCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/insp-queensland.jpg')} style={styles.articleCardImage} resizeMode="cover" />
              <View style={styles.articleCardDetails}>
                <Text style={styles.articleLocation}>Queensland • Travel</Text>
                <Text style={styles.articleTitle} numberOfLines={2}>The best of Queensland's dinosaurs</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.articleCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/insp-asia-christmas.jpg')} style={styles.articleCardImage} resizeMode="cover" />
              <View style={styles.articleCardDetails}>
                <Text style={styles.articleLocation}>Asia • Culture</Text>
                <Text style={styles.articleTitle} numberOfLines={2}>Unique Christmas celebrations across Asia</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.articleCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/insp-asia-concerts.jpg')} style={styles.articleCardImage} resizeMode="cover" />
              <View style={styles.articleCardDetails}>
                <Text style={styles.articleLocation}>Asia • Events</Text>
                <Text style={styles.articleTitle} numberOfLines={2}>The best concerts to catch in Asia in 2026</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.articleCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/insp-kyoto.jpg')} style={styles.articleCardImage} resizeMode="cover" />
              <View style={styles.articleCardDetails}>
                <Text style={styles.articleLocation}>Japan • Culture</Text>
                <Text style={styles.articleTitle} numberOfLines={2}>Secret gardens and artisan workshops of Kyoto</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.articleCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/insp-london.jpg')} style={styles.articleCardImage} resizeMode="cover" />
              <View style={styles.articleCardDetails}>
                <Text style={styles.articleLocation}>United Kingdom • Travel</Text>
                <Text style={styles.articleTitle} numberOfLines={2}>A design lover's weekend guide to London</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 10. STAY UP-TO-DATE (Authentic news carousel matching video frames #188-#189) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Stay up-to-date</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
            <TouchableOpacity style={styles.newsCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/news-80th-popup.jpg')} style={styles.newsImage} resizeMode="cover" />
              <Text style={styles.newsTitle} numberOfLines={2}>Explore our 80th anniversary pop-up at the airport</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newsCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/news-80th-collection.jpg')} style={styles.newsImage} resizeMode="cover" />
              <Text style={styles.newsTitle} numberOfLines={2}>The 80th anniversary premium collection unveiled</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newsCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/news-lounge.jpg')} style={styles.newsImage} resizeMode="cover" />
              <Text style={styles.newsTitle} numberOfLines={2}>Experience the newly refreshed The Pier lounge</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newsCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/news-fleet.jpg')} style={styles.newsImage} resizeMode="cover" />
              <Text style={styles.newsTitle} numberOfLines={2}>Welcoming our next-generation A321neo fleet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newsCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/news-sustainability.jpg')} style={styles.newsImage} resizeMode="cover" />
              <Text style={styles.newsTitle} numberOfLines={2}>Cathay expands Sustainable Aviation Fuel programme</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newsCard} activeOpacity={0.9}>
              <Image source={require('../../../assets/cathay/news-dining.jpg')} style={styles.newsImage} resizeMode="cover" />
              <Text style={styles.newsTitle} numberOfLines={2}>Award-winning inflight dining with Duddell's</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 10. DISCLAIMER FOOTER (Matching authentic copy from frames #189, #195) */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            All fares displayed include taxes and carrier-imposed surcharges. All fares, government taxes and fees, and surcharges are subject to change at any time.
          </Text>
          <Text style={styles.disclaimerText}>
            For ticket cancellations, where applicable, the Hong Kong Passenger Security Charge, the Hong Kong Air Passenger Departure Tax, and the Hong Kong International Airport Construction Fee will be refunded without any administrative fees.
          </Text>
          <Text style={styles.disclaimerSubtext}>
            Cathay Pacific Airways Limited 國泰航空有限公司
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F8F6',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#F9F8F6',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 24,
    width: '100%',
    maxWidth: '100%',
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
  memberGreetingCol: {},
  memberGreetingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  memberMilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  memberMilesText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  memberDotSeparator: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  memberStatusPointsText: {
    color: '#D1EAE7',
    fontSize: 13,
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
  passkeyBannerWrapper: {
    marginHorizontal: 16,
    marginTop: -24,
  },
  passkeyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  passkeyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  passkeyTextCol: {
    flex: 1,
  },
  passkeyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C2024',
  },
  passkeySub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  passkeyCloseBtn: {
    padding: 6,
  },
  searchCardWrapper: {
    marginHorizontal: 16,
    marginTop: -32,
  },
  searchCardWrapperWithPasskey: {
    marginTop: 12,
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
  recentSearchesWrapper: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  recentSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  recentSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  recentPlaneCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recentTextCol: {
    flex: 1,
  },
  recentDatesText: {
    fontSize: 11,
    color: '#64748B',
  },
  recentRouteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#006564',
    marginTop: 1,
  },
  wingBannerWrapper: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  wingBannerImage: {
    width: '100%',
    height: 148,
    justifyContent: 'center',
  },
  wingBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 35, 40, 0.45)',
    padding: 16,
    justifyContent: 'space-between',
    borderRadius: 12,
  },
  topPickPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#006564',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  topPickPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  wingBannerHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  wingBannerSub: {
    fontSize: 13,
    color: '#E2E8F0',
    marginTop: 2,
    fontWeight: '400',
  },
  wingBookBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  wingBookBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#006564',
  },
  offersSection: {
    marginTop: 24,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 20,
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
    color: '#1A2024',
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
  carouselScrollView: {
    width: '100%',
    maxWidth: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  carouselContainer: {
    paddingHorizontal: 16,
    gap: 14,
    marginTop: 10,
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
  exploreCard: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F7F6',
  },
  exploreInner: {
    alignItems: 'center',
    padding: 18,
    gap: 8,
  },
  exploreTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006564',
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionContainer: {
    marginTop: 28,
  },
  promoCardItem: {
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEAE6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  promoCardImage: {
    width: '100%',
    height: 108,
  },
  promoCardDetails: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  promoHeadlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
    lineHeight: 18,
    minHeight: 36,
  },
  promoDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  promoDateIcon: {
    marginRight: 4,
  },
  promoDateText: {
    fontSize: 11.5,
    color: '#718096',
    fontWeight: '400',
  },
  promoOfferText: {
    fontSize: 13.5,
    color: '#006564',
    marginTop: 4,
    fontWeight: '700',
  },
  moreWaysScrollContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 16,
  },
  moreWaysItem: {
    alignItems: 'center',
    width: 80,
  },
  moreWaysCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E5DF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  moreWaysLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C2024',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  articleCard: {
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEAE6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  articleCardImage: {
    width: '100%',
    height: 108,
  },
  articleCardDetails: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  articleLocation: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '400',
    marginBottom: 4,
  },
  articleTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1C2024',
    lineHeight: 18,
  },
  newsCard: {
    width: 170,
  },
  newsImage: {
    width: 170,
    height: 104,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  newsTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 8,
    lineHeight: 17,
  },
  disclaimerContainer: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#94A3B8',
    marginBottom: 6,
  },
  disclaimerSubtext: {
    fontSize: 11,
    lineHeight: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
