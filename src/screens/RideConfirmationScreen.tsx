import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { MessageSquare, ArrowLeft } from 'lucide-react-native';
import { CashIcon } from '../components/icons';
import TrivoraMap from '../components/TrivoraMap';
import FloatingIconButton from '../components/FloatingIconButton';
import Button from '../components/Button';
import RouteSummaryStrip from '../components/RouteSummaryStrip';

const MAP_STRIP_HEIGHT = 200;

const PASSENGER_COUNT_PATTERN = /^[1-9]\d*$/;

export default function RideConfirmationScreen() {
  const {
    setScreenState,
    pickup,
    dropoff,
    fareEstimate,
    routeCoordinates,
    routeSource,
    noteToDriver,
    setNoteToDriver,
    confirmBooking,
  } = useBooking();
  const [isConfirming, setIsConfirming] = useState(false);
  const [numberOfPassengers, setNumberOfPassengers] = useState('1');
  const [farePerPassenger, setFarePerPassenger] = useState(() =>
    fareEstimate.total > 0 ? fareEstimate.total.toFixed(2) : ''
  );
  const [errors, setErrors] = useState<{ numberOfPassengers?: string; farePerPassenger?: string }>({});

  const parsedPassengerCount = Number(numberOfPassengers);
  const parsedFarePerPassenger = Number(farePerPassenger);
  const computedTotalFare =
    PASSENGER_COUNT_PATTERN.test(numberOfPassengers.trim()) && parsedFarePerPassenger > 0
      ? parsedPassengerCount * parsedFarePerPassenger
      : 0;

  const validate = () => {
    const nextErrors: { numberOfPassengers?: string; farePerPassenger?: string } = {};
    if (!PASSENGER_COUNT_PATTERN.test(numberOfPassengers.trim())) {
      nextErrors.numberOfPassengers = 'Enter a whole number of passengers (1 or more)';
    }
    if (!Number.isFinite(parsedFarePerPassenger) || parsedFarePerPassenger <= 0) {
      nextErrors.farePerPassenger = 'Enter a valid fare per passenger';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (isConfirming) return;
    if (!validate()) return;
    setIsConfirming(true);
    await confirmBooking(parsedPassengerCount, parsedFarePerPassenger);
    // On success this screen has already been replaced by SearchingDriversScreen (screenState
    // moved to 'searching'), so this only visibly matters on failure — resetting the button
    // instead of leaving it stuck mid-spin after the toast.
    setIsConfirming(false);
  };

  return (
    <View style={styles.container}>
      {/* The map now gets its full height to itself — the pickup/dropoff card used to float
          on top of it and ended up covering nearly the whole strip, leaving barely a sliver of
          map actually visible. It's a normal content card below the map instead. */}
      <View style={styles.mapStrip}>
        <TrivoraMap
          pickup={pickup}
          dropoff={dropoff}
          rideState="confirm_fare"
          suggestedRouteInfo={{
            distance: `${fareEstimate.distanceKm} km`,
            duration: `${fareEstimate.durationMinutes} min`,
          }}
          routeCoordinates={routeCoordinates}
          routeSource={routeSource}
          showTodaPill={false}
          showTodaPins={false}
          showCompass={false}
          showRouteBadge={false}
          style={StyleSheet.absoluteFillObject}
        />

        <FloatingIconButton
          style={styles.backButton}
          size={38}
          onPress={() => setScreenState('destination_select')}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={18} color={COLORS.textPrimary} />
        </FloatingIconButton>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.routeCard}>
          <RouteSummaryStrip variant="readonly" pickupLabel={pickup.name} dropoffLabel={dropoff.name} />
        </View>

        {/* Passenger enters both inputs; the total is always derived, never typed directly */}
        <View style={styles.fareInputsSection}>
          <View style={styles.fareInputGroup}>
            <Text style={styles.sectionLabel}>Number of Passengers</Text>
            <TextInput
              style={[styles.fareInput, errors.numberOfPassengers && styles.fareInputError]}
              keyboardType="number-pad"
              value={numberOfPassengers}
              onChangeText={(text) => {
                setNumberOfPassengers(text);
                if (errors.numberOfPassengers) setErrors((prev) => ({ ...prev, numberOfPassengers: undefined }));
              }}
              placeholder="1"
              placeholderTextColor={COLORS.textMuted}
            />
            {errors.numberOfPassengers ? <Text style={styles.errorText}>{errors.numberOfPassengers}</Text> : null}
          </View>
          <View style={styles.fareInputGroup}>
            <Text style={styles.sectionLabel}>Fare per Passenger / Head</Text>
            <View style={[styles.fareInputRow, errors.farePerPassenger && styles.fareInputError]}>
              <Text style={styles.farePrefix}>₱</Text>
              <TextInput
                style={styles.fareInputFlex}
                keyboardType="decimal-pad"
                value={farePerPassenger}
                onChangeText={(text) => {
                  setFarePerPassenger(text);
                  if (errors.farePerPassenger) setErrors((prev) => ({ ...prev, farePerPassenger: undefined }));
                }}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            {errors.farePerPassenger ? <Text style={styles.errorText}>{errors.farePerPassenger}</Text> : null}
          </View>
        </View>

        {/* Fare is the loudest thing on this screen — everything else is secondary */}
        <View style={styles.fareHero}>
          <Text style={styles.fareHeroLabel}>Total Fare</Text>
          <Text style={styles.fareHeroValue}>₱{computedTotalFare.toFixed(2)}</Text>
          <View style={styles.fareBreakdownRow}>
            <Text style={styles.fareBreakdownItem}>
              ₱{(Number.isFinite(parsedFarePerPassenger) ? parsedFarePerPassenger : 0).toFixed(2)} ×{' '}
              {PASSENGER_COUNT_PATTERN.test(numberOfPassengers.trim()) ? parsedPassengerCount : 0} passenger
              {parsedPassengerCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        {/* Cash is the only supported payment method right now, so this is a plain info row
            instead of a selector with nothing else to select. */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.paymentRow}>
          <CashIcon size={18} />
          <Text style={styles.paymentRowText}>Cash — pay the driver directly</Text>
        </View>

        {/* Note to driver — always visible, no tap needed to reveal it; the label makes clear
            it's optional instead of relying on an extra "Add a note" step. */}
        <View style={styles.noteSection}>
          <Text style={styles.sectionLabel}>Note to Driver (Optional)</Text>
          <View style={styles.noteInputRow}>
            <MessageSquare size={16} color={COLORS.textSecondary} />
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Waiting near blue gate, with groceries..."
              placeholderTextColor={COLORS.textMuted}
              value={noteToDriver}
              onChangeText={setNoteToDriver}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {/* The total fare is already shown as its own heading above (fareHero) — no need to
            repeat it inside the button too. */}
        <Button label="Confirm Booking" onPress={handleConfirm} loading={isConfirming} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapStrip: {
    height: MAP_STRIP_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    ...SHADOWS.sm,
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: SPACING.md,
  },
  routeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: 30,
  },
  fareInputsSection: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  fareInputGroup: {
    flex: 1,
    gap: 6,
  },
  fareInput: {
    height: 48,
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  fareInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    gap: 4,
  },
  fareInputError: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  farePrefix: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  fareInputFlex: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.dangerDark,
  },
  fareHero: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryTint,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  fareHeroLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  fareHeroValue: {
    ...TYPOGRAPHY.display,
    color: COLORS.primary,
    marginTop: 2,
  },
  fareBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  fareBreakdownItem: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentRowText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  noteSection: {
    gap: 6,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noteInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  bottomBar: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.sheet,
  },
});
