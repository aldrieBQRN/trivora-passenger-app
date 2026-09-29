import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MapPin, Hand, Crosshair } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { LocationPoint } from '../types';
import Button from './Button';

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
}: PinLocationSheetProps) {
  const insets = useSafeAreaInsets();
  const isPickup = mode === 'pickup';
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
                {isPickup ? 'Tap the map to set your pick-up' : 'Tap the map to set your destination'}
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
        <TouchableOpacity
          style={[styles.floatingFocusBtn, { bottom: panelHeight + 16 }]}
          onPress={onRecenter}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Focus pick-up and destination"
        >
          <Crosshair size={20} color={COLORS.primary} />
        </TouchableOpacity>

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
                  {pinnedLocation.address ? (
                    <Text style={styles.coords} numberOfLines={2}>
                      {pinnedLocation.address} · {pinnedLocation.lat.toFixed(5)}, {pinnedLocation.lng.toFixed(5)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.destPlaceholder}>No pin yet</Text>
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
  floatingFocusBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.md,
    zIndex: 10,
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
  message: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.dangerDark,
    marginTop: -SPACING.xs,
  },
});
