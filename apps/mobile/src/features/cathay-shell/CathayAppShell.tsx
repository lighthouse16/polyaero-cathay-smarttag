import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  Animated,
  Easing,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CathaySplashScreen } from './CathaySplashScreen';
import { CathayLanguageModal } from './CathayLanguageModal';
import { CathayMemberWelcomeScreen } from './CathayMemberWelcomeScreen';
import { CathayHomeScreen } from './CathayHomeScreen';
import { CathayBookScreen } from './CathayBookScreen';
import { CathayTripsScreen } from './CathayTripsScreen';
import { CathayProfileScreen } from './CathayProfileScreen';
import { CathayTravelToolsScreen } from './CathayTravelToolsScreen';
import { CathaySignUpModal } from './CathaySignUpModal';
import { CathaySignInModal } from './CathaySignInModal';
import { CathayWelcomeToastModal } from './CathayWelcomeToastModal';
import { CathayMessageCentreModal } from './CathayMessageCentreModal';
import {
  CathayTabId,
  UserAuthProfile,
  FlightBooking,
  RecentSearch,
  INITIAL_USER_PROFILE,
  INITIAL_BOOKING,
} from './CathayTypes';

const CLOUD_DOCK_BG = require('../../../assets/cathay/cloud_dock_bg.png');

export type OnboardingScreenId = 'splash' | 'language' | 'welcome';

interface TabItemConfig {
  id: CathayTabId;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  rotate?: string;
}

const TAB_ITEMS: TabItemConfig[] = [
  {
    id: 'home',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    id: 'book',
    label: 'Book',
    activeIcon: 'airplane',
    inactiveIcon: 'airplane-outline',
    rotate: '-45deg',
  },
  {
    id: 'trips',
    label: 'My trips',
    activeIcon: 'briefcase',
    inactiveIcon: 'briefcase-outline',
  },
  {
    id: 'profile',
    label: 'Profile',
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
  },
  {
    id: 'tools',
    label: 'Travel tools',
    activeIcon: 'grid',
    inactiveIcon: 'grid-outline',
  },
];

const getInitialScreenState = (): { onboarding: OnboardingScreenId | null; tab: CathayTabId; isAuth?: boolean; isBooked?: boolean } => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    const isAuth = params.get('auth') === '1' || params.get('auth') === 'true';
    const isBooked = params.get('booked') === '1' || params.get('booked') === 'true';
    if (screen) {
      if (['splash', 'language', 'welcome'].includes(screen)) {
        return { onboarding: screen as OnboardingScreenId, tab: 'home', isAuth, isBooked };
      }
      if (['home', 'book', 'trips', 'profile', 'tools'].includes(screen)) {
        return { onboarding: null, tab: screen as CathayTabId, isAuth, isBooked };
      }
    }
  }
  return { onboarding: 'splash', tab: 'home', isAuth: false, isBooked: false };
};

export const CathayAppShell: React.FC = () => {
  // Navigation State
  const [onboardingScreen, setOnboardingScreen] = useState<OnboardingScreenId | null>(() => getInitialScreenState().onboarding);
  const [activeTab, setActiveTab] = useState<CathayTabId>(() => getInitialScreenState().tab);

  // Global Auth & Passenger Data State
  const [user, setUser] = useState<UserAuthProfile>(() => {
    const { isAuth } = getInitialScreenState();
    return isAuth ? { ...INITIAL_USER_PROFILE, isLoggedIn: true } : INITIAL_USER_PROFILE;
  });
  const [bookings, setBookings] = useState<FlightBooking[]>(() => {
    const { isBooked } = getInitialScreenState();
    return isBooked ? [INITIAL_BOOKING] : [];
  });
  const [recentSearch, setRecentSearch] = useState<RecentSearch | null>({
    id: 'rec-01',
    origin: 'HKG',
    originCity: 'Hong Kong',
    destination: 'NKG',
    destinationCity: 'Nanjing',
    dates: '08 Nov - 15 Nov',
    price: 'HKD5,674',
  });

  // Modals State
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [showMessageCentre, setShowMessageCentre] = useState(false);
  const [isDevMenuVisible, setIsDevMenuVisible] = useState(false);

  // Check URL query params on web for instant automated QA testing (?screen=home, ?screen=book, etc.)
  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window !== 'undefined') {
        const { onboarding, tab } = getInitialScreenState();
        setOnboardingScreen(onboarding);
        setActiveTab(tab);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      handleUrlChange();
      window.addEventListener('popstate', handleUrlChange);
      return () => window.removeEventListener('popstate', handleUrlChange);
    }
  }, []);

  // Floating Dock Liquid Droplet Slide Animation (Native Driver - 60fps/APK Safe)
  const initialItemWidth = Math.max((Dimensions.get('window').width - 28 - 12) / TAB_ITEMS.length, 50);
  const [itemWidth, setItemWidth] = useState(initialItemWidth);
  const initialIdx = TAB_ITEMS.findIndex((t) => t.id === activeTab);
  const [translateX] = useState(() => new Animated.Value(Math.max(initialIdx, 0) * initialItemWidth));
  const [stretchAnim] = useState(() => new Animated.Value(1));
  const [squashAnim] = useState(() => new Animated.Value(1));
  const [screenFade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const idx = TAB_ITEMS.findIndex((t) => t.id === activeTab);
    const targetX = (idx >= 0 ? idx : 0) * itemWidth;

    // Smooth screen crossfade
    screenFade.setValue(0.75);
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Elastic liquid droplet animation: spring slide + direction stretch + volume squash
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: targetX,
        friction: 6.8,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(stretchAnim, {
          toValue: 1.28,
          duration: 110,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(stretchAnim, {
          toValue: 1,
          friction: 4.2,
          tension: 85,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(squashAnim, {
          toValue: 0.86,
          duration: 110,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(squashAnim, {
          toValue: 1,
          friction: 4.2,
          tension: 85,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeTab, itemWidth, screenFade, squashAnim, stretchAnim, translateX]);

  const handleSignUpComplete = (profileData: Partial<UserAuthProfile>) => {
    setUser((prev) => ({ ...prev, ...profileData, isLoggedIn: true }));
    setShowWelcomeToast(true);
  };

  const handleSignInSuccess = (profileData: Partial<UserAuthProfile>) => {
    setUser((prev) => ({ ...prev, ...profileData, isLoggedIn: true }));
  };

  const handleFlightBooked = (booking: FlightBooking) => {
    setBookings((prev) => [booking, ...prev]);
    setRecentSearch({
      id: `rec-${Date.now()}`,
      origin: booking.origin,
      originCity: booking.originCity,
      destination: booking.destination,
      destinationCity: booking.destinationCity,
      dates: '08 Nov - 15 Nov',
      price: 'HKD5,674',
    });
    // Immediately navigate to My Trips tab so user sees their new flight & PolyAero SmartTag!
    setActiveTab('trips');
  };

  // 1. ONBOARDING & SPLASH FLOWS
  if (onboardingScreen === 'splash') {
    return (
      <CathaySplashScreen
        onContinue={() => setOnboardingScreen('language')}
        autoAdvance={
          Platform.OS !== 'web' ||
          (typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('screen') !== 'splash')
        }
      />
    );
  }

  if (onboardingScreen === 'language') {
    return (
      <CathayLanguageModal
        onConfirm={() => setOnboardingScreen('welcome')}
      />
    );
  }

  if (onboardingScreen === 'welcome') {
    return (
      <>
        <CathayMemberWelcomeScreen
          onSignUp={() => setShowSignUpModal(true)}
          onSignIn={() => setShowSignInModal(true)}
          onContinueAsGuest={() => setOnboardingScreen(null)}
        />

        <CathaySignUpModal
          visible={showSignUpModal}
          onClose={() => setShowSignUpModal(false)}
          onComplete={handleSignUpComplete}
        />

        <CathaySignInModal
          visible={showSignInModal}
          onClose={() => setShowSignInModal(false)}
          onSuccess={handleSignInSuccess}
          onSwitchToSignUp={() => {
            setShowSignInModal(false);
            setShowSignUpModal(true);
          }}
        />

        <CathayWelcomeToastModal
          visible={showWelcomeToast}
          user={user}
          onFinish={() => {
            setShowWelcomeToast(false);
            setOnboardingScreen(null);
          }}
        />
      </>
    );
  }

  // 2. MAIN PASSENGER 5-TAB EXPERIENCE
  const capsuleWidth = Math.max(itemWidth - 12, 48);
  const capsuleOffset = (itemWidth - capsuleWidth) / 2;

  return (
    <View style={styles.root}>
      {/* Active Screen Tab View with Silky Crossfade */}
      <Animated.View style={[styles.screenArea, { opacity: screenFade }]}>
        {activeTab === 'home' && (
          <CathayHomeScreen
            user={user}
            recentSearch={recentSearch}
            onSearchPress={() => setActiveTab('book')}
            onOffersPress={() => setActiveTab('book')}
            onOpenSignIn={() => setShowSignInModal(true)}
            onOpenMessageCentre={() => setShowMessageCentre(true)}
            onOpenDevMenu={() => setIsDevMenuVisible(true)}
          />
        )}

        {activeTab === 'book' && (
          <CathayBookScreen
            onFlightSelected={handleFlightBooked}
            onOpenDevMenu={() => setIsDevMenuVisible(true)}
          />
        )}

        {activeTab === 'trips' && (
          <CathayTripsScreen
            bookings={bookings}
            user={user}
            onAddBooking={(newBooking) => setBookings((prev) => [newBooking, ...prev])}
            onOpenDevMenu={() => setIsDevMenuVisible(true)}
          />
        )}

        {activeTab === 'profile' && (
          <CathayProfileScreen
            user={user}
            onOpenDevMenu={() => setIsDevMenuVisible(true)}
            onOpenSignIn={() => setShowSignInModal(true)}
            onSignOut={() => setUser(INITIAL_USER_PROFILE)}
          />
        )}

        {activeTab === 'tools' && (
          <CathayTravelToolsScreen
            onClose={() => setActiveTab('home')}
            onOpenDevMenu={() => setIsDevMenuVisible(true)}
            onNavigateToTrips={() => setActiveTab('trips')}
          />
        )}
      </Animated.View>

      {/* FLOATING CLOUD DOCK NAVIGATION BAR (User reference: media_1794038335689_2e8e3627.jpg) */}
      <View style={styles.floatingDockWrap} pointerEvents="box-none">
        <ImageBackground
          source={CLOUD_DOCK_BG}
          style={styles.floatingDockCloud}
          imageStyle={styles.cloudImageStyle}
          resizeMode="stretch"
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0) {
              const inner = width - 12;
              setItemWidth(inner / TAB_ITEMS.length);
            }
          }}
        >
          {/* Liquid Droplet Sliding Capsule (Spring + Elastic Stretch/Squash) */}
          <Animated.View
            style={[
              styles.slidingDropletCapsule,
              {
                width: capsuleWidth,
                left: 6 + capsuleOffset,
                transform: [
                  { translateX },
                  { scaleX: stretchAnim },
                  { scaleY: squashAnim },
                ],
              },
            ]}
          />

          <View style={styles.dockItemsRow}>
            {TAB_ITEMS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.dockItem}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                  testID={`tab-${tab.id}`}
                >
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.inactiveIcon}
                    size={21}
                    color={isActive ? '#195A58' : '#4A5568'}
                    style={tab.rotate ? { transform: [{ rotate: tab.rotate }] } : undefined}
                  />
                  <Text
                    style={[
                      styles.dockLabel,
                      isActive ? styles.dockLabelActive : styles.dockLabelInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ImageBackground>
      </View>

      {/* Global Modals */}
      <CathaySignUpModal
        visible={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        onComplete={handleSignUpComplete}
      />

      <CathaySignInModal
        visible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSuccess={handleSignInSuccess}
        onSwitchToSignUp={() => {
          setShowSignInModal(false);
          setShowSignUpModal(true);
        }}
      />

      <CathayWelcomeToastModal
        visible={showWelcomeToast}
        user={user}
        onFinish={() => setShowWelcomeToast(false)}
      />

      <CathayMessageCentreModal
        visible={showMessageCentre}
        onClose={() => setShowMessageCentre(false)}
      />

      {/* Secret Developer Evaluation Menu */}
      <Modal visible={isDevMenuVisible} transparent animationType="fade" onRequestClose={() => setIsDevMenuVisible(false)}>
        <View style={styles.devMenuOverlay}>
          <View style={styles.devMenuCard}>
            <View style={styles.devMenuHeader}>
              <Text style={styles.devMenuTitle}>Developer Screen Switcher</Text>
              <TouchableOpacity onPress={() => setIsDevMenuVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.devMenuSub}>Jump to any screen or toggle passenger state:</Text>

            <View style={styles.devOptionsList}>
              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setUser((u) => ({ ...u, isLoggedIn: !u.isLoggedIn }));
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>
                  {user.isLoggedIn ? '👤 Switch to Guest Mode' : '🔑 Switch to Member Mode (Mr Trinh)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen('splash');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>0. Splash Screen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen('language');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>1. Language Modal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen('welcome');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>2. Member Welcome</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setShowSignUpModal(true);
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>3. Sign Up 5-Step Wizard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setShowSignInModal(true);
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>4. Sign In & Reset Password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen(null);
                  setActiveTab('home');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>5. Home Screen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen(null);
                  setActiveTab('book');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>6. Book Trip & Flight Search</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen(null);
                  setActiveTab('trips');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>7. My Trips & PolyAero SmartTag</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen(null);
                  setActiveTab('profile');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>8. Profile & Digital Membership Card</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devOptionBtn}
                onPress={() => {
                  setOnboardingScreen(null);
                  setActiveTab('tools');
                  setIsDevMenuVisible(false);
                }}
              >
                <Text style={styles.devOptionBtnText}>9. Travel Tools & Baggage Calculator</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  screenArea: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  floatingDockWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: Platform.OS === 'ios' ? 14 : 10,
    zIndex: 999,
    alignItems: 'center',
  },
  floatingDockCloud: {
    width: '100%',
    height: 88,
    justifyContent: 'flex-end',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  cloudImageStyle: {
    width: '100%',
    height: '100%',
  },
  dockItemsRow: {
    flexDirection: 'row',
    height: 58,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 4,
    zIndex: 2,
  },
  slidingDropletCapsule: {
    position: 'absolute',
    bottom: 8,
    height: 52,
    backgroundColor: '#DFEDE9',
    borderRadius: 26,
    zIndex: 1,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    zIndex: 2,
  },
  dockLabel: {
    fontSize: 10.5,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  dockLabelActive: {
    color: '#195A58',
    fontWeight: '700',
  },
  dockLabelInactive: {
    color: '#4A5568',
    fontWeight: '500',
  },
  devMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  devMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  devMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  devMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  devMenuSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  devOptionsList: {
    gap: 8,
  },
  devOptionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  devOptionBtnText: {
    fontSize: 13.5,
    color: '#334155',
    fontWeight: '600',
  },
});
