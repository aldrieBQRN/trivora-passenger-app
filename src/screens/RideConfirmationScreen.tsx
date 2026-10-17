import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { calculateFare } from '../constants/todaRoutes';
import { MessageSquare, ArrowLeft, Minus, Plus, Banknote, Smartphone, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react-native';
import TrivoraMap from '../components/TrivoraMap';
import FloatingIconButton from '../components/FloatingIconButton';
import Button from '../components/Button';
import RouteSummaryStrip from '../components/RouteSummaryStrip';

const MAP_STRIP_HEIGHT = 200;
/** Floating back button over the map strip (top offset + size) — its bottom edge is passed to the
 * map as topInset so the trip fit keeps both pins below it. */
const BACK_BUTTON_TOP = 10;
const BACK_BUTTON_SIZE = 38;
/** Same ceiling the backend validates (BookingController: passenger_count max:10). */
const MAX_PASSENGERS = 10;
/** One-tap additions to the note to driver; tapping a selected one removes it again. */
const QUICK_NOTES = ['Waiting outside', 'Call me on arrival', 'With luggage', 'Please wait a moment'];

/** Toggles a quick note in the comma-separated note text, leaving anything typed intact. */
function toggleQuickNote(note: string, quick: string) {
  const parts = note.split(',').map((p) => p.trim()).filter(Boolean);
  const next = parts.includes(quick) ? parts.filter((p) => p !== quick) : [...parts, quick];
  return next.join(', ');
}

/**
 * Confirm a booked ride: route recap, passengers (stepper), payment method (one row), the fare
 * breakdown, an optional note, and Confirm with the total beside it — the same building blocks as
 * the QR ride setup screen, so both ways to ride look and read alike.
 */
interface RideConfirmationScreenProps {
  /** App.tsx doesn't pad this screen: the map strip runs under the status bar and the footer
   * pads above the phone's navigation bar, like the other booking-flow screens. */
  topInset?: number;
  bottomInset?: number;
}

export default function RideConfirmationScreen({ topInset = 0, bottomInset = 0 }: RideConfirmationScreenProps) {
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
    paymentMethod,
    setPaymentMethod,
  } = useBooking();
  const [isConfirming, setIsConfirming] = useState(false);
  // A stepper (never free text), so the count is always a whole number of at least 1.
  const [passengerCount, setPassengerCount] = useState(1);
  // Fare shows as one total row; the line-by-line breakdown opens on demand.
  const [showBreakdown, setShowBreakdown] = useState(false);
  const noteParts = noteToDriver.split(',').map((p) => p.trim());

  // The one place this screen computes fare: mirrors FareService on the backend exactly (same
  // function used everywhere else in the app), fed the real route distance and the passenger
  // count. Only a preview — the backend recomputes and stores the authoritative amount from the
  // same distance and passenger count the moment the booking is confirmed.
  const liveFare = useMemo(
    () => calculateFare(fareEstimate.distanceKm, undefined, passengerCount),
    [fareEstimate.distanceKm, passengerCount]
  );
  const hasAdditionalDistance = liveFare.distanceKm > 4;

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    await confirmBooking(passengerCount, paymentMethod);
    setIsConfirming(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mapStrip, { height: MAP_STRIP_HEIGHT + topInset }]}>
        <TrivoraMap
          pickup={pickup}
          dropoff={dropoff}
          rideState="confirm_fare"
          mapVariant="bright"
          pitch={0}
          suggestedRouteInfo={{
            distance: `${fareEstimate.distanceKm} km`,
            duration: `${fareEstimate.durationMinutes} min`,
          }}
          routeCoordinates={routeCoordinates}
          routeSource={routeSource}
          showCompass={false}
          showRouteBadge={false}
          topInset={topInset + BACK_BUTTON_TOP + BACK_BUTTON_SIZE}
          style={StyleSheet.absoluteFillObject}
        />

        <FloatingIconButton
          style={{ ...styles.backButton, top: topInset + BACK_BUTTON_TOP }}
          size={BACK_BUTTON_SIZE}
          onPress={() => setScreenState('destination_select')}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={18} color={COLORS.textPrimary} />
        </FloatingIconButton>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.routeCard}>
          <RouteSummaryStrip variant="readonly" pickupLabel={pickup.name} dropoffLabel={dropoff.name} />
          <Text style={styles.routeMeta}>
            {Number(liveFare.distanceKm).toFixed(1)} km · ~{liveFare.durationMinutes} min
          </Text>
        </View>

        {/* Passengers */}
        <View style={styles.rowCard}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Passengers</Text>
            <Text style={styles.rowCaption}>
              {passengerCount >= MAX_PASSENGERS ? `Maximum of ${MAX_PASSENGERS}` : 'Including yourself'}
            </Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, passengerCount <= 1 && styles.stepBtnDisabled]}
              onPress={() => setPassengerCount((n) => Math.max(1, n - 1))}
              disabled={passengerCount <= 1}
              accessibilityLabel="Fewer passengers"
            >
              <Minus size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{passengerCount}</Text>
            <TouchableOpacity
              style={[styles.stepBtn, passengerCount >= MAX_PASSENGERS && styles.stepBtnDisabled]}
              onPress={() => setPassengerCount((n) => Math.min(MAX_PASSENGERS, n + 1))}
              disabled={passengerCount >= MAX_PASSENGERS}
              accessibilityLabel="More passengers"
            >
              <Plus size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment method — one row, same as the QR ride setup */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Payment Method</Text>
          <View style={styles.paymentMethodRow}>
            {([
              { key: 'cash', label: 'Cash', Icon: Banknote },
              { key: 'gcash', label: 'GCash', Icon: Smartphone },
            ] as const).map(({ key, label, Icon }) => {
              const active = paymentMethod === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.paymentMethodCard, active && styles.paymentMethodCardActive]}
                  onPress={() => setPaymentMethod(key)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Icon size={18} color={active ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.paymentMethodText, active && styles.paymentMethodTextActive]}>{label}</Text>
                  {active && <CheckCircle2 size={16} color={COLORS.primary} style={styles.paymentCheck} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {paymentMethod === 'gcash' ? 'Pay with GCash using the QR shown by the driver at drop-off.' : 'Pay the driver in cash at drop-off.'}
          </Text>
        </View>

        {/* Fare — one total row; the breakdown opens on tap (distance lives in the route card) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fare</Text>
          <TouchableOpacity
            style={styles.fareSummaryRow}
            onPress={() => setShowBreakdown((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showBreakdown }}
            accessibilityLabel={`Total fare ₱${liveFare.total.toFixed(2)}. ${showBreakdown ? 'Hide' : 'See'} breakdown`}
          >
            <Text style={styles.totalLabel}>Total fare</Text>
            <View style={styles.fareSummaryRight}>
              <Text style={styles.fareSummaryValue}>₱{liveFare.total.toFixed(2)}</Text>
              {/* Up = hide the breakdown, down = show it. */}
              {showBreakdown ? (
                <ChevronUp size={18} color={COLORS.primary} />
              ) : (
                <ChevronDown size={18} color={COLORS.primary} />
              )}
            </View>
          </TouchableOpacity>
          {showBreakdown && (
            <View style={styles.breakdown}>
              <FareLine
                label={liveFare.passengerCount === 1 ? 'Base fare (first 4 km)' : 'Base fare (first 4 km, each)'}
                value={`₱${liveFare.base.toFixed(2)}`}
              />
              {hasAdditionalDistance && (
                <FareLine label="Extra distance (₱5.00/km, each)" value={`₱${liveFare.distanceFee.toFixed(2)}`} />
            )}
            <FareLine label="Fare per passenger" value={`₱${liveFare.perPassengerFare.toFixed(2)}`} />
            <FareLine label="Passengers" value={`× ${liveFare.passengerCount}`} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total fare</Text>
              <Text style={styles.totalValue}>₱{liveFare.total.toFixed(2)}</Text>
            </View>
          </View>
          )}
        </View>

        {/* Note to driver */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note to Driver (Optional)</Text>
          <View style={styles.quickNotesRow}>
            {QUICK_NOTES.map((quick) => {
              const selected = noteParts.includes(quick);
              return (
                <TouchableOpacity
                  key={quick}
                  style={[styles.quickNote, selected && styles.quickNoteSelected]}
                  onPress={() => setNoteToDriver(toggleQuickNote(noteToDriver, quick))}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.quickNoteText, selected && styles.quickNoteTextSelected]}>{quick}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
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

      <View style={[styles.bottomBar, { paddingBottom: SPACING.md + bottomInset }]}>
        <View style={styles.flex}>
          <Text style={styles.rowCaption}>Total fare</Text>
          <Text style={styles.footerAmount}>₱{liveFare.total.toFixed(2)}</Text>
        </View>
        <Button label="Confirm Booking" onPress={handleConfirm} loading={isConfirming} fullWidth={false} style={styles.confirmBtn} />
      </View>
    </View>
  );
}

function FareLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fareLine}>
      <Text style={styles.fareLabel}>{label}</Text>
      <Text style={styles.fareValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  mapStrip: {
    height: MAP_STRIP_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    ...SHADOWS.sm,
  },
  backButton: { position: 'absolute', top: BACK_BUTTON_TOP, left: SPACING.md },
  scrollContent: { padding: SPACING.md + 4, gap: SPACING.lg, paddingBottom: SPACING.xl },
  routeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routeMeta: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.textSecondary,
    paddingLeft: 16 + 12, // under the addresses, past RouteSummaryStrip's rail + gap
    paddingBottom: SPACING.sm,
  },
  section: { gap: SPACING.sm },
  sectionLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  hint: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },

  // Passengers
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowTitle: { ...TYPOGRAPHY.bodyLarge, fontWeight: '600', color: COLORS.textPrimary },
  rowCaption: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepValue: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, minWidth: 18, textAlign: 'center' },

  // Payment method
  paymentMethodRow: { flexDirection: 'row', gap: SPACING.md },
  paymentMethodCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  paymentMethodCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  paymentMethodText: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary },
  paymentMethodTextActive: { color: COLORS.primary },
  paymentCheck: { marginLeft: 'auto' },

  // Fare
  fareSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  fareSummaryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fareSummaryValue: { ...TYPOGRAPHY.bodyLarge, fontWeight: '700', color: COLORS.textPrimary, marginRight: 4 },
  breakdown: { paddingHorizontal: SPACING.xs },
  fareLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34, gap: SPACING.md },
  fareLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, flexShrink: 1 },
  fareValue: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    marginTop: SPACING.xs, paddingTop: SPACING.sm + 2,
  },
  totalLabel: { ...TYPOGRAPHY.bodyLarge, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },

  // Note
  noteInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surfaceInput, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, height: 48,
    borderWidth: 1, borderColor: COLORS.border,
  },
  noteInput: { flex: 1, ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  quickNotesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  quickNote: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  quickNoteSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  quickNoteText: { ...TYPOGRAPHY.caption, fontWeight: '600', color: COLORS.textSecondary },
  quickNoteTextSelected: { color: COLORS.textInverse },

  // Footer: total beside Confirm, as on the QR ride setup
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.md + 4, paddingTop: SPACING.sm + 4, paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    ...SHADOWS.sheet,
  },
  footerAmount: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },
  confirmBtn: { minWidth: 180 },
});
