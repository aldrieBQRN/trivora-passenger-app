import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { X, MapPin, Crosshair } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { LocationPoint } from '../types';
import Button from './Button';

interface PinLocationSheetProps {
  pinnedLocation: LocationPoint;
  isResolving: boolean;
  onClose: () => void;
  onRecenter: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
  /** 'destination' (default) or 'pickup' — swaps the header/button copy accordingly. */
  mode?: 'pickup' | 'destination';
  /** Overrides the confirm button's label entirely (e.g. "Save Place") — takes precedence over mode. */
  confirmLabel?: string;
}

/**
 * Shared chrome for the pin-drop picker: header, map viewport (the actual interactive map is
 * passed in as `children` since native/web use different map libraries), and a confirm sheet
 * showing only the resolved location — this is a pure location picker, not a booking summary.
 * Route/fare/ETA/TODA-zone info belongs on the booking screens that own the booking flow (e.g.
 * DestinationRouteScreen), never here, so a destination pick doesn't imply a fare estimate.
 */
export default function PinLocationSheet({
  pinnedLocation,
  isResolving,
  onClose,
  onRecenter,
  onConfirm,
  children,
  mode = 'destination',
  confirmLabel,
}: PinLocationSheetProps) {
  const isPickup = mode === 'pickup';
  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose} activeOpacity={0.7}>
            <X size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Pin Location on Map</Text>
            <Text style={styles.headerSub}>
              {isPickup ? 'Tap anywhere to set your pick-up' : 'Tap anywhere to set your destination'}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={onRecenter} activeOpacity={0.7}>
            <Crosshair size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.mapArea}>
          {children}

          <View style={styles.tapInstructionPill} pointerEvents="none">
            <Text style={styles.tapInstructionText}>Tap the map to drop a pin</Text>
          </View>
        </View>

        <View style={styles.bottomSheet}>
          <View style={styles.locationHeaderRow}>
            <View style={[styles.pinBadgeCircle, styles.pinBadgeCircleStandard]}>
              <MapPin size={18} color="#EF4444" />
            </View>
            <View style={styles.locationMetaCol}>
              <View style={styles.titleRow}>
                <Text style={styles.pinnedTitle} numberOfLines={1}>
                  {isResolving ? 'Resolving location...' : pinnedLocation.name}
                </Text>
              </View>

              <Text style={styles.pinnedAddress} numberOfLines={2}>
                {pinnedLocation.address}
              </Text>
            </View>
          </View>

          <Button
            label={confirmLabel || (isPickup ? 'Confirm Pick-up' : 'Use This Location')}
            onPress={onConfirm}
            loading={isResolving}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 20,
    ...SHADOWS.sm,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FAF6EE',
    overflow: 'hidden',
  },
  tapInstructionPill: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...SHADOWS.md,
  },
  tapInstructionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomSheet: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.sheet,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  pinBadgeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pinBadgeCircleStandard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  locationMetaCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinnedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  pinnedAddress: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
