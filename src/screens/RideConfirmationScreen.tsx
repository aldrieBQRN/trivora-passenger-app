import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { calculateFare } from '../constants/todaRoutes';
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
  const [errors, setErrors] = useState<{ numberOfPassengers?: string }>({});

  const parsedPassengerCount = Number(numberOfPassengers);
  const isPassengerCountValid = PASSENGER_COUNT_PATTERN.test(numberOfPassengers.trim());
  // The one place this screen computes fare: mirrors FareService on the backend exactly (same
  // function used everywhere else in the app), fed the real route distance plus whatever
  // passenger count is currently typed — never a manual multiplication of an already-computed
  // total. Falls back to 1 passenger for the live preview while the field is mid-edit/invalid;
  // the Confirm button itself stays gated on isPassengerCountValid regardless.
  const liveFare = useMemo(
    () => calculateFare(fareEstimate.distanceKm, undefined, isPassengerCountValid ? parsedPassengerCount : 1),
    [fareEstimate.distanceKm, isPassengerCountValid, parsedPassengerCount]
  );
  const hasAdditionalDistance = liveFare.distanceKm > 4;

  const validate = () => {
    const nextErrors: { numberOfPassengers?: string } = {};
    if (!PASSENGER_COUNT_PATTERN.test(numberOfPassengers.trim())) {
      nextErrors.numberOfPassengers = 'Enter a whole number of passengers (1 or more)';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (isConfirming) return;
    if (!validate()) return;
    setIsConfirming(true);
    await confirmBooking(parsedPassengerCount);
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
        </View>

        {/* Fare is the loudest thing on this screen — everything else is secondary. Base fare is
            ₱50 flat for 1 passenger, or ₱25 per passenger for 2+, both covering the first 4 km;
            every km beyond that adds ₱5 per passenger — this preview is only ever a preview: the
            backend recomputes and stores the authoritative amount from the same distance and
            passenger count the moment the booking is confirmed. */}
        <View style={styles.fareHero}>
          <Text style={styles.fareHeroLabel}>Total Fare</Text>
          <Text style={styles.fareHeroValue}>₱{liveFare.total.toFixed(2)}</Text>
          <View style={styles.fareBreakdownRow}>
            <Text style={styles.fareBreakdownItem}>
              {liveFare.passengerCount === 1
                ? `Base fare (up to 4 km): ₱${liveFare.base.toFixed(2)}`
                : `Base fare (up to 4 km, per passenger): ₱${liveFare.base.toFixed(2)} × ${liveFare.passengerCount}`}
            </Text>
          </View>
          {hasAdditionalDistance && (
            <View style={styles.fareBreakdownRow}>
              <Text style={styles.fareBreakdownItem}>
                Additional distance (₱5.00/km, per passenger): ₱{liveFare.distanceFee.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.fareDivider} />
          <View style={styles.fareBreakdownRow}>
            <Text style={styles.fareSummaryItem}>Fare per passenger</Text>
            <Text style={styles.fareSummaryValue}>₱{liveFare.perPassengerFare.toFixed(2)}</Text>
          </View>
          <View style={styles.fareBreakdownRow}>
            <Text style={styles.fareSummaryItem}>Passenger count</Text>
            <Text style={styles.fareSummaryValue}>× {liveFare.passengerCount}</Text>
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
  fareInputError: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
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
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  fareBreakdownItem: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  fareDivider: {
    width: '60%',
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 10,
  },
  fareSummaryItem: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  fareSummaryValue: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
