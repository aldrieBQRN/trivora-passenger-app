import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface CurrentLocationCoords {
  lat: number;
  lng: number;
}

interface UseCurrentLocationResult {
  isLocating: boolean;
  /** Set only when a fetch actually failed (permission denied, GPS unavailable) — callers can
   * surface this to explain why pickup stayed on its previous value. */
  error: string | null;
  requestCurrentLocation: () => Promise<CurrentLocationCoords | null>;
}

/** How old a cached device fix may be before it's ignored in favor of a fresh one. */
const LAST_KNOWN_MAX_AGE_MS = 60_000;
const FRESH_FIX_TIMEOUT_MS = 10_000;

/**
 * One-shot device GPS fetch, gating on foreground permission first. Never throws — a denied
 * permission or a GPS failure resolves null so callers can fall back gracefully instead of
 * crashing the booking flow.
 */
export function useCurrentLocation(): UseCurrentLocationResult {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCurrentLocation = useCallback(async (): Promise<CurrentLocationCoords | null> => {
    setIsLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission was not granted.');
        return null;
      }

      // Step 1: a RECENT hardware-cached fix is instant and good enough. An old one (a device
      // that last had GPS in another town yesterday) is NOT — it would center the map on the
      // wrong area — so the cache is only trusted within LAST_KNOWN_MAX_AGE_MS.
      const recent = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
      if (recent?.coords) {
        return { lat: recent.coords.latitude, lng: recent.coords.longitude };
      }

      // Step 2: fresh fix, bounded so it never hangs.
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), FRESH_FIX_TIMEOUT_MS));
      const freshPosition = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeoutPromise,
      ]);
      if (freshPosition && 'coords' in freshPosition) {
        return { lat: freshPosition.coords.latitude, lng: freshPosition.coords.longitude };
      }

      // Step 3: no fresh fix in time — an older cached fix is still a REAL device coordinate
      // (better than nothing). Never a hardcoded town-center substitute: if the device has no
      // fix at all this resolves null and the caller shows its honest retry state.
      const stale = await Location.getLastKnownPositionAsync().catch(() => null);
      if (stale?.coords) {
        return { lat: stale.coords.latitude, lng: stale.coords.longitude };
      }
      setError('Could not determine your current location.');
      return null;
    } catch {
      setError('Could not determine your current location.');
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  return { isLocating, error, requestCurrentLocation };
}

/**
 * Live device position for the Home map's current-location pin + Focus follow mode. The ONLY
 * continuous location source in the Passenger app (it replaces the map's native blue-dot updates
 * Home used before). Runs only while `enabled` (Home mounted). Never requests permission — Home
 * only renders after the existing one-shot fetch obtained it — and never returns a guessed value:
 * null until the first real fix.
 */
export function useLiveLocation(enabled: boolean): CurrentLocationCoords | null {
  const [location, setLocation] = useState<CurrentLocationCoords | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 3, timeInterval: 3000 },
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        // No live updates — Home keeps the last real position it already has.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return location;
}
