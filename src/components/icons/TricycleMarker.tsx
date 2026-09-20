import React from 'react';
import { View, StyleSheet, Text, ViewStyle } from 'react-native';
import TricycleIcon from './TricycleIcon';
import { COLORS, SHADOWS } from '../../constants/theme';

interface TricycleMarkerProps {
  size?: number;
  heading?: number;
  showEta?: boolean;
  etaText?: string;
  isDriver?: boolean;
  style?: ViewStyle;
}

/**
 * Premium map marker for Tricycle vehicles.
 * Renders a crisp elevated white disc with border, directional badge, and TricycleIcon.
 */
export default function TricycleMarker({
  size = 38,
  heading = 0,
  showEta = false,
  etaText = '3 MIN',
  isDriver = false,
  style,
}: TricycleMarkerProps) {
  const iconSize = Math.round(size * 0.62);

  return (
    <View style={[styles.container, style]}>
      {/* Optional ETA Floating Pill above vehicle */}
      {showEta && (
        <View style={styles.etaPill}>
          <Text style={styles.etaText}>{etaText}</Text>
        </View>
      )}

      {/* Main Elevated Vehicle Disc */}
      <View
        style={[
          styles.markerBubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: isDriver ? COLORS.primary : '#CBD5E1',
          },
        ]}
      >
        <TricycleIcon
          size={iconSize}
          color={isDriver ? COLORS.primary : '#334155'}
          accentColor={isDriver ? '#3B82F6' : '#64748B'}
        />

        {/* Small Direction Arrow Notch */}
        {heading !== undefined && (
          <View
            style={[
              styles.headingDot,
              {
                backgroundColor: isDriver ? COLORS.primary : '#64748B',
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  headingDot: {
    position: 'absolute',
    top: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  etaPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 3,
    ...SHADOWS.sm,
  },
  etaText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
