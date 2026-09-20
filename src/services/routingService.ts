import { Platform } from 'react-native';
import { calculateDistance, calculateFare } from '../constants/todaRoutes';

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export type RouteSource = 'osrm' | 'fallback';

export interface RouteResult {
  coordinates: RouteCoordinate[];
  distanceKm: number;
  durationMinutes: number;
  source: RouteSource;
}

export interface ReverseGeocodeResult {
  name: string;
  address: string;
  barangay?: string;
  source: 'nominatim' | 'fallback';
}

export interface PlaceSearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/** Loose bounding box around Nasugbu, Batangas (west, south, east, north) — keeps search
 * results relevant to the service area without hard-excluding just-outside-town places. */
const NASUGBU_VIEWBOX = '120.55,14.01,120.72,14.13';

const MAX_CACHE_ENTRIES = 200;
const routeCache = new Map<string, RouteResult>();
const geocodeCache = new Map<string, ReverseGeocodeResult>();

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function cacheSet<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

function routeCacheKey(origin: RouteCoordinate, destination: RouteCoordinate): string {
  return `${round5(origin.lat)},${round5(origin.lng)}|${round5(destination.lat)},${round5(destination.lng)}`;
}

function geocodeCacheKey(point: RouteCoordinate): string {
  return `${round5(point.lat)},${round5(point.lng)}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

/** Reuses the app's existing haversine + fudge-factor estimate as the fallback route's numbers. */
function buildFallbackRoute(origin: RouteCoordinate, destination: RouteCoordinate): RouteResult {
  const originPoint = { name: '', lat: origin.lat, lng: origin.lng };
  const destPoint = { name: '', lat: destination.lat, lng: destination.lng };
  const distanceKm = calculateDistance(originPoint, destPoint);
  const { durationMinutes } = calculateFare(distanceKm, null);

  return {
    coordinates: [origin, destination],
    distanceKm,
    durationMinutes,
    source: 'fallback',
  };
}

/**
 * Fetches a real road-following route from OSRM's public routing server.
 * Never rejects — any failure (timeout, non-200, malformed body, OSRM's own
 * error code) resolves the existing haversine-based fallback instead, tagged
 * `source: 'fallback'` so callers can render it as visibly last-resort.
 * Successful results are cached briefly; fallback results are not cached, so
 * a later retry can still succeed once connectivity/the service recovers.
 */
export async function fetchRoute(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
  opts?: { timeoutMs?: number }
): Promise<RouteResult> {
  const key = routeCacheKey(origin, destination);
  const cached = routeCache.get(key);
  if (cached) return cached;

  const timeoutMs = opts?.timeoutMs ?? 6000;
  const url = `${OSRM_ROUTE_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

    const data = await response.json();
    const route = data?.routes?.[0];
    if (data?.code !== 'Ok' || !route?.geometry?.coordinates) {
      throw new Error('OSRM: no route found');
    }

    const coordinates: RouteCoordinate[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );

    const result: RouteResult = {
      coordinates,
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      source: 'osrm',
    };
    cacheSet(routeCache, key, result);
    return result;
  } catch {
    return buildFallbackRoute(origin, destination);
  }
}

/**
 * Reverse-geocodes a pinned point via Nominatim. Never rejects — failure
 * resolves a generic coordinate-based name, deliberately not a fake-looking
 * real address, so it reads as an honest fallback rather than a wrong result.
 */
export async function reverseGeocode(
  point: RouteCoordinate,
  opts?: { timeoutMs?: number }
): Promise<ReverseGeocodeResult> {
  const key = geocodeCacheKey(point);
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const timeoutMs = opts?.timeoutMs ?? 5000;
  const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${point.lat}&lon=${point.lng}`;
  // Browsers block a custom User-Agent header; native fetch allows one, and
  // Nominatim's usage policy asks for a distinguishing identifier where possible.
  const headers: Record<string, string> =
    Platform.OS === 'web' ? {} : { 'User-Agent': 'TrivoraPassengerApp/1.0 (capstone demo)' };

  try {
    const response = await fetchWithTimeout(url, timeoutMs, headers);
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);

    const data = await response.json();
    if (!data || data.error) throw new Error('Nominatim: no result');

    const rawBarangay =
      data.address?.quarter ||
      data.address?.suburb ||
      data.address?.village ||
      data.address?.neighbourhood ||
      data.address?.city_district;

    let barangay: string | undefined;
    if (rawBarangay) {
      const lower = rawBarangay.toLowerCase();
      if (lower.includes('bucana')) {
        barangay = 'Barangay Bucana';
      } else {
        const numMatch = rawBarangay.match(/(?:barangay|brgy\.?)\s*(\d+)/i) || rawBarangay.match(/\b([1-9]|10)\b/);
        if (numMatch) {
          barangay = `Barangay ${numMatch[1]}`;
        } else {
          barangay = rawBarangay.startsWith('Barangay') || rawBarangay.startsWith('Brgy')
            ? rawBarangay
            : `Barangay ${rawBarangay}`;
        }
      }
    }

    const road = data.address?.road;
    const houseNumber = data.address?.house_number;
    let cleanAddress = '';
    if (road) {
      cleanAddress = `${houseNumber ? houseNumber + ' ' : ''}${road}, ${barangay || 'Nasugbu'}, Batangas`;
    } else if (data.display_name) {
      cleanAddress = data.display_name
        .split(',')
        .slice(0, 3)
        .map((s: string) => s.trim())
        .join(', ');
    } else {
      cleanAddress = `${barangay || 'Nasugbu'}, Batangas`;
    }

    const name = barangay || data.name || 'Nasugbu';

    const result: ReverseGeocodeResult = {
      name,
      address: cleanAddress,
      barangay,
      source: 'nominatim',
    };
    cacheSet(geocodeCache, key, result);
    return result;
  } catch {
    return {
      name: 'Nasugbu',
      address: `Lat ${point.lat.toFixed(4)}, Lng ${point.lng.toFixed(4)}`,
      source: 'fallback',
    };
  }
}

/**
 * Forward-geocodes free text via Nominatim's /search endpoint, biased to the Nasugbu service
 * area. Returns real places with real coordinates only — on any failure (timeout, non-200,
 * empty result set) resolves an empty array rather than inventing a result, so callers never
 * have to distinguish "no matches" from "the service is down".
 */
export async function searchPlaces(
  query: string,
  opts?: { timeoutMs?: number; limit?: number }
): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const timeoutMs = opts?.timeoutMs ?? 5000;
  const limit = opts?.limit ?? 6;
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: trimmed,
    countrycodes: 'ph',
    viewbox: NASUGBU_VIEWBOX,
    bounded: '0',
    limit: String(limit),
  });
  const url = `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
  const headers: Record<string, string> =
    Platform.OS === 'web' ? {} : { 'User-Agent': 'TrivoraPassengerApp/1.0 (capstone demo)' };

  try {
    const response = await fetchWithTimeout(url, timeoutMs, headers);
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      name: item.name || (item.display_name as string).split(',')[0],
      address: item.display_name || '',
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
  } catch {
    return [];
  }
}
