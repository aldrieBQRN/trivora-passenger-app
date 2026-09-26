import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import FloatingIconButton from './FloatingIconButton';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Optional single right-side action (e.g. "Add") — omitted entirely unless both are provided. */
  rightIcon?: LucideIcon;
  onRightPress?: () => void;
}

/**
 * Plain, title-only header for inner/secondary pages (Ride History, Saved Places, etc.) —
 * ported from the Driver app's ScreenHeader "solid" variant so both apps' inner pages share the
 * same height, padding, typography, and back-navigation treatment. Deliberately has no subtitle
 * or profile content — that's Home's job, not a secondary page's; the optional right icon covers
 * the rare case of a secondary page needing one action (e.g. Saved Places' "Add").
 */
export default function ScreenHeader({ title, onBack, rightIcon: RightIcon, onRightPress }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {onBack && (
        <FloatingIconButton onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </FloatingIconButton>
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {RightIcon && onRightPress && (
        <FloatingIconButton onPress={onRightPress} accessibilityLabel="Action">
          <RightIcon size={18} color={COLORS.primary} />
        </FloatingIconButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  title: {
    flex: 1,
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
});
