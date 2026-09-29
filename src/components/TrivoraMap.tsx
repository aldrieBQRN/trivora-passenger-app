import React from 'react';
import { Platform } from 'react-native';
import TrivoraMapWeb from './TrivoraMap.web';
import { TrivoraMapProps } from './TrivoraMap.types';

// The native map (MapLibre) is only required on native: MapLibre touches native TurboModules at
// import time, which don't exist on web, so importing it eagerly would crash the web build.
const TrivoraMapNative: typeof import('./TrivoraMap.native').default | null =
  Platform.OS === 'web' ? null : require('./TrivoraMap.native').default;

export type { TrivoraMapProps } from './TrivoraMap.types';

export default function TrivoraMap(props: TrivoraMapProps) {
  if (Platform.OS === 'web') {
    return <TrivoraMapWeb {...props} />;
  }
  return TrivoraMapNative ? <TrivoraMapNative {...props} /> : null;
}
