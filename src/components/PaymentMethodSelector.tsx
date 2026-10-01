import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banknote, Smartphone, Check } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { PaymentMethod } from '../types';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  gcashAvailable?: boolean;
  disabledReason?: string;
}

export default function PaymentMethodSelector({
  selected,
  onSelect,
  gcashAvailable = true,
  disabledReason,
}: PaymentMethodSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Method</Text>

      {/* Cash Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          selected === 'cash' && styles.optionCardSelected,
        ]}
        onPress={() => onSelect('cash')}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected === 'cash' }}
      >
        <View style={styles.iconContainer}>
          <Banknote size={20} color={selected === 'cash' ? COLORS.primary : COLORS.textSecondary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.optionTitle, selected === 'cash' && styles.optionTitleSelected]}>
            Cash
          </Text>
          <Text style={styles.optionSubtitle}>Pay upon reaching your destination</Text>
        </View>
        <View style={[styles.radioCircle, selected === 'cash' && styles.radioCircleSelected]}>
          {selected === 'cash' && <Check size={12} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>

      {/* GCash Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          selected === 'gcash' && styles.optionCardSelected,
          !gcashAvailable && styles.optionCardDisabled,
        ]}
        onPress={() => {
          if (gcashAvailable) {
            onSelect('gcash');
          }
        }}
        disabled={!gcashAvailable}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected === 'gcash', disabled: !gcashAvailable }}
      >
        <View style={styles.iconContainer}>
          <Smartphone
            size={20}
            color={!gcashAvailable ? COLORS.textMuted : selected === 'gcash' ? COLORS.primary : COLORS.textSecondary}
          />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.gcashHeader}>
            <Text
              style={[
                styles.optionTitle,
                selected === 'gcash' && styles.optionTitleSelected,
                !gcashAvailable && styles.optionTitleDisabled,
              ]}
            >
              GCash
            </Text>
            {!gcashAvailable && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableBadgeText}>Cash Only</Text>
              </View>
            )}
          </View>
          <Text style={styles.optionSubtitle}>
            {!gcashAvailable
              ? disabledReason || 'Driver has no GCash QR configured'
              : 'Scan driver QR after reaching destination'}
          </Text>
        </View>
        <View
          style={[
            styles.radioCircle,
            selected === 'gcash' && styles.radioCircleSelected,
            !gcashAvailable && styles.radioCircleDisabled,
          ]}
        >
          {selected === 'gcash' && <Check size={12} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryTint,
  },
  optionCardDisabled: {
    backgroundColor: COLORS.surfaceInput,
    borderColor: COLORS.border,
    opacity: 0.7,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  gcashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  optionTitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  optionTitleSelected: {
    color: COLORS.primary,
  },
  optionTitleDisabled: {
    color: COLORS.textMuted,
  },
  optionSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  radioCircleSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioCircleDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
  },
  unavailableBadge: {
    backgroundColor: COLORS.surfaceInput,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unavailableBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
});
