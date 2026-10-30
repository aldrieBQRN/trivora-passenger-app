import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Easing } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import RouteSummaryStrip from '../components/RouteSummaryStrip';
import Svg, { Defs, LinearGradient, Stop, Path, Line } from 'react-native-svg';
import { X, RotateCw, AlertCircle, MapPin } from 'lucide-react-native';

/** How far each dispatch round reaches — shown to the passenger in plain words. */
const ROUND_RADIUS: Record<number, string> = { 1: '500 m', 2: '1 km', 3: '2 km' };
const ROUND_COUNT = 3;
/** Radar: a disk with a 60° beam sweeping around the logo, one turn every SWEEP_MS. */
const RADAR_SIZE = 150;
const SWEEP_MS = 2600;
const R = RADAR_SIZE / 2;
// Beam wedge: leading edge straight up from the centre, trailing edge 60° counter-clockwise behind it
// (the disk rotates clockwise, so the up edge leads).
const BEAM_TRAIL = { x: R + R * Math.cos((-150 * Math.PI) / 180), y: R + R * Math.sin((-150 * Math.PI) / 180) };
const BEAM_PATH = `M${R} ${R} L${R} 0 A${R} ${R} 0 0 0 ${BEAM_TRAIL.x} ${BEAM_TRAIL.y} Z`;

/**
 * The searching radar, as its own memoized component with no props: the screen re-renders every
 * second (countdown) and when its title/status text change ("Offers Sent to Drivers"), and those
 * re-renders re-applied the beam's style over the running native rotation, freezing it. Isolated
 * here, nothing ever re-renders it, so the rotation runs untouched for as long as it's mounted.
 */
const RadarSweep = React.memo(function RadarSweep() {
  const sweep = useRef(new Animated.Value(0)).current;
  const sweepRotate = useRef(sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })).current;

  // Keeps turning for as long as the radar is shown: until a driver accepts (the screen moves on)
  // or the search runs out (No Drivers Available unmounts it). JS-driven and restarted turn by turn
  // rather than a native-driver Animated.loop, which got cut off when the screen around it updated.
  useEffect(() => {
    let running = true;
    let current: Animated.CompositeAnimation | null = null;
    const turn = () => {
      if (!running) return;
      sweep.setValue(0);
      current = Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.linear, useNativeDriver: false });
      // Next turn whether this one finished or was interrupted; only unmounting (running = false) ends it.
      current.start(() => turn());
    };
    turn();
    return () => {
      running = false;
      current?.stop();
    };
  }, [sweep]);

  // Static disk + inner ring, with the beam sweeping around the logo.
  return (
    <View style={styles.radarContainer}>
      <View style={styles.radarDisk} pointerEvents="none">
        <View style={styles.radarInnerRing} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.radarBeam,
          { transform: [{ rotate: sweepRotate }] },
        ]}
      >
        <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
          <Defs>
            {/* Strongest at the leading edge, fading toward the trailing edge */}
            <LinearGradient id="beamFade" gradientUnits="userSpaceOnUse" x1={R} y1={0} x2={BEAM_TRAIL.x} y2={BEAM_TRAIL.y}>
              <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.35} />
              <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={BEAM_PATH} fill="url(#beamFade)" />
          <Line x1={R} y1={R} x2={R} y2={0} stroke={COLORS.primary} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Animated.View>

      {/* Trivora emblem on a white circle (the PNG has a white margin around the mark) */}
      <View style={styles.centerIconCircle}>
        <Image
          source={require('../../assets/branding/emblem-logo.png')}
          style={styles.centerLogo}
          resizeMode="contain"
          accessibilityLabel="Trivora"
        />
      </View>
    </View>
  );
});

interface SearchingDriversScreenProps {
  /** Status-bar and navigation-bar heights: this page pads them itself, so its white background
   * runs under both instead of the app wrapper's padding band. */
  topInset?: number;
  bottomInset?: number;
}

export default function SearchingDriversScreen({ topInset = 0, bottomInset = 0 }: SearchingDriversScreenProps) {
  const insetStyle = { paddingTop: SPACING.xl + topInset, paddingBottom: SPACING.xl + bottomInset };
  const {
    cancelBooking,
    searchCountdown,
    searchStatusText,
    dispatchState,
    isNoDriverFound,
    dispatchRound,
    retryBooking,
    dismissNoDriver,
    pickup,
    dropoff,
    fareEstimate,
    paymentMethod,
    pickupMode,
  } = useBooking();

  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Cancelling waits for the server, so show it and block repeat taps meanwhile.
  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelBooking();
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await retryBooking();
    } finally {
      setIsRetrying(false);
    }
  };

  const passengerLabel = `${fareEstimate.passengerCount} ${fareEstimate.passengerCount === 1 ? 'passenger' : 'passengers'}`;
  const paymentLabel = paymentMethod === 'gcash' ? 'GCash' : 'Cash';

  // The booked trip, so the passenger can check it while waiting (and see it's kept if no one accepts).
  const tripCard = (title: string) => (
    <View style={styles.tripCard}>
      <Text style={styles.tripCardTitle}>{title}</Text>
      <RouteSummaryStrip variant="readonly" pickupLabel={pickup.name} pickupIsCurrent={pickupMode === 'current_location'} dropoffLabel={dropoff.name} />
      <View style={styles.fareSummaryRow}>
        <Text style={styles.fareSummaryLabel}>{passengerLabel} · {paymentLabel}</Text>
        <Text style={styles.fareSummaryValue}>₱{fareEstimate.total.toFixed(2)}</Text>
      </View>
    </View>
  );

  if (isNoDriverFound) {
    return (
      <View style={[styles.container, insetStyle]}>
        <View style={styles.header}>
          <View style={styles.noDriverIconCircle}>
            <AlertCircle size={36} color={COLORS.amber} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>No Drivers Available</Text>
          <Text style={styles.subtitle}>
            No drivers are free near you right now. Your trip is saved, so you can try again.
          </Text>
        </View>

        {tripCard('Your trip')}

        {/* Actions */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, isRetrying && styles.buttonDisabled]}
            onPress={handleRetry}
            disabled={isRetrying || isCancelling}
            activeOpacity={0.8}
          >
            {isRetrying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <RotateCw size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.primaryButtonText}>Try Searching Again</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={dismissNoDriver}
            disabled={isRetrying || isCancelling}
            activeOpacity={0.8}
          >
            <MapPin size={18} color={COLORS.primary} strokeWidth={2.2} />
            <Text style={styles.secondaryButtonText}>Change Trip Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelTextButton}
            onPress={handleCancel}
            disabled={isRetrying || isCancelling}
            activeOpacity={0.7}
          >
            {isCancelling ? (
              <ActivityIndicator color={COLORS.textSecondary} size="small" />
            ) : (
              <Text style={styles.cancelTextButtonText}>Cancel and Return Home</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const minutes = Math.floor(searchCountdown / 60);
  const seconds = searchCountdown % 60;
  // A countdown for the current search round — not an estimate of when a driver will accept.
  const roundTimeLeft = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  const round = Math.min(Math.max(dispatchRound || 1, 1), ROUND_COUNT);

  return (
    <View style={[styles.container, insetStyle]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {dispatchState === 'driver_found' ? 'Offers Sent to Drivers' : 'Searching for Drivers'}
        </Text>
        <Text style={styles.subtitle}>{searchStatusText}</Text>

        {/* Search progress: one dot per round, filled up to the current one */}
        <View style={styles.progressRow} accessibilityLabel={`Search step ${round} of ${ROUND_COUNT}`}>
          {Array.from({ length: ROUND_COUNT }, (_, i) => (
            <View key={i} style={[styles.progressDot, i < round && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.progressCaption}>Looking for drivers within {ROUND_RADIUS[round]}</Text>
      </View>

      <RadarSweep />

      {tripCard('Your trip')}

      {/* Bottom: round timer, what's happening, and a calm cancel */}
      <View style={styles.bottomContainer}>
        <Text style={styles.helperText}>
          We're sending your request to nearby tricycle drivers · {roundTimeLeft} left in this round
        </Text>

        <TouchableOpacity
          style={[styles.cancelButton, isCancelling && styles.buttonDisabled]}
          onPress={handleCancel}
          disabled={isCancelling}
          activeOpacity={0.8}
        >
          {isCancelling ? (
            <>
              <ActivityIndicator color={COLORS.textSecondary} size="small" />
              <Text style={styles.cancelButtonText}>Cancelling...</Text>
            </>
          ) : (
            <>
              <X size={18} color={COLORS.textSecondary} strokeWidth={2.4} />
              <Text style={styles.cancelButtonText}>Cancel request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  noDriverIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.amberLight,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SPACING.md,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  progressCaption: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 170,
  },
  radarDisk: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: R,
    backgroundColor: 'rgba(24, 43, 98, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(24, 43, 98, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInnerRing: {
    width: RADAR_SIZE * 0.66,
    height: RADAR_SIZE * 0.66,
    borderRadius: (RADAR_SIZE * 0.66) / 2,
    borderWidth: 1,
    borderColor: 'rgba(24, 43, 98, 0.12)',
  },
  radarBeam: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
  },
  centerIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  centerLogo: {
    width: 64,
    height: 64,
  },
  tripCard: {
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + 4,
    paddingBottom: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  tripCardTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  fareSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  fareSummaryLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  fareSummaryValue: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    gap: SPACING.sm,
  },
  helperText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  primaryButton: {
    width: '100%',
    height: BUTTONS.touchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    height: BUTTONS.touchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelTextButton: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  cancelTextButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  // Outlined and neutral: easy to find, without being the loudest thing on the screen.
  cancelButton: {
    width: '100%',
    height: BUTTONS.touchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
