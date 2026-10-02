import { Dimensions } from 'react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

/**
 * OpenFreeMap vector tile styles for MapLibre Native.
 * OpenFreeMap provides free, open-source vector map tiles powered by OpenStreetMap data.
 */
export const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
export const OPENFREEMAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export type MapVariant = 'bright' | 'liberty';

export const MAP_STYLES: Record<MapVariant, string> = {
  bright: OPENFREEMAP_BRIGHT_STYLE,
  liberty: OPENFREEMAP_LIBERTY_STYLE,
};

/** 3D camera pitch for active ride tracking / navigation screens (approx 45° to 55°). */
export const ACTIVE_RIDE_PITCH = 50;

/** 2D top-down camera pitch for Home and Pin Location screens. */
export const TOP_DOWN_PITCH = 0;

export const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

/** Pin bitmaps (constants/mapPins) are 28x36dp with the tip at the bottom-center pixel. */
export const PIN_SIZE = { width: 28, height: 36 };

/** Tricycle vehicle marker display size (3:2 aspect ratio, matching the optimized 384x256 WebP asset). */
export const TRICYCLE_MARKER_SIZE = { width: 45, height: 30 };

/** The camera used to be sized by a lat/lng span (react-native-maps regions); MapLibre uses a zoom
 * level (512dp world at zoom 0). Converts the same span across the map's width (the window width
 * until the map has been measured). */
export function deltaToZoom(delta: number, widthDp?: number) {
  const width = widthDp || Dimensions.get('window').width;
  return Math.log2((360 * width) / (512 * delta));
}

/** [west, south, east, north] around the points, never degenerate (identical points would
 * otherwise zoom the camera all the way in). */
export function boundsOf(points: { lat: number; lng: number }[]): LngLatBounds {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  points.forEach((p) => {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  });
  const MIN_SPAN = 0.0005;
  if (east - west < MIN_SPAN) {
    const c = (east + west) / 2;
    west = c - MIN_SPAN / 2;
    east = c + MIN_SPAN / 2;
  }
  if (north - south < MIN_SPAN) {
    const c = (north + south) / 2;
    south = c - MIN_SPAN / 2;
    north = c + MIN_SPAN / 2;
  }
  return [west, south, east, north];
}

/** GeoJSON line for a route polyline ([lng, lat] order). */
export function routeLineFeature(coords: { lat: number; lng: number }[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords.map((c) => [c.lng, c.lat]) },
  };
}

/** Route line paint: blue for a real road route, grey [8, 6]dp dashes (in line widths) for the
 * straight-line fallback. */
export function routeLinePaint(isFallback: boolean) {
  return isFallback
    ? { 'line-color': '#94A3B8', 'line-width': 4, 'line-dasharray': [2, 1.5] }
    : { 'line-color': '#2563EB', 'line-width': 5 };
}
