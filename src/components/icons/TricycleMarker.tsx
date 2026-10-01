import React from 'react';
import { View, StyleSheet, Text, ViewStyle, Image } from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import { TRICYCLE_MARKER_IMAGE } from '../../constants/mapPins';

interface TricycleMarkerProps {
  size?: number;
  heading?: number;
  showEta?: boolean;
  etaText?: string;
  isDriver?: boolean;
  style?: ViewStyle;
}

/**
 * Premium map marker for Tricycle vehicles using the official tricycle WebP asset.
 */
export default function TricycleMarker({
  size = 45,
  heading = 0,
  showEta = false,
  etaText = '3 MIN',
  isDriver = false,
  style,
}: TricycleMarkerProps) {
  const height = Math.round(size * (2 / 3));

  return (
    <View style={[styles.container, style]}>
      {/* Optional ETA Floating Pill above vehicle */}
      {showEta && (
        <View style={styles.etaPill}>
          <Text style={styles.etaText}>{etaText}</Text>
        </View>
      )}

      {/* Main Vehicle Marker */}
      <View
        style={[
          styles.markerWrapper,
          { transform: [{ rotate: `${heading || 0}deg` }] },
        ]}
      >
        <Image
          source={TRICYCLE_MARKER_IMAGE}
          style={{ width: size, height }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
