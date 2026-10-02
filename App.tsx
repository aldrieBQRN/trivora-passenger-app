import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
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
import { QrRideProvider, useQrRide } from './src/context/QrRideContext';
import { ToastProvider } from './src/components/Toast';
import OfflineBanner from './src/components/OfflineBanner';
import { COLORS } from './src/constants/theme';

const ONBOARDING_STORAGE_KEY = '@trivora_passenger_onboarding_done';

// 12 Specification Screens
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
import QrScanScreen from './src/screens/QrScanScreen';
import QrRideSetupScreen from './src/screens/QrRideSetupScreen';
import QrRideScreen from './src/screens/QrRideScreen';

import { Home, History, User } from 'lucide-react-native';
import CurvedTabBar, { CurvedTab } from './src/components/CurvedTabBar';

type TabKey = 'home' | 'trips' | 'profile';

const TABS: CurvedTab<TabKey>[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'trips', label: 'Rides', icon: History },
  { key: 'profile', label: 'Profile', icon: User },
];

function PassengerAppNavigator() {
  const { isAuthenticated, isRestoring, login } = useAuth();
  const { screenState, setScreenState } = useBooking();
  const { stage: qrStage } = useQrRide();

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
    // The native splash (app.json) is the ONLY splash — no second in-app brand screen. While a
    // previous session is still being restored, hold a blank frame in the splash's own
    // background colour so the handoff is seamless and a returning, already-logged-in passenger
    // never flashes through onboarding/login on the way back in.
    if (isRestoring) {
      return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
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

    // Scan to Ride (QR walk-in ride) — its own flow, alongside the normal booking flow below.
    if (qrStage === 'scan') {
      return <QrScanScreen topInset={safeTop} />;
    }
    if (qrStage === 'setup') {
      return <QrRideSetupScreen />;
    }
    if (qrStage === 'ride') {
      return <QrRideScreen topInset={safeTop} />;
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

  const isTabVisible = isAuthenticated && screenState === 'home' && qrStage === 'idle';

  // Every full-bleed map screen (Home plus the map-based booking-flow
  // screens) manages its own top inset internally via the topInset prop
  // instead of the whole app being pushed down, so the map reads as
  // map-first rather than sitting inside a chrome-bounded viewport.
  const isFullBleedMapScreen =
    (isTabVisible && activeTab === 'home') ||
    screenState === 'destination_select' ||
    screenState === 'driver_en_route' ||
    screenState === 'in_transit' ||
    (isAuthenticated && (qrStage === 'scan' || qrStage === 'ride'));

  // Splash and Onboarding are also full-bleed (a navy brand screen and full-screen hero photos),
  // and both already handle their own safe-area insets internally — without this, the outer
  // wrapper's safe-area padding left a visible band of the root background above and below them,
  // breaking the "photo fills the entire screen" effect.
  const isSplashOrOnboarding = isRestoring || (!hasCompletedOnboarding && !isAuthenticated);

  return (
    <View
      style={[
        styles.rootContainer,
        { paddingTop: isFullBleedMapScreen || isSplashOrOnboarding ? 0 : safeTop },
      ]}
    >
      <StatusBar style={isSplashOrOnboarding || (isAuthenticated && qrStage === 'scan') ? 'light' : 'dark'} backgroundColor={COLORS.background} />
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
          <CurvedTabBar
            tabs={TABS}
            activeKey={activeTab}
            onSelect={setActiveTab}
            bottomInset={Math.max(safeBottom, Platform.OS === 'ios' ? 22 : 12)}
          />
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
                <QrRideProvider>
                  <PassengerAppNavigator />
                </QrRideProvider>
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
});
