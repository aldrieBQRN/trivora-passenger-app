import React, { ReactNode, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';

interface TabHeaderProps {
  /** Status-bar height; the navy panel runs up underneath it. */
  topInset: number;
  title: string;
  subtitle?: string;
  /** White card that straddles the panel's curved bottom edge (e.g. a filter or identity card). */
  children?: ReactNode;
  /** Shows a back button before the title (pages opened from another screen). */
  onBack?: () => void;
}

/**
 * Same component as the Driver app's TabHeader (keep the two in sync); that one reads the
 * status-bar inset itself instead of taking `topInset`, and has no `onBack` (nothing needs it yet).
 *
 * Navy tab-page header — same treatment as Home's: a brand-navy panel with rounded bottom
 * corners, white title/subtitle, and an optional card whose vertical centre sits on the panel's
 * bottom edge. Light status-bar icons while mounted (sub-pages that replace the screen unmount it).
 */
export default function TabHeader({ topInset, title, subtitle, children, onBack }: TabHeaderProps) {
  const [cardHeight, setCardHeight] = useState(0);

  return (
    <View style={[styles.wrap, { paddingTop: topInset + SPACING.sm }]}>
      <StatusBar style="light" />
      <View style={[styles.bg, { bottom: children ? cardHeight / 2 : 0 }]} pointerEvents="none" />
      <View style={[styles.titleRow, !children && styles.titleBlockAlone]}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={18} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {children ? <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
    ...SHADOWS.md,
    // No Android elevation: it would lift this layer above the title (elevation outranks render
    // order there). The iOS shadow still applies.
    elevation: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: SPACING.xs,
  },
  titleBlock: {
    flex: 1,
  },
  // Solid white on the navy panel, like Home's header buttons.
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlockAlone: {
    paddingBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textInverse,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
});
