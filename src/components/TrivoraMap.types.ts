import { LocationPoint, TodaZone, RideLifecycleState, PassengerScreenState } from '../types';

export interface RouteLatLng {
  lat: number;
  lng: number;
}

export type RouteSource = 'osrm' | 'fallback';

/**
 * Single canonical prop contract for the map, shared by the web (Leaflet)
 * and native (react-native-maps) implementations. The map is presentational
 * only — it draws whatever route/markers it's given; fetching real routes
 * lives in BookingContext so screens share one fetch instead of each map
 * instance re-requesting the same data.
 */
export interface TrivoraMapProps {
  pickup?: LocationPoint;
  dropoff?: LocationPoint | null;
  driverLocation?: { lat: number; lng: number; heading: number } | null;
  activeZone?: TodaZone;
  rideState?: RideLifecycleState | PassengerScreenState;
  suggestedRouteInfo?: { distance: string; duration: string } | null;
  /** Real road-following polyline from the routing service, or a 2-point fallback. */
  routeCoordinates?: RouteLatLng[];
  /** Lets the map render a fallback route as visibly distinct from a real one. */
  routeSource?: RouteSource;
  showTodaPill?: boolean;
  showTodaPins?: boolean;
  showCompass?: boolean;
  /** The floating "Fastest/Estimated Route" distance+duration badge — defaults on for full-bleed
   * maps, but it's absolutely positioned for a tall map and needs disabling in compact/short map
   * strips (e.g. the confirm-booking screen) where it would clip or overlap other overlays. */
  showRouteBadge?: boolean;
  /** Height, in px, of any opaque/floating chrome covering the TOP of this map (status pill,
   * safe-area inset) — so camera framing keeps markers below it instead of centering on the full
   * screen height as if that chrome weren't there. */
  topInset?: number;
  /** Height, in px, of any opaque/floating chrome covering the BOTTOM of this map (a bottom
   * sheet/panel, tab bar) — same purpose as `topInset`, for the bottom edge. */
  bottomInset?: number;
  onTodaPress?: (zone: TodaZone) => void;
  onRecenter?: () => void;
  style?: any;
}
