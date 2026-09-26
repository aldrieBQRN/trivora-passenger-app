import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  Search,
  Home as HomeIcon,
  Briefcase,
  ShoppingBag,
  MoreHorizontal,
  MapPin,
  X,
} from 'lucide-react-native';
import Avatar from '../components/Avatar';
import TrivoraMap from '../components/TrivoraMap';
import DestinationPickerModal from '../components/DestinationPickerModal';
import NotificationsModal from '../components/NotificationsModal';
import FloatingIconButton from '../components/FloatingIconButton';
import LocationPendingView from '../components/LocationPendingView';
import Button from '../components/Button';
import { useLiveLocation } from '../hooks/useCurrentLocation';

interface HomeScreenProps {
  topInset?: number;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

const QUICK_DESTINATIONS = [
  {
    key: 'home',
    label: 'Home',
    icon: HomeIcon,
    location: {
      name: 'Home (Bucana Res.)',
      address: 'Brgy. Bucana, Nasugbu Batangas',
      lat: 14.0625,
      lng: 120.627,
      category: 'Residential',
    },
  },
  {
    key: 'work',
    label: 'Work',
    icon: Briefcase,
    location: {
      name: 'Nasugbu Municipal Hall',
      address: 'J.P. Rizal St., Poblacion',
      lat: 14.0718,
      lng: 120.6325,
      category: 'Government',
    },
  },
  {
    key: 'market',
    label: 'Market',
    icon: ShoppingBag,
    location: {
      name: 'Trivora Public Market',
      address: 'Market St., Brgy 8',
      lat: 14.0705,
      lng: 120.6341,
      category: 'Market',
    },
  },
];

export default function HomeScreen({
  topInset = 0,
  onOpenNotifications,
  onOpenProfile,
}: HomeScreenProps) {
  const {
    startBookingFlow,
    pickup,
    selectPickup,
    selectDestination,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    currentLat,
    currentLng,
    isLocatingPickup,
    locationError,
    retryLocation,
  } = useBooking();
  const { user } = useAuth();

  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Measured from actual layout rather than guessed, so the pickup pin sits centered in the
  // visible area between the header bar and the action sheet, not the full screen height.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const handleHeaderLayout = (e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  const firstName = user?.name?.split(' ')[0] || 'there';

  const handleOpenNotifications = () => {
    if (onOpenNotifications) onOpenNotifications();
    setShowNotificationsModal(true);
  };

  // currentLat/currentLng live in BookingContext (not local state) and, once set, are never reset
  // to null again for the session — so this only ever shows once per login, not on every later
  // Home visit, and never shows the map/pickup pin using the default/fallback location as if it
  // were the passenger's real position while the first real GPS fix is still in flight.
  // Live position for the Home pin/Focus follow (see useLiveLocation) — falls back to the
  // one-shot real fix below until the first live update arrives.
  const liveLocation = useLiveLocation(true);

  if (currentLat == null || currentLng == null) {
    return <LocationPendingView isLocating={isLocatingPickup} error={locationError} onRetry={retryLocation} />;
  }

  return (
    <View style={styles.container}>
      {/* Full-bleed map — the screen's primary surface, not a bounded canvas */}
      <TrivoraMap
        pickup={pickup}
        showCompass={false}
        focusCurrentLocation
        currentLocation={liveLocation ?? { lat: currentLat, lng: currentLng }}
        topInset={headerHeight}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header bar — same structure as the Driver app's Home header: an opaque bar floating
          over the full-bleed map with identity/greeting on the left and alerts on the right,
          instead of two disconnected floating icons with no text. */}
      <View style={[styles.header, { paddingTop: topInset + SPACING.sm }]} onLayout={handleHeaderLayout}>
        <TouchableOpacity onPress={onOpenProfile} activeOpacity={0.8} accessibilityLabel="Profile">
          {/* "driver" tone is the component's solid-navy/white-initials treatment — the same
              default appearance Driver Home uses for its own avatar. Using it here for the
              passenger's own avatar (not the tinted "passenger" tone used for someone else's
              avatar elsewhere) matches Driver's default-profile look exactly. */}
          <Avatar name={user?.name || 'Passenger'} imageUri={user?.avatarUrl} tone="driver" size={36} />
        </TouchableOpacity>

        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>Hi, {firstName}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>Passenger</Text>
        </View>

        <FloatingIconButton
          size={36}
          onPress={handleOpenNotifications}
          hasBadge={unreadNotificationCount > 0}
          accessibilityLabel="Notifications"
        >
          <Bell size={17} color={COLORS.textPrimary} />
        </FloatingIconButton>
      </View>

      {/* Primary composition: a single structured action panel, not scattered cards */}
      <View style={styles.sheet} onLayout={handleSheetLayout}>
        <TouchableOpacity
          style={styles.searchField}
          onPress={() => setShowDestinationPicker(true)}
          activeOpacity={0.85}
        >
          <View style={styles.searchIconCircle}>
            <Search size={18} color={COLORS.primary} />
          </View>
          <View style={styles.searchTextCol}>
            <Text style={styles.searchTitle}>Where to?</Text>
            <Text style={styles.searchSubtitle}>Set your destination in Nasugbu</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.quickRow}>
          {QUICK_DESTINATIONS.map((item, idx) => (
            <React.Fragment key={item.key}>
              <TouchableOpacity
                style={styles.quickItem}
                onPress={() => selectDestination(item.location)}
                activeOpacity={0.7}
              >
                <View style={styles.quickIconCircle}>
                  <item.icon size={15} color={COLORS.primary} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
              {idx < QUICK_DESTINATIONS.length - 1 && <View style={styles.quickDivider} />}
            </React.Fragment>
          ))}
          <View style={styles.quickDivider} />
          <TouchableOpacity
            style={styles.quickItem}
            onPress={() => setShowDestinationPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.quickIconCircle}>
              <MoreHorizontal size={15} color={COLORS.primary} />
            </View>
            <Text style={styles.quickLabel}>More</Text>
          </TouchableOpacity>
        </View>

        <Button label="Book a Tricycle" onPress={startBookingFlow} />
      </View>

      <DestinationPickerModal
        visible={showDestinationPicker}
        onClose={() => setShowDestinationPicker(false)}
        onSelect={(dest) => selectDestination(dest)}
        currentLocation={pickup}
      />

      <NotificationsModal
        visible={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        notifications={notifications}
        onMarkRead={markNotificationRead}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSubtle,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm + 2,
    ...SHADOWS.sheet,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  searchIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTextCol: {
    flex: 1,
  },
  searchTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  searchSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  quickIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
  },
  quickDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.borderLight,
  },
});
