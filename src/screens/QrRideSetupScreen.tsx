import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MapPin, ChevronRight, Minus, Plus, AlertCircle, RefreshCw, ScanLine } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useQrRide } from '../context/QrRideContext';
import { useBooking } from '../context/BookingContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import DestinationPickerModal from '../components/DestinationPickerModal';
import { describeTricycle, formatPeso } from '../utils/qrRide';
import TricycleIcon from '../components/icons/TricycleIcon';
import { LocationPoint } from '../types';

/** Titles for the server's rejection codes — the explanation itself is always the server's. */
const REASON_TITLES: Record<string, string> = {
  invalid_qr: 'QR code not recognized',
  tricycle_not_active: 'Tricycle not in service',
  franchise_suspended: 'Franchise suspended',
  franchise_revoked: 'Franchise revoked',
  franchise_inactive: 'No active franchise',
  no_driver: 'No driver on duty',
  driver_offline: 'No driver on duty',
  driver_busy: 'Driver is on a booked ride',
  passenger_has_active_ride: 'You already have a ride',
  capacity_not_configured: 'Not set up for Scan to Ride',
  ride_full: 'This tricycle is full',
  ride_in_progress: 'Ride is currently in progress',
  network: 'Connection problem',
};

/**
 * After a scan: the tricycle (server-resolved), whether it's taking passengers, then destination
 * + party size, the server's fare quote, and Join Ride. There is no pick-up choice — the passenger
 * is at the tricycle and the server sets the pick-up point.
 */
export default function QrRideSetupScreen() {
  const {
    scan, scanError, isResolving, quote, quoteError, isQuoting, joinError, isJoining,
    closeQr, openScanner, refreshScan, requestQuote, clearQuote, joinRide,
  } = useQrRide();
  const { currentLat, currentLng } = useBooking();
  const { requestCurrentLocation, isLocating } = useCurrentLocation();

  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [showPicker, setShowPicker] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const seatsAvailable = scan?.ride.seats_available ?? null;
  const maxParty = Math.max(1, seatsAvailable ?? 1);
  const canJoin = !!scan?.ride.can_join;

  // Keep the party size inside what the server says is free (the server re-checks on Join).
  useEffect(() => {
    if (partySize > maxParty) setPartySize(maxParty);
  }, [maxParty]);

  // Server quote whenever the destination or party size changes, debounced by ~300ms. The passenger's own position is
  // sent only as the server's fallback pick-up when the tricycle's GPS isn't fresh.
  useEffect(() => {
    if (!canJoin || !destination) {
      clearQuote();
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      let here = currentLat != null && currentLng != null ? { lat: currentLat, lng: currentLng } : null;
      if (!here) here = await requestCurrentLocation();
      if (cancelled) return;
      if (!here) {
        setLocationError('Turn on location so Trivora can confirm where you are boarding.');
        return;
      }
      setLocationError(null);
      requestQuote(destination, partySize, here);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canJoin, destination?.lat, destination?.lng, destination?.name, partySize]);

  const pickupLabel = useMemo(() => {
    if (!quote) return "The tricycle's current location";
    return quote.pickup.source === 'tricycle_gps'
      ? "The tricycle's current location"
      : 'Your current location (tricycle GPS unavailable)';
  }, [quote]);

  // ---------------------------------------------------------------- loading / hard errors
  if (isResolving && !scan) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Scan to Ride" onBack={closeQr} />
        <View style={styles.centerState}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.centerStateText}>Checking this tricycle…</Text>
        </View>
      </View>
    );
  }

  if (scanError || !scan) {
    const code = scanError?.code || 'invalid_qr';
    return (
      <View style={styles.container}>
        <ScreenHeader title="Scan to Ride" onBack={closeQr} />
        <View style={styles.centerState}>
          <View style={styles.stateIcon}><AlertCircle size={26} color={COLORS.dangerDark} /></View>
          <Text style={styles.stateTitle}>{REASON_TITLES[code] || "Can't join this tricycle"}</Text>
          <Text style={styles.stateBody}>{scanError?.message || "This QR code couldn't be checked."}</Text>
          <View style={styles.stateActions}>
            {code !== 'invalid_qr' ? (
              <Button label="Check Again" icon={RefreshCw} variant="outline" onPress={refreshScan} loading={isResolving} />
            ) : null}
            <Button label="Scan Another QR" icon={ScanLine} onPress={openScanner} />
          </View>
        </View>
      </View>
    );
  }

  const t = scan.tricycle;
  const ride = scan.ride;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Scan to Ride" onBack={closeQr} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Tricycle — as resolved by the server */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIcon}>
            <TricycleIcon size={26} color={COLORS.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.plate}>{t.plate_number}</Text>
            <Text style={styles.vehicle} numberOfLines={1}>{describeTricycle(t)}</Text>
          </View>
          {t.sticker_number ? (
            <View style={styles.stickerCol}>
              <Text style={styles.stickerLabel}>Sticker</Text>
              <Text style={styles.stickerValue}>{t.sticker_number}</Text>
            </View>
          ) : null}
        </View>

        {/* Availability + seats — same seat bar as the driver's Walk-in Ride screen */}
        <View style={styles.seatsBlock}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: canJoin ? COLORS.success : COLORS.textMuted }]} />
            <Text style={[styles.eyebrow, canJoin ? styles.statusTextOk : styles.statusTextMuted]}>
              {canJoin
                ? ride.state === 'boarding' ? 'Passengers are currently boarding' : 'Available'
                : REASON_TITLES[ride.reason || ''] || 'Not taking passengers right now'}
            </Text>
          </View>
          {ride.passenger_capacity ? (
            <>
              <Text style={styles.seatsLine}>
                {ride.seats_available ?? 0}
                <Text style={styles.seatsOf}> of {ride.passenger_capacity} seats free</Text>
              </Text>
              <View style={styles.seatBar}>
                {Array.from({ length: ride.passenger_capacity }).map((_, i) => (
                  <View key={i} style={[styles.seatSeg, i < ride.seats_used && styles.seatSegFilled]} />
                ))}
              </View>
            </>
          ) : null}
        </View>
        {!canJoin && ride.reason_message ? <Text style={styles.reasonText}>{ride.reason_message}</Text> : null}

        {!canJoin ? (
          <View style={styles.inlineActions}>
            <Button label="Check Again" icon={RefreshCw} variant="outline" onPress={refreshScan} loading={isResolving} />
            <Button label="Scan Another QR" icon={ScanLine} variant="ghost" onPress={openScanner} />
          </View>
        ) : (
          <>
            {/* Trip — the server sets the pick-up; the passenger picks the destination */}
            <Text style={styles.sectionLabel}>Your trip</Text>
            <View style={styles.group}>
              <View style={styles.routeRow}>
                <View style={styles.routeMarkerCol}>
                  <View style={styles.pickupDot} />
                </View>
                <View style={styles.routeTextCol}>
                  <Text style={styles.caption}>Pick-up</Text>
                  <Text style={styles.value} numberOfLines={2}>{pickupLabel}</Text>
                </View>
              </View>

              <View style={styles.routeConnector} />

              <TouchableOpacity
                style={styles.routeRow}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Choose your destination"
              >
                <View style={styles.routeMarkerCol}>
                  <MapPin size={16} color={COLORS.danger} />
                </View>
                <View style={styles.routeTextCol}>
                  <Text style={styles.caption}>Destination</Text>
                  <Text style={[styles.value, !destination && styles.placeholder]} numberOfLines={2}>
                    {destination ? destination.name : 'Where are you going?'}
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <View style={styles.groupDivider} />

              <View style={styles.partyRow}>
                <View style={styles.flex}>
                  <Text style={styles.value}>Passengers</Text>
                  <Text style={styles.caption}>Including you · up to {maxParty}</Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepBtn, partySize <= 1 && styles.stepBtnDisabled]}
                    onPress={() => setPartySize((n) => Math.max(1, n - 1))}
                    disabled={partySize <= 1}
                    accessibilityLabel="Fewer passengers"
                  >
                    <Minus size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{partySize}</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, partySize >= maxParty && styles.stepBtnDisabled]}
                    onPress={() => setPartySize((n) => Math.min(maxParty, n + 1))}
                    disabled={partySize >= maxParty}
                    accessibilityLabel="More passengers"
                  >
                    <Plus size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Fare — exactly as quoted by the server */}
            <Text style={styles.sectionLabel}>Fare</Text>
            <View style={styles.group}>
              {!destination ? (
                <Text style={styles.fareHint}>Choose a destination to see your fare.</Text>
              ) : isQuoting || isLocating ? (
                <View style={styles.quoteLoading}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.fareHint}>Calculating your fare…</Text>
                </View>
              ) : locationError ? (
                <Text style={styles.errorText}>{locationError}</Text>
              ) : quoteError ? (
                <Text style={styles.errorText}>{quoteError.message}</Text>
              ) : quote ? (
                <>
                  <FareLine label="Distance" value={`${quote.distance_km.toFixed(1)} km${quote.distance_source === 'fallback' ? ' (est.)' : ''}`} />
                  <FareLine label="Fare per passenger" value={formatPeso(quote.fare_per_passenger)} />
                  <FareLine label="Passengers" value={`× ${quote.party_size}`} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total fare</Text>
                    <Text style={styles.totalValue}>{formatPeso(quote.fare_amount)}</Text>
                  </View>
                </>
              ) : null}
            </View>
            {quote ? <Text style={styles.fareNote}>Pay the driver in cash when you're dropped off.</Text> : null}
          </>
        )}
      </ScrollView>

      {canJoin && (
        <View style={styles.footer}>
          {joinError ? <Text style={[styles.errorText, styles.footerError]}>{joinError.message}</Text> : null}
          <View style={styles.footerRow}>
            <View style={styles.flex}>
              <Text style={styles.caption}>Total fare</Text>
              <Text style={styles.footerAmount}>{quote ? formatPeso(quote.fare_amount) : '—'}</Text>
            </View>
            <Button
              label="Join Ride"
              onPress={joinRide}
              loading={isJoining}
              disabled={!quote || isQuoting}
              fullWidth={false}
              style={styles.joinBtn}
            />
          </View>
        </View>
      )}

      <DestinationPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(dest) => { setDestination(dest); setShowPicker(false); }}
        currentLocation={currentLat != null && currentLng != null ? { name: 'Current location', lat: currentLat, lng: currentLng } : undefined}
      />
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
  // Flat page: white surface, sections separated by spacing and hairline dividers — no boxed cards.
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md + 4, paddingBottom: SPACING.xl, gap: SPACING.sm + 4 },
  flex: { flex: 1 },

  // Tricycle summary
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  vehicleIcon: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  plate: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary, letterSpacing: 0.3 },
  vehicle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 2 },
  stickerCol: { alignItems: 'flex-end', paddingLeft: SPACING.md, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  stickerLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  stickerValue: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary, marginTop: 2 },

  seatsBlock: { gap: 6, marginTop: SPACING.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { ...TYPOGRAPHY.label },
  seatsLine: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },
  seatsOf: { ...TYPOGRAPHY.h3, color: COLORS.textSecondary },
  seatBar: { flexDirection: 'row', gap: 4, marginTop: 2 },
  seatSeg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceInput },
  seatSegFilled: { backgroundColor: COLORS.primary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full },
  statusPillOk: { backgroundColor: COLORS.successLight },
  statusPillMuted: { backgroundColor: COLORS.surfaceInput },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { ...TYPOGRAPHY.caption, fontWeight: '600' },
  statusTextOk: { color: COLORS.emerald },
  statusTextMuted: { color: COLORS.textPrimary },
  reasonText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  inlineActions: { gap: SPACING.sm, marginTop: SPACING.sm },

  // Grouped sections
  sectionLabel: {
    ...TYPOGRAPHY.label, color: COLORS.textSecondary,
    marginTop: SPACING.md, paddingTop: SPACING.md + 4,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  group: {},
  groupDivider: { height: 1, backgroundColor: COLORS.borderLight },

  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  routeMarkerCol: { width: 20, alignItems: 'center' },
  pickupDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 3, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  routeConnector: { width: 1.5, height: 10, backgroundColor: COLORS.border, marginLeft: 9.25, marginVertical: -8 },
  routeTextCol: { flex: 1, paddingVertical: SPACING.sm },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  value: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary, marginTop: 2 },
  placeholder: { color: COLORS.textMuted, fontWeight: '400' },

  partyRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  stepBtnDisabled: { opacity: 0.35 },
  stepValue: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, minWidth: 18, textAlign: 'center' },

  // Fare
  fareHint: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, paddingVertical: SPACING.sm + 4 },
  quoteLoading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  fareLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  fareLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  fareValue: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderLight, marginTop: SPACING.xs, paddingVertical: SPACING.sm + 2 },
  totalLabel: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary },
  totalValue: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  fareNote: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  errorText: { ...TYPOGRAPHY.bodySmall, color: COLORS.dangerDark, paddingVertical: SPACING.sm },

  // Footer — total on the left, the one action on the right
  footer: { paddingHorizontal: SPACING.md + 4, paddingTop: SPACING.sm + 4, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background, gap: SPACING.xs },
  footerError: { textAlign: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  footerAmount: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },
  joinBtn: { minWidth: 168 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  centerStateText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.dangerLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  stateTitle: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, textAlign: 'center' },
  stateBody: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center' },
  stateActions: { alignSelf: 'stretch', gap: SPACING.sm, marginTop: SPACING.md },
});
