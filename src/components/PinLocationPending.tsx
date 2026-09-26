import React from 'react';
import { Modal, TouchableOpacity, View, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import LocationPendingView from './LocationPendingView';
import { COLORS, SPACING } from '../constants/theme';

interface PinLocationPendingProps {
  isLocating: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

/** Shown by Pin Pickup Location instead of the map until a REAL device position is known —
 * never a guessed/default coordinate. Reuses the app's existing LocationPendingView. */
export default function PinLocationPending({ isLocating, error, onRetry, onClose }: PinLocationPendingProps) {
  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <LocationPendingView isLocating={isLocating} error={error} onRetry={onRetry} />
        <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close">
          <X size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  close: { position: 'absolute', top: SPACING.xl, right: SPACING.md, padding: SPACING.sm },
});
