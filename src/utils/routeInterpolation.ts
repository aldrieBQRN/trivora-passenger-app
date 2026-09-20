import { RouteCoordinate } from '../services/routingService';
import { TodaZone } from '../types';

export function haversineKm(a: RouteCoordinate, b: RouteCoordinate): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * The single nearest-TODA lookup shared by the booking flow (BookingContext) and the pin-drop
 * flow (usePinLocation) — pure haversine distance (this file's own haversineKm, no road-distance
 * fudge factor or minimum-fare floor) from the pickup point to every TODA's own
 * centerLat/centerLng, smallest wins. Every zone is checked; there's no early exit once a
 * "nearby" one is found. Zones with missing/non-finite/out-of-range coordinates are excluded
 * entirely, not just deprioritized — never zoneCode, never route geometry, never array order.
 */
export function findNearestZone(point: RouteCoordinate, zones: TodaZone[]): TodaZone {
  const candidates = zones.filter((z) => isValidCoordinate(z.centerLat, z.centerLng));

  if (candidates.length === 0) {
    if (__DEV__) {
      console.warn(
        '[findNearestZone] no TODA in the list has valid coordinates — returning the first entry as a last resort.'
      );
    }
    return zones[0];
  }

  let nearest = candidates[0];
  let minDistanceKm = haversineKm(point, { lat: nearest.centerLat, lng: nearest.centerLng });
  const distances: { code: string; km: number }[] = [{ code: nearest.code, km: minDistanceKm }];

  for (let i = 1; i < candidates.length; i++) {
    const zone = candidates[i];
    const distanceKm = haversineKm(point, { lat: zone.centerLat, lng: zone.centerLng });
    distances.push({ code: zone.code, km: distanceKm });
    if (distanceKm < minDistanceKm) {
      minDistanceKm = distanceKm;
      nearest = zone;
    }
  }

  if (__DEV__) {
    const sorted = [...distances].sort((a, b) => a.km - b.km);
    console.log(
      `[findNearestZone] pickup (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}) -> ` +
        sorted.map((d) => `${d.code}: ${d.km.toFixed(3)}km`).join(', ') +
        ` -> selected ${nearest.code}`
    );
  }

  return nearest;
}

export function bearingDegrees(a: RouteCoordinate, b: RouteCoordinate): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface InterpolatedPoint {
  lat: number;
  lng: number;
  heading: number;
}

/**
 * Walks a route polyline and returns the point at `progressFraction` (0..1)
 * of its total distance, plus the heading (degrees, 0=North) of the segment
 * it falls on. This is what makes a driver/trip marker actually move along
 * the real route instead of sitting frozen or jumping discontinuously.
 */
export function interpolateAlongRoute(
  coordinates: RouteCoordinate[],
  progressFraction: number
): InterpolatedPoint {
  const fraction = Math.max(0, Math.min(1, progressFraction));

  if (coordinates.length === 0) {
    return { lat: 0, lng: 0, heading: 0 };
  }
  if (coordinates.length === 1) {
    return { lat: coordinates[0].lat, lng: coordinates[0].lng, heading: 0 };
  }

  const segmentLengths: number[] = [];
  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const len = haversineKm(coordinates[i], coordinates[i + 1]);
    segmentLengths.push(len);
    totalDistance += len;
  }

  if (totalDistance === 0) {
    return { lat: coordinates[0].lat, lng: coordinates[0].lng, heading: 0 };
  }

  const targetDistance = fraction * totalDistance;
  let covered = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    const isLastSegment = i === segmentLengths.length - 1;
    if (covered + segLen >= targetDistance || isLastSegment) {
      const segFraction = segLen === 0 ? 0 : Math.min(1, (targetDistance - covered) / segLen);
      const a = coordinates[i];
      const b = coordinates[i + 1];
      return {
        lat: a.lat + (b.lat - a.lat) * segFraction,
        lng: a.lng + (b.lng - a.lng) * segFraction,
        heading: bearingDegrees(a, b),
      };
    }
    covered += segLen;
  }

  const last = coordinates[coordinates.length - 1];
  return { lat: last.lat, lng: last.lng, heading: 0 };
}

/**
 * Given an origin, a bearing (degrees) and a distance, returns the resulting
 * point. Used to synthesize a plausible driver starting position near
 * pickup (this demo has no real driver-location source) before handing it
 * to the routing service, which snaps it onto the nearest real road.
 */
export function destinationPoint(
  origin: RouteCoordinate,
  bearingDeg: number,
  distanceKm: number
): RouteCoordinate {
  const R = 6371;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const angularDistance = distanceKm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}
