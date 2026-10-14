import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { ArrowLeft, ArrowUpDown } from 'lucide-react-native';
import TrivoraMap from '../components/TrivoraMap';
import DestinationSearchScreen from './DestinationSearchScreen';
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

  // Measured from actual layout rather than guessed — see ActiveRideScreen.
  const [topOverlayHeight, setTopOverlayHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const handleTopLayout = (e: LayoutChangeEvent) => setTopOverlayHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  // Destination/pick-up search is a full page, not a sheet — it replaces this screen while open.
  if (pickerMode) {
    const isPickupMode = pickerMode === 'pickup';
    return (
      <DestinationSearchScreen
        topInset={topInset}
        onBack={() => setPickerMode(null)}
        mode={pickerMode}
        currentLocation={isPickupMode ? (hasDestination ? dropoff : undefined) : pickup}
        initialLocation={isPickupMode ? pickup : (hasDestination ? dropoff : undefined)}
        onUseCurrentLocation={isPickupMode ? useCurrentLocationForPickup : undefined}
        onSelect={(loc) => {
          setPickerMode(null);
          if (isPickupMode) {
            selectPickup(loc);
          } else {
            selectDestination(loc);
          }
        }}
      />
    );
  }

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

      {/* Primary composition: editable route + CTA */}
      <View style={styles.sheet} onLayout={handleSheetLayout}>
        <RouteSummaryStrip
          variant="editable"
          pickupLabel={pickup.name}
          dropoffLabel={hasDestination ? dropoff.name : ''}
          onPressPickup={() => setPickerMode('pickup')}
          onPressDropoff={() => setPickerMode('destination')}
        />

        <Button
          label="Continue"
          onPress={() => setScreenState('confirm_fare')}
          disabled={!hasDestination}
        />
      </View>
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
  });
