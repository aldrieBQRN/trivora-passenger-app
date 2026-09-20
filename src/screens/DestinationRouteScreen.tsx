import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { ArrowLeft, ArrowUpDown, ShieldCheck } from 'lucide-react-native';
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
              <Text style={styles.zoneTagText}>{matchedToda?.name || 'TODA Bucana Zone'}</Text>
            </View>
            {hasDestination && (
              <Text style={styles.metaMetrics}>
                {fareEstimate.distanceKm} km · ~{fareEstimate.durationMinutes} min
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setShowPinModal(true)} activeOpacity={0.7}>
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
  },
  zoneTagText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.primary,
  },
  metaMetrics: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  pinLink: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '800',
  },
});
