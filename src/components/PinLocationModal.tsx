import React from 'react';
import { Platform } from 'react-native';
import { LocationPoint } from '../types';

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
    const Component = require('./PinLocationModal.web').default;
    return <Component {...props} />;
  }
  const Component = require('./PinLocationModal.native').default;
  return <Component {...props} />;
}
