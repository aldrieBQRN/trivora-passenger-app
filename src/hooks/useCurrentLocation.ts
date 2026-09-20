import { useCallback, useState } from 'react';
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

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      setError('Could not determine your current location.');
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  return { isLocating, error, requestCurrentLocation };
}
