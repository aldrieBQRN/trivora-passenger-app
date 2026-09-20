import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS } from '../constants/theme';

export type AvatarTone = 'driver' | 'passenger' | 'inverse';

interface AvatarProps {
  name: string;
  size?: number;
  tone?: AvatarTone;
  /** A real uploaded profile photo URL. When present, it replaces the initials design entirely;
   * when absent/null, the existing default avatar renders exactly as before. */
  imageUri?: string | null;
  style?: ViewStyle;
}

const TONE_STYLES: Record<AvatarTone, { bg: string; text: string }> = {
  driver: { bg: COLORS.primary, text: COLORS.textInverse },
  passenger: { bg: COLORS.primaryTint, text: COLORS.primary },
  inverse: { bg: 'rgba(255,255,255,0.16)', text: COLORS.textInverse },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Initials-based default avatar — the same design as the Driver app's Avatar component
 * (identical shape/typography/tone logic, using this app's own theme tokens), used as the one
 * fallback appearance wherever a profile photo isn't available, across both apps. Deliberately
 * typographic (no illustration) so it reads as a commercial product rather than a decorated
 * mockup. `tone` reflects who is being depicted — "driver" for the assigned driver, "passenger"
 * for the passenger (including the viewer's own profile) — not which app is rendering it.
 */
export default function Avatar({ name, size = 40, tone = 'passenger', imageUri, style }: AvatarProps) {
  const colors = TONE_STYLES[tone];

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, style] as any}
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg },
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.text, fontSize: size * 0.36 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
  },
});
