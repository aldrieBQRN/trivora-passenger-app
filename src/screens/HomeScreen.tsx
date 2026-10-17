import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { Bell, Search, Home as HomeIcon, Briefcase, School, Bookmark, Plus, ChevronRight, ScanLine, MoreHorizontal, MapPin } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import TrivoraMap from '../components/TrivoraMap';
import DestinationSearchScreen from './DestinationSearchScreen';
import { useNotifications } from '../context/NotificationsContext';
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

/** Pulsing placeholder in the saved places strip's shape (shortcuts + "More"), shown on first load. */
function SavedPlacesSkeleton() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.placesStrip} accessibilityLabel="Loading saved places">
      {Array.from({ length: MAX_SHORTCUTS + 1 }, (_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.placeDivider} />}
          <Animated.View style={[styles.placeCell, { opacity: pulse }]}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonLabel} />
          </Animated.View>
        </React.Fragment>
      ))}
    </View>
  );
}

export default function HomeScreen({
  topInset = 0,
  onOpenNotifications,
  onOpenProfile,
}: HomeScreenProps) {
  const {
    pickup,
    selectDestination,
    currentLat,
    currentLng,
    currentLocationLabel,
    isLocatingPickup,
    locationError,
    retryLocation,
  } = useBooking();
  const { user } = useAuth();
  const { isConnected } = useNetwork();
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
  // The notification center itself is rendered app-wide (App.tsx) so a tapped phone notification
  // can open it from any screen; the bell only opens it.
  const { unreadCount, openCenter } = useNotifications();

  // Sheet eases up into place when Home opens (transform only, so its measured height is unchanged).
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  // Measured from actual layout rather than guessed, so the pickup pin sits centered in the
  // visible area between the header bar and the action sheet, not the full screen height.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  // The navy header background ends halfway down the ride card, so the card straddles its curve.
  const [rideCardHeight, setRideCardHeight] = useState(0);
  const handleHeaderLayout = (e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const handleOpenNotifications = () => {
    if (onOpenNotifications) onOpenNotifications();
    openCenter();
  };

  // Live position for the Home pin/Focus follow (see useLiveLocation) — falls back to the
  // one-shot real fix below until the first live update arrives.
  const liveLocation = useLiveLocation(true);

  // The map mounts immediately and starts loading tiles; it simply has no pin until the first
  // real GPS fix. Booking actions stay disabled until then, because until then `pickup` is still
  // the context's placeholder, not the passenger's real position.
  const locationKnown = currentLat != null && currentLng != null;

  // Destination search is a full page, not a sheet — it replaces Home while open.
  if (showDestinationPicker) {
    return (
      <DestinationSearchScreen
        topInset={topInset}
        onBack={() => setShowDestinationPicker(false)}
        onSelect={(dest) => { selectDestination(dest); setShowDestinationPicker(false); }}
        currentLocation={pickup}
        initialPlacesTab={pickerTab}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Light status-bar icons over the navy header (Home unmounts on tab change / picker open). */}
      <StatusBar style="light" />
      {/* Full-bleed map — the screen's primary surface, not a bounded canvas */}
      <TrivoraMap
        pickup={pickup}
        showCompass={false}
        focusCurrentLocation
        currentLocation={liveLocation ?? (locationKnown ? { lat: currentLat as number, lng: currentLng as number } : null)}
        mapVariant="bright"
        pitch={0}
        topInset={headerHeight}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />
      {!locationKnown && (
        <MapLocationNotice isLocating={isLocatingPickup} error={locationError} onRetry={retryLocation} top={headerHeight + 8} />
      )}

      {/* Header — a brand-navy panel floating over the full-bleed map: a greeting with alerts + the passenger's profile, then the ride card (Where to? / Scan to Ride).
          "Where to?" is the one booking entry point: it opens the destination picker (search,
          saved, suggested, or pin on map), and every path lands on the same Destination & Route
          screen. */}
      <View
        style={[styles.header, { paddingTop: topInset + SPACING.sm }]}
        onLayout={handleHeaderLayout}
        pointerEvents="box-none"
      >
        <View style={[styles.headerBg, { bottom: rideCardHeight / 2 }]} pointerEvents="none" />
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerGreeting} numberOfLines={1}>{greeting}, {firstName}</Text>
            {/* Where the passenger is right now — the real reverse-geocoded GPS address, never
                `pickup.name` (a manual/swapped pickup is not where the passenger is). */}
            <View style={styles.headerLocationRow}>
              <MapPin size={12} color={COLORS.textInverse} strokeWidth={2.4} />
              <Text style={styles.headerLocation} numberOfLines={1}>
                {locationKnown ? currentLocationLabel ?? 'Locating your position…' : 'Finding your location…'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <FloatingIconButton
              size={34}
              onPress={handleOpenNotifications}
              hasBadge={unreadCount > 0}
              accessibilityLabel="Notifications"
              style={styles.headerIconBtn}
            >
              <Bell size={15} color={COLORS.primary} />
            </FloatingIconButton>
            <TouchableOpacity onPress={onOpenProfile} activeOpacity={0.8} accessibilityLabel="Profile">
              {/* "passenger" tone = navy initials; the header style makes its fill solid white like the bell. */}
              <View>
                <Avatar name={user?.name || 'Passenger'} imageUri={user?.avatarUrl} tone="passenger" size={40} style={styles.headerAvatar} />
                {/* Connection status at a glance — same dot as the Driver app's avatar. */}
                <View style={[styles.avatarDot, isConnected ? styles.avatarDotOnline : styles.avatarDotOffline]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Both ways to ride in one grouped card: "Where to?" leads, Scan to Ride sits below it. */}
        <View style={styles.rideCard} onLayout={(e) => setRideCardHeight(e.nativeEvent.layout.height)}>
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

        <View style={styles.rideCardDivider} />

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
            <Text style={styles.whereToSubtitle} numberOfLines={1}>Scan a tricycle's QR to join</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
        </View>
      </View>

      {/* Saved places are one-tap shortcuts into the same flow as "Where to?" — real saved places
          only, never invented ones. */}
      <Animated.View
        style={[
          styles.sheet,
          { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        ]}
        onLayout={handleSheetLayout}
      >
        {activeQrRide && (
          <TouchableOpacity
            style={styles.activeRideBar}
            onPress={resumeRide}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Active Ride. ${activeQrRideStatus}. Open ride.`}
          >
            <View style={styles.activeRideIcon}>
              <TricycleIcon size={20} color={COLORS.textInverse} />
            </View>
            <View style={styles.whereToTextCol}>
              <Text style={styles.activeRideTitle}>Active Ride</Text>
              <Text style={styles.activeRideStatus} numberOfLines={1}>{activeQrRideStatus}</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textInverse} />
          </TouchableOpacity>
        )}

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
            <SavedPlacesSkeleton />
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
            // One grouped strip, like the driver's Today strip: the first three saved places, then
            // "More" for the full Saved Places list (where the rest live and new ones are added).
            <View style={styles.placesStrip}>
              {savedPlaces.slice(0, MAX_SHORTCUTS).map((place) => {
                const Icon = SAVED_PLACE_ICONS[place.label] || Bookmark;
                return (
                  <React.Fragment key={place.id}>
                    <TouchableOpacity
                      style={[styles.placeCell, !locationKnown && styles.disabled]}
                      onPress={() =>
                        selectDestination({ name: place.label, address: place.address, lat: place.lat, lng: place.lng, category: 'Saved' })
                      }
                      activeOpacity={0.6}
                      disabled={!locationKnown}
                      accessibilityRole="button"
                      accessibilityLabel={`Go to ${place.label}, ${place.address}`}
                    >
                      <Icon size={18} color={COLORS.primary} />
                      <Text style={styles.placeLabel} numberOfLines={1}>{place.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.placeDivider} />
                  </React.Fragment>
                );
              })}
              <TouchableOpacity
                style={styles.placeCell}
                onPress={() => openPicker('saved')}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={`More saved places${savedPlaces.length > MAX_SHORTCUTS ? `, ${savedPlaces.length - MAX_SHORTCUTS} more` : ''}`}
              >
                <MoreHorizontal size={18} color={COLORS.textSecondary} />
                <Text style={[styles.placeLabel, styles.placeLabelMuted]} numberOfLines={1}>More</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      <AddEditSavedPlaceModal
        visible={showAddPlace}
        onClose={() => setShowAddPlace(false)}
        onSave={handleAddPlace}
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
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  // Navy panel behind the header, floating over the map with rounded bottom corners; its bottom
  // edge is set at runtime to the ride card's vertical centre.
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
    ...SHADOWS.md,
    // No Android elevation: it would lift this layer above the logo row (elevation outranks
    // render order there). The iOS shadow still applies.
    elevation: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  // Border on the avatar itself (not a wrapper ring), so no seam shows between two circles.
  headerAvatar: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  avatarDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary, // cut out against the navy header
  },
  avatarDotOnline: { backgroundColor: COLORS.success },
  avatarDotOffline: { backgroundColor: COLORS.textMuted },
  // Solid white on the navy header.
  headerIconBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerGreeting: {
    ...TYPOGRAPHY.h3,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerLocation: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.75)',
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
    paddingTop: SPACING.md + 4,
    paddingBottom: SPACING.md,
    gap: SPACING.sm + 6,
    ...SHADOWS.sheet,
  },
  // One white card holding both ride options (hairline border, soft lift).
  rideCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    ...SHADOWS.card,
  },
  rideCardDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: 12 + 44 + 12, // starts under the text, not the icon
  },
  whereTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingLeft: 12,
    paddingRight: SPACING.md,
    paddingVertical: 12,
  },
  searchBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  // Secondary row inside the ride card — lighter than "Where to?".
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeRideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    ...SHADOWS.md,
  },
  activeRideIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRideTitle: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  activeRideStatus: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  savedSection: {
    gap: SPACING.sm + 2,
    marginTop: SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
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
  // Saved places strip — light grey, hairline border, vertical dividers between cells.
  placesStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundSubtle,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  placeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.xs,
  },
  placeDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.border,
  },
  placeLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.textPrimary,
    maxWidth: '100%',
  },
  placeLabelMuted: {
    color: COLORS.textSecondary,
  },
  skeletonIcon: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  skeletonLabel: {
    width: '60%',
    height: 10,
    marginVertical: 3,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  addPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  addPlaceIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
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
