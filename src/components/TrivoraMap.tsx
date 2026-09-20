import React from 'react';
import { Platform } from 'react-native';
import TrivoraMapWeb from './TrivoraMap.web';
import TrivoraMapNative from './TrivoraMap.native';
import { TrivoraMapProps } from './TrivoraMap.types';

export type { TrivoraMapProps } from './TrivoraMap.types';

export default function TrivoraMap(props: TrivoraMapProps) {
  if (Platform.OS === 'web') {
    return <TrivoraMapWeb {...props} />;
  }
  return <TrivoraMapNative {...props} />;
}
