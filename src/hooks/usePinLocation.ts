import { useCallback, useEffect, useRef, useState } from 'react';
import { LocationPoint, TodaZone } from '../types';
import { calculateFare } from '../constants/todaRoutes';
import { useCurrentLocation } from './useCurrentLocation';
import { fetchRoute, reverseGeocode, RouteCoordinate, RouteSource } from '../services/routingService';

interface UsePinLocationResult {
  pinnedLocation: LocationPoint | null;
  matchedZone: TodaZone;
  routeCoordinates: RouteCoordinate[];
  routeSource: RouteSource;
  distanceKm: number;
  durationMinutes: number;
  fareTotal: number;
  isResolving: boolean;
  pickPoint: (point: RouteCoordinate) => void;
  pickToda: (zone: TodaZone) => void;
  todaList: TodaZone[];
  /** Pin Pickup Location only: true until the device's real position is known — the caller shows
   * a pending view instead of a map, so no default coordinate is ever displayed. */
  awaitingLocation: boolean;
  isLocating: boolean;
  locationError: string | null;
  retryLocation: () => void;
}

const PICK_DEBOUNCE_MS = 350;
const NASUGBU_CENTER = { lat: 14.0718, lng: 120.6325 };

export function usePinLocation(
  currentPickup?: LocationPoint,
  initialLocation?: LocationPoint,
  mode: 'pickup' | 'destination' = 'destination'
): UsePinLocationResult {
  const isPickup = mode === 'pickup';
  const { isLocating, error: locationError, requestCurrentLocation } = useCurrentLocation();

  const [pinnedLocation, setPinnedLocation] = useState<LocationPoint | null>(() => {
    if (initialLocation) return initialLocation;
    if (isPickup) {
      return {
        name: 'Pick-up Location',
        address: 'Nasugbu, Batangas',
        lat: NASUGBU_CENTER.lat,
        lng: NASUGBU_CENTER.lng,
        category: 'Pinned',
      };
    }
    return null;
  });

  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [routeSource, setRouteSource] = useState<RouteSource>('fallback');
  const [distanceKm, setDistanceKm] = useState<number>(0.8);
  const [durationMinutes, setDurationMinutes] = useState<number>(3);
  const [isResolving, setIsResolving] = useState(false);

  const requestIdRef = useRef(0);

  // `currentPickup` is really "the other, unchanged endpoint". In destination mode that's the
  // pickup, so the route runs it -> pinned. In pickup mode it's the destination, so the route must
  // run pinned -> it (pickup first, destination last) — never reversed.
  const routeBetween = (other: RouteCoordinate, pinned: RouteCoordinate) =>
    mode === 'pickup' ? fetchRoute(pinned, other) : fetchRoute(other, pinned);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate an initial real route for the starting pin if both endpoints exist
  useEffect(() => {
    if (!currentPickup || !pinnedLocation) return;
    routeBetween(
      { lat: currentPickup.lat, lng: currentPickup.lng },
      { lat: pinnedLocation.lat, lng: pinnedLocation.lng }
    ).then((route) => {
      setRouteCoordinates(route.coordinates);
      setRouteSource(route.source);
      setDistanceKm(route.distanceKm);
      setDurationMinutes(route.durationMinutes);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCurrentLocation = useCallback(() => {
    requestCurrentLocation().then((coords) => {
      if (!coords) return;
      setPinnedLocation({
        name: 'Current Location',
        address: `Lat ${coords.lat.toFixed(4)}, Lng ${coords.lng.toFixed(4)}`,
        lat: coords.lat,
        lng: coords.lng,
        category: 'Pinned',
      });
      reverseGeocode(coords).then((geo) => {
        setPinnedLocation((prev) =>
          prev && prev.lat === coords.lat && prev.lng === coords.lng
            ? { ...prev, name: geo.address || prev.name, barangay: geo.barangay, address: geo.address || prev.address }
            : prev
        );
      });
      if (currentPickup) {
        routeBetween({ lat: currentPickup.lat, lng: currentPickup.lng }, coords).then((route) => {
          setRouteCoordinates(route.coordinates);
          setRouteSource(route.source);
          setDistanceKm(route.distanceKm);
          setDurationMinutes(route.durationMinutes);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestCurrentLocation, currentPickup?.lat, currentPickup?.lng, mode]);

  useEffect(() => {
    if (isPickup && !initialLocation) applyCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickToda = useCallback((_zone: TodaZone) => {}, []);

  const pickPoint = useCallback(
    (point: RouteCoordinate) => {
      setIsResolving(true);

      // Optimistic placeholder while network calls are in flight
      setPinnedLocation({
        name: 'Pinned Location',
        address: `Lat ${point.lat.toFixed(4)}, Lng ${point.lng.toFixed(4)}`,
        lat: point.lat,
        lng: point.lng,
        category: 'Pinned',
      });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      const requestId = ++requestIdRef.current;

      debounceRef.current = setTimeout(async () => {
        const [geocode, route] = await Promise.all([
          reverseGeocode(point),
          currentPickup
            ? routeBetween({ lat: currentPickup.lat, lng: currentPickup.lng }, point)
            : Promise.resolve(null),
        ]);
        if (requestId !== requestIdRef.current) return;

        setPinnedLocation({
          name: geocode.address || 'Pinned Location',
          barangay: geocode.barangay,
          address: geocode.address,
          lat: point.lat,
          lng: point.lng,
          category: 'Pinned',
        });
        if (route) {
          setRouteCoordinates(route.coordinates);
          setRouteSource(route.source);
          setDistanceKm(route.distanceKm);
          setDurationMinutes(route.durationMinutes);
        }
        setIsResolving(false);
      }, PICK_DEBOUNCE_MS);
    },
    [currentPickup?.lat, currentPickup?.lng, mode]
  );

  const fareTotal = calculateFare(distanceKm).total;

  const dummyZone: TodaZone = {
    id: 1,
    code: 'GENERAL',
    name: 'General Service',
    terminal: 'Nasugbu',
    badgeColor: '#2563EB',
    centerLat: NASUGBU_CENTER.lat,
    centerLng: NASUGBU_CENTER.lng,
    coverageKm: 5,
    baseFare: 25,
    perKmRate: 5,
  };

  return {
    pinnedLocation,
    matchedZone: dummyZone,
    routeCoordinates,
    routeSource,
    distanceKm,
    durationMinutes,
    fareTotal,
    isResolving,
    pickPoint,
    pickToda,
    todaList: [],
    awaitingLocation: false,
    isLocating,
    locationError,
    retryLocation: applyCurrentLocation,
  };
}
