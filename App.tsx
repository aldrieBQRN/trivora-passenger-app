import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { BookingProvider, useBooking } from './src/context/BookingContext';
import { SavedPlacesProvider } from './src/context/SavedPlacesContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { ToastProvider } from './src/components/Toast';
import OfflineBanner from './src/components/OfflineBanner';
import { COLORS, RADIUS, SPACING } from './src/constants/theme';

const ONBOARDING_STORAGE_KEY = '@trivora_passenger_onboarding_done';

// 12 Specification Screens
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import DestinationRouteScreen from './src/screens/DestinationRouteScreen';
import RideConfirmationScreen from './src/screens/RideConfirmationScreen';
import SearchingDriversScreen from './src/screens/SearchingDriversScreen';
import DriverEnRouteScreen from './src/screens/DriverEnRouteScreen';
import ActiveRideScreen from './src/screens/ActiveRideScreen';
import TripCompletedScreen from './src/screens/TripCompletedScreen';
import RateReviewScreen from './src/screens/RateReviewScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import { Home, Receipt, User, LucideIcon } from 'lucide-react-native';

type TabKey = 'home' | 'trips' | 'profile';

interface TabButtonProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onPress: () => void;
}

/** Same tab interaction as the Driver app: a short indicator line above the icon on the active
 * tab, muted icon/label otherwise — replaces the old pill-highlight treatment for consistency
 * across the two apps. */
function TabButton({ label, icon: Icon, isActive, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      style={styles.tabButton}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.tabIndicatorTrack}>
        {isActive && <View style={styles.tabIndicator} />}
      </View>
      <Icon size={22} color={isActive ? COLORS.primary : COLORS.textMuted} strokeWidth={isActive ? 2.2 : 1.8} />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PassengerAppNavigator() {
  const { isAuthenticated, isRestoring, login } = useAuth();
  const { screenState, setScreenState } = useBooking();

  const [showSplash, setShowSplash] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  // Track previous authentication state to detect logout vs initial load
  const wasAuthenticatedRef = useRef(false);

  // Restore onboarding completion flag from storage on launch
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then((val) => {
        if (val === 'true') {
          setHasCompletedOnboarding(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleCompleteOnboarding = () => {
    setHasCompletedOnboarding(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true').catch(() => {});
  };

  // Sync auth transitions:
  // - On logout: go directly to Login page (AuthScreen) and reset active tab & screenState to 'home'
  // - On login: always land on the home page ('home')
  useEffect(() => {
    if (isAuthenticated) {
      wasAuthenticatedRef.current = true;
      setHasCompletedOnboarding(true);
      AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true').catch(() => {});
      setActiveTab('home');
      setScreenState('home');
    } else if (wasAuthenticatedRef.current) {
      // User just logged out:
      // 1. Ensure onboarding is marked complete so user goes directly to the Login page
      setHasCompletedOnboarding(true);
      // 2. Reset active tab to 'home' so the next login starts fresh on the home page
      setActiveTab('home');
      // 3. Reset booking screenState to 'home'
      setScreenState('home');
      wasAuthenticatedRef.current = false;
    }
  }, [isAuthenticated, setScreenState]);

  // Render current view
  const renderCurrentScreen = () => {
    // Screen 0: Splash — a brief brand-only beat before onboarding. Also held open while a
    // previous session is still being restored (app relaunch, reloaded web tab) so a returning,
    // already-logged-in passenger never flashes through onboarding/login on the way back in.
    if (showSplash || isRestoring) {
      return <SplashScreen onFinish={() => setShowSplash(false)} />;
    }

    // Screen 1: Onboarding — skipped for a session that was just restored, since a returning
    // authenticated passenger shouldn't see the first-time intro again.
    if (!hasCompletedOnboarding && !isAuthenticated) {
      return (
        <OnboardingScreen
          onGetStarted={handleCompleteOnboarding}
          onSkip={handleCompleteOnboarding}
        />
      );
    }

    // Screen 2: Login / Register
    if (!isAuthenticated || screenState === 'auth') {
      return (
        <AuthScreen
          onAuthenticated={() => {
            setScreenState('home');
            setActiveTab('home');
          }}
        />
      );
    }

    // Active Booking Flow Screens (Screens 4 to 10)
    if (screenState === 'destination_select') {
      return <DestinationRouteScreen topInset={safeTop} />;
    }

    if (screenState === 'confirm_fare') {
      return <RideConfirmationScreen />;
    }

    if (screenState === 'searching') {
      return <SearchingDriversScreen />;
    }

    if (screenState === 'driver_en_route') {
      return <DriverEnRouteScreen topInset={safeTop} />;
    }

    if (screenState === 'in_transit') {
      return <ActiveRideScreen topInset={safeTop} />;
    }

    if (screenState === 'trip_completed') {
      return <TripCompletedScreen />;
    }

    if (screenState === 'rate_review') {
      return <RateReviewScreen />;
    }

    // Main Tab Navigation Views (Screens 3, 11, 12)
    if (activeTab === 'home') {
      return (
        <HomeScreen
          topInset={safeTop}
          onOpenMenu={() => {}}
          onOpenNotifications={() => {}}
          onOpenProfile={() => setActiveTab('profile')}
        />
      );
    }

    if (activeTab === 'trips') {
      return <HistoryScreen onBackToMap={() => setActiveTab('home')} />;
    }

    if (activeTab === 'profile') {
      return <ProfileScreen />;
    }

    return null;
  };

  const insets = useSafeAreaInsets();

  // Robust safe insets calculation across Android, iOS, and Web
  const safeTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || Constants.statusBarHeight || 28) : 0
  );
  const safeBottom = Math.max(
    insets.bottom,
    Platform.OS === 'ios' ? 24 : (Platform.OS === 'android' ? 16 : 0)
  );

  const isTabVisible = isAuthenticated && screenState === 'home';

  // Every full-bleed map screen (Home plus the map-based booking-flow
  // screens) manages its own top inset internally via the topInset prop
  // instead of the whole app being pushed down, so the map reads as
  // map-first rather than sitting inside a chrome-bounded viewport.
  const isFullBleedMapScreen =
    (isTabVisible && activeTab === 'home') ||
    screenState === 'destination_select' ||
    screenState === 'driver_en_route' ||
    screenState === 'in_transit';

  // Splash and Onboarding are also full-bleed (a navy brand screen and full-screen hero photos),
  // and both already handle their own safe-area insets internally — without this, the outer
  // wrapper's safe-area padding left a visible band of the root background above and below them,
  // breaking the "photo fills the entire screen" effect.
  const isSplashOrOnboarding = showSplash || isRestoring || (!hasCompletedOnboarding && !isAuthenticated);

  return (
    <View
      style={[
        styles.rootContainer,
        { paddingTop: isFullBleedMapScreen || isSplashOrOnboarding ? 0 : safeTop },
      ]}
    >
      <StatusBar style={isSplashOrOnboarding ? 'light' : 'dark'} backgroundColor={COLORS.background} />
      <OfflineBanner />
      <View style={styles.container}>
        {/* Screen Viewport */}
        <View
          style={[
            styles.screenViewport,
            !isTabVisible && !isSplashOrOnboarding && { paddingBottom: safeBottom },
          ]}
        >
          {renderCurrentScreen()}
        </View>

        {/* 3 evenly balanced tabs — booking is already available from Home's own "Book a
            Tricycle" action, so the tab bar no longer needs a center FAB for it, matching
            the Driver app's flat tab-bar layout. */}
        {isTabVisible && (
          <View
            style={[
              styles.tabBar,
              { paddingBottom: Math.max(safeBottom, Platform.OS === 'ios' ? 24 : 14) },
            ]}
          >
            <TabButton
              label="Home"
              icon={Home}
              isActive={activeTab === 'home'}
              onPress={() => setActiveTab('home')}
            />
            <TabButton
              label="Rides"
              icon={Receipt}
              isActive={activeTab === 'trips'}
              onPress={() => setActiveTab('trips')}
            />
            <TabButton
              label="Profile"
              icon={User}
              isActive={activeTab === 'profile'}
              onPress={() => setActiveTab('profile')}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <ToastProvider>
          <AuthProvider>
            <SavedPlacesProvider>
              <BookingProvider>
                <PassengerAppNavigator />
              </BookingProvider>
            </SavedPlacesProvider>
          </AuthProvider>
        </ToastProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenViewport: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingTop: 8,
    paddingHorizontal: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: Platform.OS === 'ios' ? 62 : 64,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    gap: 5,
  },
  tabIndicatorTrack: {
    height: 3,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    height: 3,
    width: 20,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});
