import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { TricycleIcon } from '../components/icons';
import { X } from 'lucide-react-native';

export default function SearchingDriversScreen() {
  const { cancelBooking, searchCountdown, searchStatusText } = useBooking();

  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
  }, []);

  // searchCountdown can now reach a full 60 (real mode loops a 1-minute cycle instead of
  // freezing at 0), so this needs a real minutes:seconds split rather than a hardcoded "00:" —
  // otherwise the top of each cycle would render as the nonsensical "00:60".
  const minutes = Math.floor(searchCountdown / 60);
  const seconds = searchCountdown % 60;
  const formattedTime = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Searching for a Driver</Text>
        <Text style={styles.subtitle}>{searchStatusText}</Text>
      </View>

      {/* Central Animated Concentric Radar — the screen's one focal point */}
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
          Connecting you with a verified MTOP franchised tricycle operator.
        </Text>

        <TouchableOpacity style={styles.cancelButton} onPress={cancelBooking} activeOpacity={0.8}>
          <X size={18} color={COLORS.dangerDark} strokeWidth={2.4} />
          <Text style={styles.cancelButtonText}>Cancel Ride Request</Text>
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
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
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
