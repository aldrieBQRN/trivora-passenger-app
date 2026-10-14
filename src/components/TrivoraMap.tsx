import React from 'react';
import { Platform } from 'react-native';
import { TrivoraMapProps } from './TrivoraMap.types';

export type { TrivoraMapProps } from './TrivoraMap.types';

export default function TrivoraMap(props: TrivoraMapProps) {
  if (Platform.OS === 'web') {
    const Component = require('./TrivoraMap.web').default;
    return <Component {...props} />;
  }
  const Component = require('./TrivoraMap.native').default;
  return <Component {...props} />;
}
