import { useCallback, useEffect, useRef, useState } from 'react';
import { LocationPoint, TodaZone } from '../types';
import { TODA_ZONES, calculateFare } from '../constants/todaRoutes';
import { fetchRoute, reverseGeocode, RouteCoordinate, RouteSource } from '../services/routingService';
import { fetchTodaZones } from '../services/api';
import { findNearestZone } from '../utils/routeInterpolation';

interface UsePinLocationResult {
  pinnedLocation: LocationPoint;
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
}

const PICK_DEBOUNCE_MS = 350;

/**
 * Shared pin-drop state/logic for PinLocationModal's native and web bodies: tracks the pinned
 * point and resolves it to a real address (Nominatim), debounced so rapid re-tapping doesn't
 * spam the service. `currentPickup` is optional — pure destination selection (Add Place, a
 * standalone Pin Location flow) has no pickup reference at all, in which case no route/fare is
 * computed and the map simply won't render a pickup marker or route line. When a real pickup IS
 * given (picking a destination mid-booking), a route+fare are still resolved so the map can draw
 * the connecting line, but that's ambient context — no fare/ETA/zone text belongs in this picker;
 * that summary lives on the booking screens that actually own the booking flow.
 */
export function usePinLocation(currentPickup?: LocationPoint, initialLocation?: LocationPoint): UsePinLocationResult {
  const [todaList, setTodaList] = useState<TodaZone[]>(TODA_ZONES);

  // Nearest by actual distance to whichever real coordinate we have (initialLocation, else
  // currentPickup) — never a pre-assigned zoneCode string, which can be stale or simply wrong
  // (the same class of bug already fixed in BookingContext's own pickup matching).
  const initialPoint = initialLocation || currentPickup;
  const initialZone = initialPoint
    ? findNearestZone(initialPoint, todaList)
    : todaList[0] || TODA_ZONES[0];

  const initialAddress = initialZone.address || (initialZone.barangay ? `${initialZone.barangay}, Nasugbu, Batangas` : 'Nasugbu, Batangas');

  const [pinnedLocation, setPinnedLocation] = useState<LocationPoint>(
    initialLocation || {
      name: initialZone.name,
      todaName: initialZone.name,
      terminalName: initialZone.terminal_name || initialZone.terminal || '',
      barangay: initialZone.barangay,
      address: initialAddress,
      lat: currentPickup?.lat ?? initialZone.centerLat,
      lng: currentPickup?.lng ?? initialZone.centerLng,
      zoneCode: initialZone.code,
      category: 'TODA Terminal',
    }
  );
  const [matchedZone, setMatchedZone] = useState<TodaZone>(initialZone);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [routeSource, setRouteSource] = useState<RouteSource>('fallback');
  const [distanceKm, setDistanceKm] = useState<number>(0.8);
  const [durationMinutes, setDurationMinutes] = useState<number>(3);
  const [isResolving, setIsResolving] = useState(false);

  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTodaZones().then((zones) => {
      if (zones && zones.length > 0) {
        setTodaList(zones);
        if (!initialLocation) {
          // Same fix as initialZone above — match by real distance now that the live list has
          // loaded, not by a stale zoneCode string.
          const match = currentPickup ? findNearestZone(currentPickup, zones) : zones[0];
          setMatchedZone(match);
          setPinnedLocation({
            name: match.name,
            todaName: match.name,
            terminalName: match.terminal_name || match.terminal || '',
            barangay: match.barangay,
            address: match.address || (match.barangay ? `${match.barangay}, Nasugbu, Batangas` : 'Nasugbu, Batangas'),
            lat: currentPickup?.lat ?? match.centerLat,
            lng: currentPickup?.lng ?? match.centerLng,
            zoneCode: match.code,
            category: 'TODA Terminal',
          });
        }
      }
    });
  }, [initialLocation, currentPickup?.lat, currentPickup?.lng]);

  // Populate an initial real route for the starting pin, once — only when there's an actual
  // pickup to route from.
  useEffect(() => {
    if (!currentPickup) return;
    fetchRoute(
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

  const pickToda = useCallback(
    (zone: TodaZone) => {
      setMatchedZone(zone);
      setIsResolving(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const todaName = zone.name;
      const terminalName = zone.terminal_name || zone.terminal || '';
      const address = zone.address || (zone.barangay ? `${zone.barangay}, Nasugbu, Batangas` : 'Nasugbu, Batangas');

      setPinnedLocation({
        name: todaName,
        todaName: todaName,
        terminalName: terminalName,
        barangay: zone.barangay,
        address: address,
        lat: zone.centerLat,
        lng: zone.centerLng,
        zoneCode: zone.code,
        category: 'TODA Terminal',
      });

      if (currentPickup) {
        fetchRoute(
          { lat: currentPickup.lat, lng: currentPickup.lng },
          { lat: zone.centerLat, lng: zone.centerLng }
        ).then((route) => {
          setRouteCoordinates(route.coordinates);
          setRouteSource(route.source);
          setDistanceKm(route.distanceKm);
          setDurationMinutes(route.durationMinutes);
        });
      }
    },
    [currentPickup?.lat, currentPickup?.lng]
  );

  const pickPoint = useCallback(
    (point: RouteCoordinate) => {
      const zone = findNearestZone(point, todaList);
      setMatchedZone(zone);
      setIsResolving(true);

      const todaName = zone.name;

      // Optimistic placeholder while both network calls are in flight.
      setPinnedLocation({
        name: todaName,
        todaName: todaName,
        terminalName: '',
        barangay: zone.barangay,
        address: `Lat ${point.lat.toFixed(4)}, Lng ${point.lng.toFixed(4)}`,
        lat: point.lat,
        lng: point.lng,
        zoneCode: zone.code,
        category: 'Pinned',
      });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      const requestId = ++requestIdRef.current;

      debounceRef.current = setTimeout(async () => {
        const [geocode, route] = await Promise.all([
          reverseGeocode(point),
          currentPickup
            ? fetchRoute({ lat: currentPickup.lat, lng: currentPickup.lng }, point)
            : Promise.resolve(null),
        ]);
        if (requestId !== requestIdRef.current) return;

        setPinnedLocation({
          name: todaName,
          todaName: todaName,
          terminalName: '',
          barangay: geocode.barangay || zone.barangay,
          address: geocode.address,
          lat: point.lat,
          lng: point.lng,
          zoneCode: zone.code,
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
    [currentPickup?.lat, currentPickup?.lng, todaList]
  );

  const fareTotal = calculateFare(distanceKm, matchedZone).total;

  return {
    pinnedLocation,
    matchedZone,
    routeCoordinates,
    routeSource,
    distanceKm,
    durationMinutes,
    fareTotal,
    isResolving,
    pickPoint,
    pickToda,
    todaList,
  };
}
