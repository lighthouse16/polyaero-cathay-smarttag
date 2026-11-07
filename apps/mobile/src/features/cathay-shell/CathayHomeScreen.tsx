import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
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

const BRUSHWING_WHITE = require('../../../assets/cathay/cathay-brushwing-white.png');
const ICON_ASIA_MILES_WHITE = require('../../../assets/cathay/icon-asia-miles-white.png');
const ICON_PASSKEY_LOCK = require('../../../assets/cathay/icon-passkey-lock.png');
const ICON_BOARDING_PASS = require('../../../assets/cathay/tools/icon_boarding_pass.png');
const ICON_HOTEL = require('../../../assets/cathay/tools/icon_hotel.png');
const ICON_PACKAGE = require('../../../assets/cathay/tools/icon_package.png');
const ICON_INSURANCE = require('../../../assets/cathay/tools/icon_insurance.png');
const ICON_CAR = require('../../../assets/cathay/tools/icon_car.png');
const ICON_SHOP = require('../../../assets/cathay/tools/icon_shop.png');

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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. HERO HEADER AREA WITH SKYLINE PHOTOGRAPHY & CURVED BOTTOM-LEFT CORNER */}
        <ImageBackground
          source={require('../../../assets/cathay/cathay-hero-skyline.png')}
          style={styles.heroBackground}
          imageStyle={styles.heroBackgroundImage}
          resizeMode="cover"
        >
          <View style={styles.headerSafeArea}>
            {/* Top Navigation Row */}
            <View style={styles.headerNavRow}>
              <TouchableOpacity
                style={styles.headerSpacer}
                onLongPress={onOpenDevMenu}
                activeOpacity={1}
                accessibilityLabel="Dev menu trigger"
              />

              <View style={styles.brushwingContainer}>
                <Image
                  source={BRUSHWING_WHITE}
                  style={styles.brushwingIcon}
                  resizeMode="contain"
                />
              </View>

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

            {/* Member Prompt Banner / Greeting (Exact Frame #71 vs WhatsApp Screenshot) */}
            <View style={styles.memberPromptRow}>
              {user.isLoggedIn ? (
                <View style={styles.memberGreetingCol}>
                  <View style={styles.memberGreetingTopRow}>
                    <Text style={styles.memberGreetingTitle}>
                      Hello {user.title} {user.familyName}
                    </Text>
                    <View style={styles.miniGreenCardBadge}>
                      <Image source={BRUSHWING_WHITE} style={styles.miniCardWing} resizeMode="contain" />
                    </View>
                  </View>

                  <View style={styles.memberMilesRow}>
                    <Image source={ICON_ASIA_MILES_WHITE} style={styles.asiaMilesWhiteIcon} resizeMode="contain" />
                    <Text style={styles.memberMetricBold}>{user.asiaMiles}</Text>
                    <Text style={styles.memberPipeSeparator}>|</Text>
                    <Text style={styles.memberStatusLabel}>Status Points</Text>
                    <Text style={styles.memberMetricBold}>{user.statusPoints}</Text>
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
          </View>
        </ImageBackground>

        {/* 2. FLIGHT SEARCH CARD (Always floats over Hero Skyline - Frame #71 & WhatsApp Screenshot) */}
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

              {/* Center Airplane Circle Badge */}
              <View style={styles.airplaneBadge}>
                <Ionicons name="airplane" size={16} color="#2E6E6D" />
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

        {/* 3. PASSKEY BANNER (Sits cleanly below Search Card - Exact Frame #71 & #182) */}
        {user.isLoggedIn && showPasskeyPrompt && (
          <View style={styles.passkeyBannerWrapper}>
            <View style={styles.passkeyBanner}>
              <Image source={ICON_PASSKEY_LOCK} style={styles.passkeyLockImg} resizeMode="contain" />
              <View style={styles.passkeyTextCol}>
                <Text style={styles.passkeyTitle}>Want to stay signed in?</Text>
                <Text style={styles.passkeySub}>
                  Create a passkey now for a safer, easier way to sign in.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPasskeyPrompt(false)}
                style={styles.passkeyCloseBtn}
              >
                <Ionicons name="close" size={22} color="#1C2024" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. RECENT SEARCHES SECTION (Exact Frame #182) */}
        {recentSearch && (
          <View style={styles.recentSearchesWrapper}>
            <Text style={styles.sectionTitleNoPad}>Recent searches</Text>
            <TouchableOpacity
              style={styles.recentSearchCard}
              onPress={onSearchPress}
              activeOpacity={0.85}
            >
              <View style={styles.recentPlaneCircle}>
                <Ionicons
                  name="airplane-outline"
                  size={20}
                  color="#195A58"
                  style={{ transform: [{ rotate: '-45deg' }] }}
                />
              </View>
              <View style={styles.recentTextCol}>
                <Text style={styles.recentDatesText}>{recentSearch.dates}</Text>
                <Text style={styles.recentRouteLine}>
                  <Text style={styles.recentRouteCodeBold}>{recentSearch.origin}</Text>
                  {' to '}
                  <Text style={styles.recentRouteCodeBold}>{recentSearch.destination}</Text>
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 5. FULL-WIDTH CONTEXTUAL WING BANNER (Exact Frame #182) */}
        {recentSearch && recentSearch.destination === 'NKG' && (
          <TouchableOpacity
            style={styles.wingBannerFullWidth}
            onPress={onSearchPress}
            activeOpacity={0.9}
          >
            <ImageBackground
              source={require('../../../assets/cathay/banner-wing-nanjing.jpg')}
              style={styles.wingBannerImage}
              resizeMode="cover"
            >
              <View style={styles.wingBannerOverlay}>
                <View style={styles.topPickPill}>
                  <Text style={styles.topPickPillText}>Top Pick</Text>
                </View>

                <View style={styles.wingBottomGroup}>
                  <Text style={styles.wingBannerHeading}>Nanjing on your mind?</Text>
                  <Text style={styles.wingBannerSub}>
                    Pick it up at HKD<Text style={{ fontWeight: '700' }}>5,674</Text>
                  </Text>

                  <View style={styles.wingBookOutlineBtn}>
                    <Text style={styles.wingBookOutlineBtnText}>Book now</Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        )}

        {/* 6. OUR LATEST OFFERS SECTION */}
        <View style={styles.offersSection}>
          <Text style={styles.sectionTitle}>Our latest offers</Text>

          <TouchableOpacity
            style={styles.promoBanner}
            onPress={onOffersPress || onSearchPress}
            activeOpacity={0.85}
            testID="promo-callout-banner"
          >
            <Image source={ICON_BOARDING_PASS} style={styles.flyingSoonTicketIcon} resizeMode="contain" />
            <View style={styles.promoTextContainer}>
              <Text style={styles.promoText}>
                <Text style={styles.promoBold}>Flying soon? </Text>
                Browse our lowest fares for next 60 days.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color="#1C2024" />
          </TouchableOpacity>

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
            {[
              { city: 'Nanjing', price: '3,030', img: require('../../../assets/cathay/dest-nanjing.png') },
              { city: 'Beijing', price: '3,670', img: require('../../../assets/cathay/dest-beijing.png') },
              { city: 'Seoul', price: '2,710', img: require('../../../assets/cathay/dest-seoul.png') },
              { city: 'Kaohsiung', price: '1,892', img: require('../../../assets/cathay/dest-kaohsiung.jpg') },
            ].map((d, i) => (
              <TouchableOpacity
                key={i}
                style={styles.destinationCard}
                activeOpacity={0.9}
                onPress={onSearchPress}
              >
                <Image source={d.img} style={styles.destinationImage} resizeMode="cover" />
                <View style={styles.destinationDetails}>
                  <Text style={styles.destinationCity}>{d.city}</Text>
                  <Text style={styles.destinationCabin}>Economy</Text>
                  <Text style={styles.priceLabel}>from</Text>
                  <Text style={styles.priceValue}>
                    HKD<Text style={styles.priceValueBold}>{d.price}</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 7. DISCOVER FANTASTIC PROMOTIONS (Exact Frame #183 & #184) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Discover fantastic promotions</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {[
              {
                badge: 'Cardholder exclusive',
                category: 'Payment',
                title: 'Double 11 flight offer',
                date: '11 Nov 2026',
                offerPrefix: 'Up to ',
                offerBold: '11%',
                offerSuffix: ' off',
                img: require('../../../assets/cathay/promo-double11.jpg'),
              },
              {
                badge: 'Limited-time fare',
                category: 'Flights',
                title: "Explore Almaty's wonders with direct flights",
                date: '30 Nov 2026',
                offerPrefix: 'From HKD4,089',
                offerBold: '',
                offerSuffix: '',
                img: require('../../../assets/cathay/promo-almaty.jpg'),
              },
              {
                badge: null,
                category: 'Flights',
                title: 'Student Fare',
                date: '31 Dec 2026',
                offerPrefix: 'Up to ',
                offerBold: '10%',
                offerSuffix: ' discount*',
                img: require('../../../assets/cathay/promo-student.jpg'),
              },
              {
                badge: null,
                category: 'Flights',
                title: 'Family Premium Pass',
                date: '15 Dec 2026',
                offerPrefix: 'Special family perks',
                offerBold: '',
                offerSuffix: '',
                img: require('../../../assets/cathay/promo-family.jpg'),
              },
            ].map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.promoCardItem}
                activeOpacity={0.9}
                onPress={onSearchPress}
              >
                <View style={styles.promoImageWrapper}>
                  <Image source={p.img} style={styles.promoCardImage} resizeMode="cover" />
                  {p.badge && (
                    <View style={styles.promoRustBadge}>
                      <Text style={styles.promoRustBadgeText}>{p.badge}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.promoCardBody}>
                  <View>
                    <Text style={styles.promoCategoryGold}>{p.category}</Text>
                    <Text style={styles.promoHeadlineText}>{p.title}</Text>
                  </View>

                  <View style={styles.promoClockRow}>
                    <Ionicons name="time" size={16} color="#706218" style={styles.promoClockIcon} />
                    <Text style={styles.promoClockDateText}>{p.date}</Text>
                  </View>
                </View>

                <View style={styles.promoMintFooterStrip}>
                  <Text style={styles.promoFooterText}>
                    {p.offerPrefix}
                    {p.offerBold ? <Text style={{ fontWeight: '700' }}>{p.offerBold}</Text> : null}
                    {p.offerSuffix}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 8. MORE WAYS TO EARN AND REDEEM MILES (Exact Frame #183 & #184) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>More ways to earn and redeem miles</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moreWaysScrollContainer}
          >
            {[
              { label: 'Book a hotel', icon: ICON_HOTEL },
              { label: 'Book a package', icon: ICON_PACKAGE },
              { label: 'Travel Insurance', icon: ICON_INSURANCE },
              { label: 'Rent a car', icon: ICON_CAR },
              { label: 'Cathay Shop', icon: ICON_SHOP },
            ].map((m, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.moreWaysItem}
                activeOpacity={0.75}
                onPress={onSearchPress}
              >
                <View style={styles.moreWaysCircle}>
                  <Image source={m.icon} style={styles.moreWaysCustomIcon} resizeMode="contain" />
                </View>
                <Text style={styles.moreWaysLabel}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 9. TRAVEL INSPIRATION (Full-bleed portrait photo cards - Exact Frame #189) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Travel inspiration</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {[
              {
                title: 'Cool Macao: where to find music, art and film',
                img: require('../../../assets/cathay/insp-macao.jpg'),
              },
              {
                title: "The best of Queensland's dinosau...",
                img: require('../../../assets/cathay/insp-queensland.jpg'),
              },
              {
                title: 'Unique Christmas celebrations across Asia',
                img: require('../../../assets/cathay/insp-asia-christmas.jpg'),
              },
              {
                title: 'The best concerts to catch in Asia in 2026',
                img: require('../../../assets/cathay/insp-asia-concerts.jpg'),
              },
              {
                title: 'Secret gardens and artisan workshops of Kyoto',
                img: require('../../../assets/cathay/insp-kyoto.jpg'),
              },
              {
                title: "A design lover's weekend guide to London",
                img: require('../../../assets/cathay/insp-london.jpg'),
              },
            ].map((item, idx) => (
              <TouchableOpacity key={idx} style={styles.inspPortraitCard} activeOpacity={0.9}>
                <ImageBackground
                  source={item.img}
                  style={styles.inspPortraitImg}
                  imageStyle={{ borderRadius: 12 }}
                  resizeMode="cover"
                >
                  <View style={styles.inspBottomScrim}>
                    <Text style={styles.inspOverlayTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 10. STAY UP-TO-DATE (White rounded cards - Exact Frame #189) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Stay up-to-date</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {[
              {
                title: 'Explore our 80th anniversary pop-up at the airport',
                img: require('../../../assets/cathay/news-80th-popup.jpg'),
              },
              {
                title: 'The 80th anniversary premium collection unveiled',
                img: require('../../../assets/cathay/news-80th-collection.jpg'),
              },
              {
                title: 'Experience the newly refreshed The Pier lounge',
                img: require('../../../assets/cathay/news-lounge.jpg'),
              },
              {
                title: 'Welcoming our next-generation A321neo fleet',
                img: require('../../../assets/cathay/news-fleet.jpg'),
              },
              {
                title: 'Cathay expands Sustainable Aviation Fuel programme',
                img: require('../../../assets/cathay/news-sustainability.jpg'),
              },
              {
                title: "Award-winning inflight dining with Duddell's",
                img: require('../../../assets/cathay/news-dining.jpg'),
              },
            ].map((news, idx) => (
              <TouchableOpacity key={idx} style={styles.newsWhiteCard} activeOpacity={0.9}>
                <Image source={news.img} style={styles.newsCardImage} resizeMode="cover" />
                <View style={styles.newsCardBody}>
                  <Text style={styles.newsCardTitle}>{news.title}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 11. DISCLAIMER FOOTER (Exact Frame #189) */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            All fares displayed include taxes and carrier-imposed surcharges. All fares, government taxes and fees, and surcharges are subject to change at any time.{'\n'}
            For ticket cancellations, where applicable, the Hong Kong Passenger Security Charge, the Hong Kong Air Passenger Departure Tax, and the Hong Kong International Airport Construction Fee will be refunded without any administrative fees.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: '100%',
  },

  /* 1. Hero Skyline Header */
  heroBackground: {
    width: '100%',
    height: 235,
    justifyContent: 'space-between',
  },
  heroBackgroundImage: {
    borderBottomLeftRadius: 56,
  },
  headerSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    backgroundColor: 'rgba(10, 20, 28, 0.28)',
    borderBottomLeftRadius: 56,
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
    marginBottom: 46,
    paddingHorizontal: 0,
  },
  memberPromptTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  memberGreetingCol: {},
  memberGreetingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberGreetingTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  miniGreenCardBadge: {
    width: 24,
    height: 15,
    borderRadius: 2,
    backgroundColor: '#2E6E6D',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginLeft: 10,
    position: 'relative',
  },
  miniCardWing: {
    width: 6,
    height: 6,
    position: 'absolute',
    right: 2.5,
    bottom: 2,
  },
  memberMilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  asiaMilesWhiteIcon: {
    width: 17,
    height: 17,
    marginRight: 6,
  },
  memberMetricBold: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  memberPipeSeparator: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    marginHorizontal: 10,
  },
  memberStatusLabel: {
    color: '#FFFFFF',
    fontSize: 13.5,
    marginRight: 6,
  },
  signInButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '400',
  },

  /* 2. Search Card */
  searchCardWrapper: {
    marginHorizontal: 20,
    marginTop: -36,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...cardShadow,
  },
  searchCardTitle: {
    fontSize: 15.5,
    fontWeight: '400',
    color: '#1C2024',
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
    color: '#52565A',
    fontWeight: '400',
  },
  airportCode: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E6E6D',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  cityName: {
    fontSize: 13,
    color: '#2C3034',
    marginTop: 2,
  },
  airplaneBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#52565A',
    fontWeight: '400',
  },
  searchCode: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E6E6D',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  cityNameRight: {
    fontSize: 13,
    color: '#2C3034',
    marginTop: 2,
  },

  /* 3. Passkey Banner (Frame #71 & #182) */
  passkeyBannerWrapper: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  passkeyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EBF3F5',
    borderRadius: 12,
    padding: 16,
    ...cardShadow,
  },
  passkeyLockImg: {
    width: 46,
    height: 46,
    marginRight: 14,
    marginTop: 2,
  },
  passkeyTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  passkeyTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 4,
  },
  passkeySub: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2C3034',
  },
  passkeyCloseBtn: {
    padding: 2,
  },

  /* 4. Recent Searches (Frame #182) */
  recentSearchesWrapper: {
    marginHorizontal: 20,
    marginTop: 28,
  },
  sectionTitleNoPad: {
    fontSize: 21,
    fontWeight: '400',
    color: '#1C2024',
    marginBottom: 14,
  },
  recentSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: 224,
    ...cardShadow,
  },
  recentPlaneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recentTextCol: {
    flex: 1,
  },
  recentDatesText: {
    fontSize: 12.5,
    color: '#2C3034',
    marginBottom: 3,
  },
  recentRouteLine: {
    fontSize: 15.5,
    color: '#1C2024',
    fontWeight: '600',
  },
  recentRouteCodeBold: {
    fontWeight: '700',
    color: '#195A58',
  },

  /* 5. Full-Width Wing Banner (Frame #182) */
  wingBannerFullWidth: {
    width: '100%',
    marginTop: 24,
  },
  wingBannerImage: {
    width: '100%',
    height: 310,
  },
  wingBannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 32, 38, 0.35)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  topPickPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E6E6D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  topPickPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  wingBottomGroup: {
    marginTop: 'auto',
  },
  wingBannerHeading: {
    fontSize: 22,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  wingBannerSub: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '400',
    marginTop: 2,
    marginBottom: 16,
  },
  wingBookOutlineBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 6,
  },
  wingBookOutlineBtnText: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#FFFFFF',
  },

  /* 6. Our Latest Offers */
  offersSection: {
    marginTop: 28,
    width: '100%',
    maxWidth: '100%',
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '400',
    color: '#1C2024',
    paddingHorizontal: 20,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DFECEB',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 14,
  },
  flyingSoonTicketIcon: {
    width: 28,
    height: 28,
  },
  promoTextContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  promoText: {
    fontSize: 14.5,
    lineHeight: 20,
    color: '#1C2024',
  },
  promoBold: {
    fontWeight: '700',
  },
  originIndicatorRow: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 6,
  },
  fromLabel: {
    fontSize: 15,
    color: '#1C2024',
  },
  fromCity: {
    color: '#195A58',
    fontWeight: '700',
  },
  carouselScrollView: {
    width: '100%',
  },
  carouselContainer: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 12,
    paddingBottom: 6,
  },
  destinationCard: {
    width: 166,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    ...cardShadow,
  },
  destinationImage: {
    width: '100%',
    height: 112,
  },
  destinationDetails: {
    padding: 14,
  },
  destinationCity: {
    fontSize: 16.5,
    fontWeight: '400',
    color: '#1C2024',
  },
  destinationCabin: {
    fontSize: 13,
    color: '#2C3034',
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: '#52565A',
    marginTop: 14,
  },
  priceValue: {
    fontSize: 16.5,
    fontWeight: '400',
    color: '#1C2024',
    marginTop: 2,
  },
  priceValueBold: {
    fontWeight: '700',
  },

  /* 7. Discover Fantastic Promotions (Frame #183 & #184) */
  sectionContainer: {
    marginTop: 32,
  },
  promoCardItem: {
    width: 172,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...cardShadow,
  },
  promoImageWrapper: {
    width: '100%',
    height: 112,
    position: 'relative',
  },
  promoCardImage: {
    width: '100%',
    height: '100%',
  },
  promoRustBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#8B3A16',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  promoRustBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  promoCardBody: {
    padding: 14,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 138,
  },
  promoCategoryGold: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#827127',
    marginBottom: 4,
  },
  promoHeadlineText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1C2024',
    lineHeight: 21,
  },
  promoClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  promoClockIcon: {
    marginRight: 6,
  },
  promoClockDateText: {
    fontSize: 12.5,
    color: '#706218',
    fontWeight: '400',
  },
  promoMintFooterStrip: {
    backgroundColor: '#EBF4F4',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  promoFooterText: {
    fontSize: 12.5,
    color: '#1C2024',
  },

  /* 8. More Ways to Earn and Redeem Miles (Frame #183 & #184) */
  moreWaysScrollContainer: {
    paddingHorizontal: 20,
    gap: 18,
    marginTop: 18,
  },
  moreWaysItem: {
    alignItems: 'center',
    width: 96,
  },
  moreWaysCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C4C6CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreWaysCustomIcon: {
    width: 38,
    height: 38,
  },
  moreWaysLabel: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#1C2024',
    textAlign: 'center',
    marginTop: 10,
  },

  /* 9. Travel Inspiration (Full-Bleed Portrait Cards - Frame #189) */
  inspPortraitCard: {
    width: 172,
    height: 268,
    borderRadius: 12,
    overflow: 'hidden',
    ...cardShadow,
  },
  inspPortraitImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  inspBottomScrim: {
    backgroundColor: 'rgba(12, 18, 24, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inspOverlayTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    color: '#FFFFFF',
    fontWeight: '400',
  },

  /* 10. Stay Up-to-Date (White Rounded Cards - Frame #189) */
  newsWhiteCard: {
    width: 172,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    ...cardShadow,
  },
  newsCardImage: {
    width: '100%',
    height: 112,
  },
  newsCardBody: {
    padding: 14,
    minHeight: 112,
  },
  newsCardTitle: {
    fontSize: 15.5,
    fontWeight: '400',
    color: '#1C2024',
    lineHeight: 21,
  },

  /* 11. Disclaimer Footer (Frame #189) */
  disclaimerContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
  },
  disclaimerText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#2C3034',
  },
});
