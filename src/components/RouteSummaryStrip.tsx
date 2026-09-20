import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

interface RouteSummaryStripProps {
  pickupLabel: string;
  dropoffLabel: string;
  variant?: 'editable' | 'readonly';
  onPressPickup?: () => void;
  onPressDropoff?: () => void;
}

/**
 * The pickup -> dropoff line (dot, connector, pin) used everywhere the app
 * needs to remind the passenger where they're going. `editable` makes each
 * row tappable (opens the destination picker for that slot); `readonly`
 * just states the route as context on non-editing screens.
 */
export default function RouteSummaryStrip({
  pickupLabel,
  dropoffLabel,
  variant = 'readonly',
  onPressPickup,
  onPressDropoff,
}: RouteSummaryStripProps) {
  const editable = variant === 'editable';

  return (
    <View style={styles.container}>
      <View style={styles.rail}>
        <View style={styles.pickupDot} />
        <View style={styles.connector} />
        <View style={styles.dropoffPin}>
          <MapPin size={9} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.rows}>
        <TouchableOpacity
          style={styles.row}
          onPress={onPressPickup}
          activeOpacity={editable ? 0.7 : 1}
          disabled={!editable}
        >
          <View style={styles.rowTextCol}>
            <Text style={styles.rowLabel}>Pick-up</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {pickupLabel}
            </Text>
          </View>
          {editable && <ChevronRight size={14} color={COLORS.textMuted} />}
        </TouchableOpacity>

        <View style={styles.hairline} />

        <TouchableOpacity
          style={styles.row}
          onPress={onPressDropoff}
          activeOpacity={editable ? 0.7 : 1}
          disabled={!editable}
        >
          <View style={styles.rowTextCol}>
            <Text style={styles.rowLabel}>Destination</Text>
            <Text
              style={[styles.rowValue, !dropoffLabel && styles.rowValuePlaceholder]}
              numberOfLines={1}
            >
              {dropoffLabel || 'Select destination'}
            </Text>
          </View>
          {editable && <ChevronRight size={14} color={COLORS.textMuted} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    width: 16,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  pickupDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#2563EB',
  },
  connector: {
    width: 1.5,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 3,
  },
  dropoffPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 8,
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
  },
  rowValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  rowValuePlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  hairline: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
});
