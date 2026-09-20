import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Rect, Circle, G, Text as SvgText } from 'react-native-svg';

interface PaymentIconProps {
  size?: number;
  style?: ViewStyle;
}

/**
 * Authentic GCash Blue Badge Icon.
 */
export function GCashIcon({ size = 22, style }: PaymentIconProps) {
  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        {/* GCash Iconic Blue Rounded Square */}
        <Rect width="28" height="28" rx="7" fill="#005CF6" />

        {/* Stylized "G" glyph */}
        <Path
          d="M14 7 C18 7 21 10 21 14 C21 18 18 21 14 21 C10 21 7 18 7 14 C7 10 10 7 14 7 Z"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Inner G crossbar */}
        <Path
          d="M14 14 L19 14"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Signal wireless wave accents */}
        <Path
          d="M21.5 9.5 C22.8 10.8 22.8 12.8 21.5 14"
          stroke="#93C5FD"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/**
 * Authentic Philippine Cash / Peso Bill Icon with ₱ symbol.
 */
export function CashIcon({ size = 22, style }: PaymentIconProps) {
  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        {/* Bill outline */}
        <Rect
          x="2"
          y="6"
          width="24"
          height="16"
          rx="3"
          fill="#ECFDF5"
          stroke="#10B981"
          strokeWidth="1.8"
        />
        {/* Inner Guilloche ring */}
        <Circle cx="14" cy="14" r="5" fill="#D1FAE5" stroke="#059669" strokeWidth="1.2" />

        {/* Center Peso ₱ glyph */}
        <Path
          d="M12.5 11 L15 11 C16 11 16.8 11.8 16.8 12.8 C16.8 13.8 16 14.6 15 14.6 L12.5 14.6 M12.5 11 L12.5 17 M11.5 12.3 L16 12.3 M11.5 13.7 L16 13.7"
          stroke="#065F46"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Corner security dots */}
        <Circle cx="5" cy="9" r="0.8" fill="#10B981" />
        <Circle cx="23" cy="9" r="0.8" fill="#10B981" />
        <Circle cx="5" cy="19" r="0.8" fill="#10B981" />
        <Circle cx="23" cy="19" r="0.8" fill="#10B981" />
      </Svg>
    </View>
  );
}

/**
 * Modern Maya Badge Icon.
 */
export function MayaIcon({ size = 22, style }: PaymentIconProps) {
  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <Rect width="28" height="28" rx="7" fill="#0A0A0A" />
        {/* Maya geometric green gradient chevron */}
        <Path
          d="M7 19 L11 9 L14 15 L17 9 L21 19 L17.5 19 L15.5 13.5 L14 16.5 L12.5 13.5 L10.5 19 Z"
          fill="#10B981"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
