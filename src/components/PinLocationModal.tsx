import React from 'react';
import { Platform } from 'react-native';
import { LocationPoint } from '../types';
import PinLocationModalWeb from './PinLocationModal.web';
import PinLocationModalNative from './PinLocationModal.native';

export interface PinLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmPin: (location: LocationPoint) => void;
  currentPickup?: LocationPoint;
  initialLocation?: LocationPoint;
  /** 'destination' (default) shows "Set as Destination" copy; 'pickup' shows "Confirm Pick-up". */
  mode?: 'pickup' | 'destination';
  /** Overrides the confirm button's label entirely (e.g. "Save Place"). */
  confirmLabel?: string;
}

export default function PinLocationModal(props: PinLocationModalProps) {
  if (Platform.OS === 'web') {
    return <PinLocationModalWeb {...props} />;
  }
  return <PinLocationModalNative {...props} />;
}
