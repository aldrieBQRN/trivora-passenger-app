import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { TricycleIcon } from '../components/icons';
import { X, RotateCw, AlertCircle, MapPin, ArrowRight } from 'lucide-react-native';

export default function SearchingDriversScreen() {
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
  } = useBooking();

  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isNoDriverFound) return;

    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing1, { toValue: 1.35, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseRing1, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );

    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(pulseRing2, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseRing2, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [isNoDriverFound]);

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

  if (isNoDriverFound) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.noDriverIconCircle}>
            <AlertCircle size={36} color={COLORS.amber} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>No Drivers Available</Text>
          <Text style={styles.subtitle}>
            We searched up to 2 km across 3 dispatch rounds, but no available drivers accepted your request at this time.
          </Text>
        </View>

        {/* Preserved Route & Fare Details */}
        <View style={styles.tripCard}>
          <Text style={styles.tripCardTitle}>TRIP DETAILS PRESERVED</Text>

          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <View style={styles.routeTextCol}>
              <Text style={styles.routeLabel}>Pick-up</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>{pickup.name}</Text>
            </View>
          </View>

          <View style={styles.routeDividerLine} />

          <View style={styles.routeRow}>
            <View style={styles.routeDotRed} />
            <View style={styles.routeTextCol}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>{dropoff.name}</Text>
            </View>
          </View>

          <View style={styles.fareSummaryRow}>
            <Text style={styles.fareSummaryLabel}>
              Estimated Fare ({fareEstimate.passengerCount} {fareEstimate.passengerCount === 1 ? 'passenger' : 'passengers'})
            </Text>
            <Text style={styles.fareSummaryValue}>₱{fareEstimate.total.toFixed(2)}</Text>
          </View>
        </View>

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
  const formattedTime = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {dispatchState === 'driver_found' ? 'Offers Sent to Drivers' : 'Searching for Drivers'}
        </Text>
        <Text style={styles.subtitle}>{searchStatusText}</Text>

        {/* 3-Round Expanding Radius Pills */}
        <View style={styles.roundPillsContainer}>
          <View style={[styles.roundPill, dispatchRound === 1 && styles.roundPillActive]}>
            <Text style={[styles.roundPillText, dispatchRound === 1 && styles.roundPillTextActive]}>
              R1: 500m
            </Text>
          </View>
          <View style={styles.roundPillArrow}>
            <ArrowRight size={12} color={COLORS.textMuted} />
          </View>
          <View style={[styles.roundPill, dispatchRound === 2 && styles.roundPillActive]}>
            <Text style={[styles.roundPillText, dispatchRound === 2 && styles.roundPillTextActive]}>
              R2: 1 km
            </Text>
          </View>
          <View style={styles.roundPillArrow}>
            <ArrowRight size={12} color={COLORS.textMuted} />
          </View>
          <View style={[styles.roundPill, dispatchRound === 3 && styles.roundPillActive]}>
            <Text style={[styles.roundPillText, dispatchRound === 3 && styles.roundPillTextActive]}>
              R3: 2 km
            </Text>
          </View>
        </View>
      </View>

      {/* Central Animated Concentric Radar */}
      <View style={styles.radarContainer}>
        <Animated.View style={[styles.radarOuterRing, { transform: [{ scale: pulseRing2 }] }]}>
          <View style={[styles.ringDot, { top: 18, left: '32%' }]} />
          <View style={[styles.ringDot, { bottom: 25, right: '28%' }]} />
          <View style={[styles.ringDot, { top: '50%', right: 12 }]} />
          <View style={[styles.ringDot, { top: '45%', left: 16 }]} />
        </Animated.View>

        <Animated.View style={[styles.radarMiddleRing, { transform: [{ scale: pulseRing1 }] }]} />

        <View style={styles.centerIconCircle}>
          <TricycleIcon size={34} color="#FFFFFF" accentColor="#93C5FD" roofColor="#FFFFFF" />
        </View>
      </View>

      {/* Bottom Wait Time & Action */}
      <View style={styles.bottomContainer}>
        <Text style={styles.waitLabel}>Estimated match time</Text>
        <Text style={styles.timerDisplay}>{formattedTime}</Text>
        <Text style={styles.helperText}>
          Broadcasting simultaneously to all eligible MTOP franchised tricycle drivers.
        </Text>

        <TouchableOpacity
          style={[styles.cancelButton, isCancelling && styles.buttonDisabled]}
          onPress={handleCancel}
          disabled={isCancelling}
          activeOpacity={0.8}
        >
          {isCancelling ? (
            <>
              <ActivityIndicator color={COLORS.dangerDark} size="small" />
              <Text style={styles.cancelButtonText}>Cancelling...</Text>
            </>
          ) : (
            <>
              <X size={18} color={COLORS.dangerDark} strokeWidth={2.4} />
              <Text style={styles.cancelButtonText}>Cancel Ride Request</Text>
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
  roundPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    gap: 6,
  },
  roundPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.backgroundSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roundPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roundPillText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roundPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roundPillArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
  },
  radarOuterRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(28, 43, 90, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(28, 43, 90, 0.18)',
  },
  ringDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  radarMiddleRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(28, 43, 90, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(28, 43, 90, 0.28)',
  },
  centerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  tripCard: {
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  tripCardTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
  },
  routeDividerLine: {
    width: 2,
    height: 14,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  routeTextCol: {
    flex: 1,
  },
  routeLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  routeAddress: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  fareSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
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
  waitLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  timerDisplay: {
    ...TYPOGRAPHY.display,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  helperText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
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
  cancelButton: {
    width: '100%',
    height: BUTTONS.touchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
    ...SHADOWS.sm,
  },
  cancelButtonText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.dangerDark,
  },
});
