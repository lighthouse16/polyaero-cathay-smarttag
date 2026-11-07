import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
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

export type OnboardingScreenId = 'splash' | 'language' | 'welcome';

const getInitialScreenState = (): { onboarding: OnboardingScreenId | null; tab: CathayTabId } => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    if (screen) {
      if (['splash', 'language', 'welcome'].includes(screen)) {
        return { onboarding: screen as OnboardingScreenId, tab: 'home' };
      }
      if (['home', 'book', 'trips', 'profile', 'tools'].includes(screen)) {
        return { onboarding: null, tab: screen as CathayTabId };
      }
    }
  }
  return { onboarding: 'splash', tab: 'home' };
};

export const CathayAppShell: React.FC = () => {
  // Navigation State
  const [onboardingScreen, setOnboardingScreen] = useState<OnboardingScreenId | null>(() => getInitialScreenState().onboarding);
  const [activeTab, setActiveTab] = useState<CathayTabId>(() => getInitialScreenState().tab);

  // Global Auth & Passenger Data State
  const [user, setUser] = useState<UserAuthProfile>(INITIAL_USER_PROFILE);
  const [bookings, setBookings] = useState<FlightBooking[]>([INITIAL_BOOKING]);
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
  return (
    <View style={styles.root}>
      {/* Active Screen Tab View */}
      <View style={styles.screenArea}>
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
      </View>

      {/* FIXED BOTTOM TAB BAR (5 TABS MATCHING VIDEO) - Hidden when Travel tools fullscreen view is open */}
      {activeTab !== 'tools' && (
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.8}
          testID="tab-home"
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? '#006564' : '#718096'}
          />
          <Text style={[styles.tabLabel, activeTab === 'home' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('book')}
          activeOpacity={0.8}
          testID="tab-book"
        >
          <Ionicons
            name={activeTab === 'book' ? 'airplane' : 'airplane-outline'}
            size={22}
            color={activeTab === 'book' ? '#006564' : '#718096'}
          />
          <Text style={[styles.tabLabel, activeTab === 'book' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Book
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('trips')}
          activeOpacity={0.8}
          testID="tab-trips"
        >
          <View style={styles.tabIconBadgeWrapper}>
            <Ionicons
              name={activeTab === 'trips' ? 'briefcase' : 'briefcase-outline'}
              size={22}
              color={activeTab === 'trips' ? '#006564' : '#718096'}
            />
            {bookings.length > 0 && <View style={styles.tabDotBadge} />}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'trips' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            My trips
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
          testID="tab-profile"
        >
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={activeTab === 'profile' ? '#006564' : '#718096'}
          />
          <Text style={[styles.tabLabel, activeTab === 'profile' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('tools')}
          activeOpacity={0.8}
          testID="tab-tools"
        >
          <Ionicons
            name="grid-outline"
            size={22}
            color="#718096"
          />
          <Text style={[styles.tabLabel, styles.tabLabelInactive]}>
            Travel tools
          </Text>
        </TouchableOpacity>
      </View>
      )}

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
  tabIconBadgeWrapper: {
    position: 'relative',
  },
  tabDotBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#006564',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#006564',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#718096',
    fontWeight: '400',
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
