import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { MapPin, SignalLow, CheckCircle2, XCircle, Home, Star } from 'lucide-react-native';
import { useBooking } from '../context/BookingContext';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useQrRide } from '../context/QrRideContext';
import TrivoraMap from '../components/TrivoraMap';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { fetchRoute, RouteCoordinate, RouteSource } from '../services/routingService';
import { describeTricycle, formatPeso } from '../utils/qrRide';
import TricycleIcon from '../components/icons/TricycleIcon';
import { QrActiveRide } from '../types';

interface QrRideScreenProps {
  topInset?: number;
}

/** Re-route (display only) once the tricycle has moved this far from the last route origin. */
const REROUTE_METERS = 60;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function secondsAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 1000)) : null;
}

function agoLabel(seconds: number | null): string {
  if (seconds == null) return 'no signal yet';
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

/**
 * The passenger's own QR ride: joined and waiting for the driver's Start Ride, riding (the
 * tricycle's live GPS — shared by everyone aboard — routed to THIS passenger's destination),
 * then dropped off or cancelled. Only this passenger's trip is shown; nothing about the others.
 */
export default function QrRideScreen({ topInset = 0 }: QrRideScreenProps) {
  const { ride } = useQrRide();
  return ride ? <QrRideView ride={ride} topInset={topInset} /> : null;
}

function QrRideView({ ride, topInset }: { ride: QrActiveRide; topInset: number }) {
  const { leaveRide, isLeaving, finishRide } = useQrRide();
  const { startRatingBooking } = useBooking();
  const { showToast } = useToast();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [route, setRoute] = useState<{ coords: RouteCoordinate[]; source: RouteSource; km: number } | null>(null);
  const routeOriginRef = useRef<{ lat: number; lng: number } | null>(null);

  const { booking, tricycle, driver_location: gps } = ride;
  const status = booking.status;
  const isWaiting = status === 'accepted';
  const isRiding = status === 'in_transit';
  const isDone = status === 'completed';
  const isCancelled = status === 'cancelled';

  const pickupPoint = { name: booking.pickup.name, lat: booking.pickup.lat, lng: booking.pickup.lng };
  const dropoffPoint = { name: booking.dropoff.name, lat: booking.dropoff.lat, lng: booking.dropoff.lng };
  const driverLocation = gps ? { lat: gps.lat, lng: gps.lng, heading: gps.heading_deg ?? 0 } : null;
  const gpsAge = secondsAgo(gps?.last_updated_at ?? null);

  // Display-only route: from the tricycle's real position (or the pick-up while it has none) to
  // this passenger's destination. Fares never depend on it — they were fixed by the server quote.
  const origin = isRiding && driverLocation ? driverLocation : pickupPoint;
  useEffect(() => {
    if (isDone || isCancelled) return;
    const last = routeOriginRef.current;
    if (last && route && haversineMeters(last, origin) < REROUTE_METERS) return;
    routeOriginRef.current = { lat: origin.lat, lng: origin.lng };
    let cancelled = false;
    fetchRoute({ lat: origin.lat, lng: origin.lng }, { lat: dropoffPoint.lat, lng: dropoffPoint.lng }).then((r) => {
      if (!cancelled) setRoute({ coords: r.coordinates, source: r.source, km: r.distanceKm });
    });
    return () => { cancelled = true; };
  }, [origin.lat, origin.lng, dropoffPoint.lat, dropoffPoint.lng, isDone, isCancelled]);

  // After drop-off: the whole trip taken, pick-up -> destination (display only).
  const [tripRoute, setTripRoute] = useState<{ coords: RouteCoordinate[]; source: RouteSource } | null>(null);
  useEffect(() => {
    if (!isDone) return;
    let cancelled = false;
    fetchRoute({ lat: pickupPoint.lat, lng: pickupPoint.lng }, { lat: dropoffPoint.lat, lng: dropoffPoint.lng }).then((r) => {
      if (!cancelled) setTripRoute({ coords: r.coordinates, source: r.source });
    });
    return () => { cancelled = true; };
  }, [isDone, pickupPoint.lat, pickupPoint.lng, dropoffPoint.lat, dropoffPoint.lng]);
  const mapRoute = isDone ? tripRoute : isCancelled ? null : route;

  const cancelledMessage =
    booking.cancelled_by === 'driver' ? 'The driver removed you from this ride before it started.'
      : booking.cancelled_by === 'system' ? 'This ride expired before the driver started it.'
      : 'You left this ride before it started.';

  // One headline for the current state — the only place the status is stated.
  const status_ = useMemo(() => {
    if (isWaiting) return { eyebrow: "You're on board", title: 'Waiting for the driver to start', body: 'The trip begins once everyone is aboard.', tone: 'neutral' as const };
    if (isRiding) return { eyebrow: 'Ride in progress', title: `On the way to ${booking.dropoff.name}`, body: 'The driver will drop you off at your destination.', tone: 'active' as const };
    if (isDone) return { eyebrow: 'Dropped off', title: `You've arrived at ${booking.dropoff.name}`, body: `Pay ${formatPeso(booking.fare_amount)} to the driver in cash. This trip is saved in your ride history.`, tone: 'success' as const };
    return { eyebrow: 'Ride cancelled', title: 'This ride was cancelled', body: cancelledMessage, tone: 'danger' as const };
  }, [isWaiting, isRiding, isDone, booking.dropoff.name, booking.fare_amount, cancelledMessage]);

  // Rate this walk-in trip on the normal Rate screen (same rating API as booked rides). The QR
  // flow is closed first so the app shows that screen; the booking id is the passenger's own.
  const handleRate = () => {
    if (booking.booking_id == null) {
      finishRide();
      return;
    }
    startRatingBooking(booking.booking_id, {
      name: ride.driver?.first_name || 'Your driver',
      avatarUrl: ride.driver?.profile_photo_url || undefined,
      plateNumber: tricycle?.plate_number,
      model: [tricycle?.make, tricycle?.model].filter(Boolean).join(' ') || undefined,
    });
    finishRide();
  };

  const handleLeave = async () => {
    const ok = await leaveRide();
    setConfirmLeave(false);
    if (ok) showToast('You left the ride.', 'info');
  };

  return (
    <View style={styles.container}>
      <TrivoraMap
        pickup={pickupPoint}
        dropoff={dropoffPoint}
        driverLocation={isDone || isCancelled ? null : driverLocation}
        routeCoordinates={mapRoute?.coords ?? []}
        routeSource={mapRoute?.source ?? 'fallback'}
        rideState={isRiding ? 'in_transit' : 'accepted'}
        showRouteBadge={false}
        showCompass={isRiding}
        topInset={topInset + 10}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.sheet} onLayout={(e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height)}>
        <View style={styles.handle} />

        {/* Status — the one headline for where this ride stands */}
        <View style={styles.statusBlock}>
          <View style={styles.eyebrowRow}>
            {isDone ? (
              <CheckCircle2 size={14} color={COLORS.success} />
            ) : isCancelled ? (
              <XCircle size={14} color={COLORS.dangerDark} />
            ) : (
              <View style={[styles.liveDot, isRiding && styles.liveDotActive]} />
            )}
            <Text style={[
              styles.eyebrow,
              status_.tone === 'success' && styles.eyebrowSuccess,
              status_.tone === 'danger' && styles.eyebrowDanger,
              status_.tone === 'active' && styles.eyebrowActive,
            ]}>
              {status_.eyebrow}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{status_.title}</Text>
          <Text style={styles.body}>{status_.body}</Text>
        </View>

        {(isWaiting || isRiding) && (!gps || !gps.is_fresh) && (
          <View style={styles.gpsRow}>
            <SignalLow size={14} color={COLORS.warning} />
            <Text style={styles.gpsText}>
              {gps ? `Tricycle GPS signal lost · last update ${agoLabel(gpsAge)}` : "Waiting for the tricycle's GPS signal"}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Tricycle */}
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIcon}>
            <TricycleIcon size={22} color={COLORS.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.plate}>{tricycle?.plate_number ?? 'Tricycle'}</Text>
            <Text style={styles.vehicle} numberOfLines={1}>{describeTricycle(tricycle)}</Text>
          </View>
          {tricycle?.sticker_number ? (
            <View style={styles.stickerCol}>
              <Text style={styles.statLabel}>Sticker</Text>
              <Text style={styles.stickerValue}>{tricycle.sticker_number}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Destination */}
        <View style={styles.destRow}>
          <MapPin size={16} color={COLORS.danger} />
          <View style={styles.flex}>
            <Text style={styles.statLabel}>Destination</Text>
            <Text style={styles.destText} numberOfLines={1}>{booking.dropoff.name}</Text>
          </View>
          {isRiding && route ? <Text style={styles.destMeta}>{route.km.toFixed(1)} km left</Text> : null}
        </View>

        {/* Trip summary — three plain figures, the fare emphasised */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Passengers</Text>
            <Text style={styles.statValue}>{booking.party_size}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{booking.distance_km.toFixed(1)} km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.stat, styles.statEnd]}>
            <Text style={styles.statLabel}>{isDone ? 'Paid in cash' : 'Cash fare'}</Text>
            <Text style={styles.fareValue}>{formatPeso(booking.fare_amount)}</Text>
          </View>
        </View>

        {isWaiting && (
          <Button label="Leave Ride" variant="dangerOutline" onPress={() => setConfirmLeave(true)} loading={isLeaving} />
        )}
        {isDone && (
          <View style={styles.doneActions}>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={finishRide}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Home size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.flex}>
              <Button label="Rate" icon={Star} onPress={handleRate} />
            </View>
          </View>
        )}
        {isCancelled && <Button label="Back to Home" onPress={finishRide} />}
      </View>

      <ConfirmModal
        visible={confirmLeave}
        title="Leave this ride?"
        message="You'll give up your seat in this tricycle. You can scan again if there's still room."
        confirmLabel="Leave Ride"
        cancelLabel="Stay"
        loading={isLeaving}
        onConfirm={handleLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSubtle },
  flex: { flex: 1 },
  doneActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  homeBtn: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm + 2, paddingBottom: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sheet,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  divider: { height: 1, backgroundColor: COLORS.borderLight },

  // Status
  statusBlock: { gap: 4 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  liveDotActive: { backgroundColor: COLORS.success },
  eyebrow: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },
  eyebrowActive: { color: COLORS.emerald },
  eyebrowSuccess: { color: COLORS.emerald },
  eyebrowDanger: { color: COLORS.dangerDark },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -SPACING.xs },
  gpsText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, flex: 1 },

  // Tricycle
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  plate: { ...TYPOGRAPHY.h3, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.3 },
  vehicle: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 1 },
  stickerCol: { alignItems: 'flex-end' },
  stickerValue: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary, marginTop: 2 },

  // Destination + summary
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destText: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary, marginTop: 2 },
  destMeta: { ...TYPOGRAPHY.caption, fontWeight: '600', color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1 },
  statEnd: { alignItems: 'flex-end' },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.md },
  statLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  statValue: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary, marginTop: 3 },
  fareValue: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, marginTop: 1 },
});
