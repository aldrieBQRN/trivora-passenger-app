import React from 'react';
import { Platform } from 'react-native';
import { LocationPoint } from '../types';
import PinLocationModalWeb from './PinLocationModal.web';

// The native map (MapLibre) is only required on native: MapLibre touches native TurboModules at
// import time, which don't exist on web, so importing it eagerly would crash the web build.
const PinLocationModalNative: typeof import('./PinLocationModal.native').default | null =
  Platform.OS === 'web' ? null : require('./PinLocationModal.native').default;

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
  return PinLocationModalNative ? <PinLocationModalNative {...props} /> : null;
}
