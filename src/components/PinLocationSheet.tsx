import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MapPin, Hand } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { LocationPoint } from '../types';
import Button from './Button';
import MapFocusButton from './MapFocusButton';

interface PinLocationSheetProps {
  pinnedLocation: LocationPoint | null;
  isResolving: boolean;
  onClose: () => void;
  onRecenter: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
  /** 'destination' (default) or 'pickup' — swaps the header/button copy accordingly. */
  mode?: 'pickup' | 'destination';
  /** Overrides the confirm button's label entirely (e.g. "Save Place") — takes precedence over mode. */
  confirmLabel?: string;
  /** How a point is picked: 'tap' the map (default), or 'drag' the map under a fixed centre pin. */
  interaction?: 'tap' | 'drag';
  /** Trip estimate for the pinned point (e.g. "1.8 km · 6 min · ₱25.00 est."), when booking. */
  estimate?: string | null;
}

/**
 * Shared chrome for the pin-drop picker: full-screen map with floating header,
 * floating focus button, and floating bottom sheet panel — matching Driver app's DestinationPinModal.
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
  interaction = 'tap',
  estimate,
}: PinLocationSheetProps) {
  const insets = useSafeAreaInsets();
  const isPickup = mode === 'pickup';
  const isDrag = interaction === 'drag';
  const target = isPickup ? 'pick-up' : 'destination';
  const [panelHeight, setPanelHeight] = useState(180);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (pinnedLocation) setMessage(null);
  }, [pinnedLocation]);

  const handleConfirm = () => {
    if (!pinnedLocation) {
      setMessage(
        isPickup
          ? 'Tap the map to set your pick-up pin.'
          : 'Tap the map where you are going to place the destination pin.'
      );
      return;
    }
    onConfirm();
  };

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Fullscreen map underneath header and panel */}
        <View style={StyleSheet.absoluteFillObject}>
          {children}
        </View>

        {/* Floating top header */}
        <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
          <View style={styles.flex}>
            <Text style={styles.title}>{isPickup ? 'Pin the pick-up' : 'Pin the destination'}</Text>
            <View style={styles.hintRow}>
              <Hand size={13} color={COLORS.textSecondary} />
              <Text style={styles.hint}>
                {isDrag ? `Move the map to set your ${target}` : `Tap the map to set your ${target}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close map"
          >
            <X size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Floating focus button placed right above bottom panel */}
        <MapFocusButton
          style={{ bottom: panelHeight + 16 }}
          onPress={onRecenter}
          accessibilityLabel={isDrag ? 'Center on the pin' : 'Focus pick-up and destination'}
          />

        {/* Floating bottom sheet panel */}
        <View
          style={[styles.panel, { paddingBottom: insets.bottom + SPACING.md }]}
          onLayout={(e: LayoutChangeEvent) => setPanelHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.destRow}>
            <MapPin
              size={18}
              color={pinnedLocation ? (isPickup ? COLORS.emerald : COLORS.danger) : COLORS.textMuted}
            />
            <View style={styles.flex}>
              <Text style={styles.label}>{isPickup ? 'PICK-UP' : 'DESTINATION'}</Text>
              {pinnedLocation ? (
                <>
                  <Text style={styles.destName} numberOfLines={2}>
                    {isResolving ? 'Resolving location...' : pinnedLocation.name || 'Selected location'}
                  </Text>
                  {/* Address only when it adds something to the name (often they're the same
                      reverse-geocoded line); raw coordinates mean nothing to a passenger. */}
                  {pinnedLocation.address && pinnedLocation.address !== pinnedLocation.name && !isResolving ? (
                    <Text style={styles.coords} numberOfLines={2}>{pinnedLocation.address}</Text>
                  ) : null}
                  {estimate && !isResolving ? <Text style={styles.estimate}>{estimate}</Text> : null}
                </>
              ) : (
                <Text style={styles.destPlaceholder}>
                  {isDrag ? `Move the map to set your ${target}` : 'No pin yet'}
                </Text>
              )}
            </View>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Button
            label={confirmLabel || (isPickup ? 'Confirm Pick-up' : 'Confirm Destination')}
            onPress={handleConfirm}
            loading={isResolving}
            disabled={!pinnedLocation || isResolving}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSubtle,
  },
  flex: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm + 2,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  title: {
    ...TYPOGRAPHY.h3,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  hint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md + 4,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.sheet,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
  },
  destName: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  destPlaceholder: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  coords: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  estimate: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 6,
  },
  message: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.dangerDark,
    marginTop: -SPACING.xs,
  },
});
