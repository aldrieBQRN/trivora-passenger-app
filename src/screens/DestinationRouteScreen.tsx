import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { ArrowLeft, ArrowUpDown, ShieldCheck, MapPin } from 'lucide-react-native';
import TrivoraMap from '../components/TrivoraMap';
import DestinationPickerModal from '../components/DestinationPickerModal';
import PinLocationModal from '../components/PinLocationModal';
import FloatingIconButton from '../components/FloatingIconButton';
import Button from '../components/Button';
import RouteSummaryStrip from '../components/RouteSummaryStrip';

interface DestinationRouteScreenProps {
  topInset?: number;
}

export default function DestinationRouteScreen({ topInset = 0 }: DestinationRouteScreenProps) {
  const {
    setScreenState,
    pickup,
    dropoff,
    hasDestination,
    matchedToda,
    fareEstimate,
    routeCoordinates,
    routeSource,
    selectDestination,
    selectPickup,
    swapLocations,
    useCurrentLocationForPickup,
  } = useBooking();

  const [pickerMode, setPickerMode] = useState<'pickup' | 'destination' | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

  // Measured from actual layout rather than guessed — see ActiveRideScreen.
  const [topOverlayHeight, setTopOverlayHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const handleTopLayout = (e: LayoutChangeEvent) => setTopOverlayHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  return (
    <View style={styles.container}>
      {/* Full-bleed map — same primary surface as Home, carrying the route */}
      <TrivoraMap
        pickup={pickup}
        dropoff={hasDestination ? dropoff : null}
        activeZone={matchedToda}
        rideState="destination_select"
        mapVariant="bright"
        pitch={0}
        suggestedRouteInfo={{
          distance: `${fareEstimate.distanceKm} km`,
          duration: `${fareEstimate.durationMinutes} min`,
        }}
        routeCoordinates={hasDestination ? routeCoordinates : []}
        routeSource={routeSource}
        showTodaPill={false}
        showRouteBadge={hasDestination}
        showCompass={true}
        topInset={topInset + 10 + topOverlayHeight}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Minimal floating controls, matching Home's language exactly */}
      <View style={[styles.floatingTopRow, { top: topInset + 10 }]} onLayout={handleTopLayout}>
        <FloatingIconButton onPress={() => setScreenState('home')} accessibilityLabel="Back">
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </FloatingIconButton>

        <FloatingIconButton onPress={swapLocations} accessibilityLabel="Swap pickup and destination">
          <ArrowUpDown size={18} color={COLORS.primary} />
        </FloatingIconButton>
      </View>

      {/* Primary composition: editable route + zone/distance context + CTA */}
      <View style={styles.sheet} onLayout={handleSheetLayout}>
        <RouteSummaryStrip
          variant="editable"
          pickupLabel={pickup.name}
          dropoffLabel={hasDestination ? dropoff.name : ''}
          onPressPickup={() => setPickerMode('pickup')}
          onPressDropoff={() => setPickerMode('destination')}
        />

        <View style={styles.metaRow}>
          <View style={styles.metaLeftGroup}>
            <View style={styles.zoneTag}>
              <ShieldCheck size={12} color={COLORS.primary} />
              <Text style={styles.zoneTagText} numberOfLines={1}>{matchedToda?.name || 'TODA Bucana Zone'}</Text>
            </View>
            {/* Distance/time is on the map's route badge — not repeated here. */}
          </View>

          <TouchableOpacity
            style={styles.pinChip}
            onPress={() => setShowPinModal(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Pin destination on map"
          >
            <MapPin size={13} color={COLORS.primary} strokeWidth={2.4} />
            <Text style={styles.pinLink}>Pin on map</Text>
          </TouchableOpacity>
        </View>

        <Button
          label="Continue"
          onPress={() => setScreenState('confirm_fare')}
          disabled={!hasDestination}
        />
      </View>

      {/* Destination Picker Modal — also reused for Change Pick-up, in 'pickup' mode */}
      <DestinationPickerModal
        visible={pickerMode !== null}
        onClose={() => setPickerMode(null)}
        mode={pickerMode === 'pickup' ? 'pickup' : 'destination'}
        currentLocation={pickerMode === 'pickup' ? (hasDestination ? dropoff : undefined) : pickup}
        initialLocation={pickerMode === 'pickup' ? pickup : (hasDestination ? dropoff : undefined)}
        onUseCurrentLocation={pickerMode === 'pickup' ? useCurrentLocationForPickup : undefined}
        onSelect={(loc) => {
          if (pickerMode === 'pickup') {
            selectPickup(loc);
          } else {
            selectDestination(loc);
          }
        }}
      />

      {/* Pin Location on Map Modal */}
      <PinLocationModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        currentPickup={pickup}
        initialLocation={hasDestination ? dropoff : undefined}
        onConfirmPin={(loc) => {
          selectDestination(loc);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSubtle,
  },
  floatingTopRow: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  metaLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  zoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    flexShrink: 1,
  },
  // The zone name gives way (ellipsis) before the distance/time does.
  zoneTagText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.primary,
    flexShrink: 1,
  },
  // Reads as a small tappable chip, not stray bold text.
  pinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pinLink: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
