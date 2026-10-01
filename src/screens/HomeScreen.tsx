import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent, ActivityIndicator } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Search, Home as HomeIcon, Briefcase, School, Bookmark, Plus, ChevronRight, ScanLine, MoreHorizontal, MapPin } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import TrivoraMap from '../components/TrivoraMap';
import DestinationPickerModal from '../components/DestinationPickerModal';
import NotificationsModal from '../components/NotificationsModal';
import FloatingIconButton from '../components/FloatingIconButton';
import MapLocationNotice from '../components/MapLocationNotice';
import AddEditSavedPlaceModal from '../components/AddEditSavedPlaceModal';
import { useToast } from '../components/Toast';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useLiveLocation } from '../hooks/useCurrentLocation';
import { useQrRide, isQrRideUnfinished } from '../context/QrRideContext';
import TricycleIcon from '../components/icons/TricycleIcon';

interface HomeScreenProps {
  topInset?: number;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

/** Icon for a saved place, by its label — same mapping the destination picker uses. */
const SAVED_PLACE_ICONS: Record<string, typeof HomeIcon> = {
  Home: HomeIcon,
  Work: Briefcase,
  School,
};

/** Saved places shown as one-tap shortcuts on Home; the rest stay one tap away under "More". */
const MAX_SHORTCUTS = 3;

export default function HomeScreen({
  topInset = 0,
  onOpenNotifications,
  onOpenProfile,
}: HomeScreenProps) {
  const {
    pickup,
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
  const { savedPlaces, isLoading: isLoadingSavedPlaces, addSavedPlace } = useSavedPlaces();
  const { showToast } = useToast();
  const { openScanner, ride: qrRide, resumeRide } = useQrRide();
  // An unfinished QR ride minimized to Home (seated, or dropped off awaiting payment confirmation).
  const activeQrRide = isQrRideUnfinished(qrRide) ? qrRide : null;
  const activeQrRideStatus = !activeQrRide ? null
    : activeQrRide.booking.status === 'accepted' ? 'Waiting for the driver to start'
    : activeQrRide.booking.status === 'in_transit' ? `On the way to ${activeQrRide.booking.dropoff.name}`
    : activeQrRide.booking.payment_status === 'payment_submitted' ? 'Waiting for payment confirmation'
    : 'Payment required';
  const [showAddPlace, setShowAddPlace] = useState(false);

  // Same add-and-confirm handling as the Saved Places screen.
  const handleAddPlace = async (fields: { label: string; address: string; lat: number; lng: number }) => {
    try {
      await addSavedPlace(fields);
      showToast('Saved place added.');
    } catch (err: any) {
      showToast(err?.message || 'Could not save this place. Please try again.', 'info');
    }
  };

  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  // Which tab the destination picker opens on: "Where to?" -> Suggested, "More" -> Saved Places.
  const [pickerTab, setPickerTab] = useState<'suggested' | 'saved'>('suggested');
  const openPicker = (tab: 'suggested' | 'saved') => {
    setPickerTab(tab);
    setShowDestinationPicker(true);
  };
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Measured from actual layout rather than guessed, so the pickup pin sits centered in the
  // visible area between the header bar and the action sheet, not the full screen height.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const handleHeaderLayout = (e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const handleOpenNotifications = () => {
    if (onOpenNotifications) onOpenNotifications();
    setShowNotificationsModal(true);
  };

  // Live position for the Home pin/Focus follow (see useLiveLocation) — falls back to the
  // one-shot real fix below until the first live update arrives.
  const liveLocation = useLiveLocation(true);

  // The map mounts immediately and starts loading tiles; it simply has no pin until the first
  // real GPS fix. Booking actions stay disabled until then, because until then `pickup` is still
  // the context's placeholder, not the passenger's real position.
  const locationKnown = currentLat != null && currentLng != null;

  return (
    <View style={styles.container}>
      {/* Full-bleed map — the screen's primary surface, not a bounded canvas */}
      <TrivoraMap
        pickup={pickup}
        showCompass={false}
        focusCurrentLocation
        currentLocation={liveLocation ?? (locationKnown ? { lat: currentLat as number, lng: currentLng as number } : null)}
        topInset={headerHeight}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />
      {!locationKnown && (
        <MapLocationNotice isLocating={isLocatingPickup} error={locationError} onRetry={retryLocation} top={headerHeight + 8} />
      )}

      {/* Header bar — same structure as the Driver app's Home header: an opaque bar floating
          over the full-bleed map with identity/greeting on the left and alerts on the right,
          instead of two disconnected floating icons with no text. */}
      <View style={[styles.header, { paddingTop: topInset + SPACING.sm }]} onLayout={handleHeaderLayout}>
        <TouchableOpacity onPress={onOpenProfile} activeOpacity={0.8} accessibilityLabel="Profile">
          {/* "driver" tone is the component's solid-navy/white-initials treatment — the same
              default appearance Driver Home uses for its own avatar. Using it here for the
              passenger's own avatar (not the tinted "passenger" tone used for someone else's
              avatar elsewhere) matches Driver's default-profile look exactly. */}
          <Avatar name={user?.name || 'Passenger'} imageUri={user?.avatarUrl} tone="driver" size={40} />
        </TouchableOpacity>

        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>{greeting}, {firstName}</Text>
          {/* Where the passenger is right now — the real reverse-geocoded pick-up address (the
              same one "Where to?" books from), never a placeholder town name. */}
          <View style={styles.headerLocationRow}>
            <MapPin size={12} color={locationKnown ? COLORS.primary : COLORS.textMuted} strokeWidth={2.4} />
            <Text style={styles.headerLocation} numberOfLines={1}>
              {locationKnown ? pickup.name : 'Finding your location…'}
            </Text>
          </View>
        </View>

        <FloatingIconButton
          size={40}
          onPress={handleOpenNotifications}
          hasBadge={unreadNotificationCount > 0}
          accessibilityLabel="Notifications"
        >
          <Bell size={17} color={COLORS.textPrimary} />
        </FloatingIconButton>
      </View>

      {/* One booking entry point: "Where to?" opens the destination picker (search, saved,
          suggested, or pin on map), and every path lands on the same Destination & Route screen.
          The saved places below are one-tap shortcuts into that same flow — real saved places
          only, never invented ones. */}
      <View style={styles.sheet} onLayout={handleSheetLayout}>
        {activeQrRide && (
          <TouchableOpacity
            style={styles.activeRideBar}
            onPress={resumeRide}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Active Ride. ${activeQrRideStatus}. Open ride.`}
          >
            <View style={styles.scanIcon}>
              <TricycleIcon size={20} color={COLORS.primary} />
            </View>
            <View style={styles.whereToTextCol}>
              <Text style={styles.scanTitle}>Active Ride</Text>
              <Text style={styles.activeRideStatus} numberOfLines={1}>{activeQrRideStatus}</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.whereTo, !locationKnown && styles.disabled]}
          onPress={() => openPicker('suggested')}
          activeOpacity={0.85}
          disabled={!locationKnown}
          accessibilityRole="button"
          accessibilityLabel="Where to? Choose your destination"
        >
          <View style={styles.searchBadge}>
            <Search size={18} color={COLORS.textInverse} strokeWidth={2.4} />
          </View>
          <View style={styles.whereToTextCol}>
            <Text style={styles.whereToTitle}>Where to?</Text>
            <Text style={styles.whereToSubtitle} numberOfLines={1}>
              {locationKnown ? 'Book a tricycle anywhere in Nasugbu' : 'Waiting for your location…'}
            </Text>
          </View>
          <ChevronRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Second way to ride: already at a tricycle with no booking — scan its QR and join. */}
        <TouchableOpacity
          style={styles.scanRow}
          onPress={openScanner}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Scan to Ride. Already at a tricycle? Scan its QR code to join."
        >
          <View style={styles.scanIcon}>
            <ScanLine size={18} color={COLORS.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.whereToTextCol}>
            <Text style={styles.scanTitle}>Scan to Ride</Text>
            <Text style={styles.whereToSubtitle} numberOfLines={1}>Already at a tricycle? Scan its QR to join.</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.savedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Saved places</Text>
            {savedPlaces.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowAddPlace(true)}
                hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Add a saved place"
                style={styles.addLink}
              >
                <Plus size={14} color={COLORS.primary} strokeWidth={2.4} />
                <Text style={styles.addLinkText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          {isLoadingSavedPlaces && savedPlaces.length === 0 ? (
            <View style={styles.savedStatusRow}>
              <ActivityIndicator size="small" color={COLORS.textMuted} />
              <Text style={styles.savedStatusText}>Loading saved places…</Text>
            </View>
          ) : savedPlaces.length === 0 ? (
            <TouchableOpacity
              style={styles.addPlaceRow}
              onPress={() => setShowAddPlace(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.addPlaceIcon}>
                <Plus size={16} color={COLORS.primary} strokeWidth={2.4} />
              </View>
              <View style={styles.addPlaceTextCol}>
                <Text style={styles.addPlaceTitle}>Add a saved place</Text>
                <Text style={styles.addPlaceSubtitle}>Home, work or any place you ride to often</Text>
              </View>
            </TouchableOpacity>
          ) : (
            // Fixed row of four equal tiles: the first three saved places, then "More" for the
            // full Saved Places list (where the rest live and new ones are added).
            <View style={styles.tileRow}>
              {savedPlaces.slice(0, MAX_SHORTCUTS).map((place) => {
                const Icon = SAVED_PLACE_ICONS[place.label] || Bookmark;
                return (
                  <TouchableOpacity
                    key={place.id}
                    style={[styles.tile, !locationKnown && styles.disabled]}
                    onPress={() =>
                      selectDestination({ name: place.label, address: place.address, lat: place.lat, lng: place.lng, category: 'Saved' })
                    }
                    activeOpacity={0.7}
                    disabled={!locationKnown}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to ${place.label}, ${place.address}`}
                  >
                    <View style={styles.tileIcon}>
                      <Icon size={18} color={COLORS.primary} />
                    </View>
                    <Text style={styles.tileLabel} numberOfLines={1}>{place.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {/* Keeps "More" in the fourth slot even with fewer than three saved places. */}
              {Array.from({ length: Math.max(0, MAX_SHORTCUTS - savedPlaces.length) }).map((_, i) => (
                <View key={`spacer-${i}`} style={styles.tile} />
              ))}
              <TouchableOpacity
                style={styles.tile}
                onPress={() => openPicker('saved')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`More saved places${savedPlaces.length > MAX_SHORTCUTS ? `, ${savedPlaces.length - MAX_SHORTCUTS} more` : ''}`}
              >
                <View style={[styles.tileIcon, styles.tileIconMuted]}>
                  <MoreHorizontal size={18} color={COLORS.textSecondary} />
                </View>
                <Text style={[styles.tileLabel, styles.tileLabelMuted]} numberOfLines={1}>More</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <AddEditSavedPlaceModal
        visible={showAddPlace}
        onClose={() => setShowAddPlace(false)}
        onSave={handleAddPlace}
      />

      <DestinationPickerModal
        visible={showDestinationPicker}
        onClose={() => setShowDestinationPicker(false)}
        onSelect={(dest) => selectDestination(dest)}
        currentLocation={pickup}
        initialPlacesTab={pickerTab}
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
  disabled: {
    opacity: 0.45,
  },
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
    paddingBottom: SPACING.sm + 4,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerLocation: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.md + 4,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md + 4,
    gap: SPACING.md,
    ...SHADOWS.sheet,
  },
  whereTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingLeft: 12,
    paddingRight: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surfaceInput,
  },
  searchBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whereToTextCol: {
    flex: 1,
  },
  whereToTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  whereToSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Secondary action: same left edge as the search badge, no box — lighter than "Where to?".
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: SPACING.md,
    marginTop: -SPACING.xs,
  },
  activeRideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingLeft: 12,
    paddingRight: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  activeRideStatus: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.primary,
  },
  scanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginTop: -SPACING.xs,
  },
  savedSection: {
    gap: SPACING.sm + 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addLinkText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.primary,
  },
  tileRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
    minHeight: 72,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconMuted: {
    backgroundColor: COLORS.surfaceInput,
  },
  tileLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.textPrimary,
    maxWidth: '100%',
  },
  tileLabelMuted: {
    color: COLORS.textSecondary,
  },
  savedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    height: 44,
  },
  savedStatusText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  addPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  addPlaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlaceTextCol: {
    flex: 1,
  },
  addPlaceTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  addPlaceSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});
