import { TodaZone, LocationPoint, FareCalculation } from '../types';

export const TODA_ZONES: TodaZone[] = [];

export const POPULAR_DESTINATIONS: LocationPoint[] = [
  {
    name: 'Nasugbu Municipal Hall',
    address: 'J.P. Rizal St., Poblacion',
    lat: 14.0718,
    lng: 120.6325,
    category: 'Government',
  },
  {
    name: 'Bucana, Nasugbu Batangas',
    address: 'Bridge St., Bucana',
    lat: 14.0638,
    lng: 120.6289,
    category: 'Terminal',
  },
  {
    name: 'Trivora Public Market',
    address: 'Market St., Brgy 8',
    lat: 14.0705,
    lng: 120.6341,
    category: 'Market',
  },
  {
    name: 'Ospital ng Nasugbu',
    address: 'National Highway, Brgy 10',
    lat: 14.0732,
    lng: 120.6315,
    category: 'Hospital',
  },
  {
    name: 'Wawa Port & Baywalk',
    address: 'Coastal Rd., Brgy 4',
    lat: 14.0668,
    lng: 120.6335,
    category: 'Harbor',
  },
  {
    name: 'Bucana Beach & Resorts',
    address: 'Sunset Blvd., Bucana',
    lat: 14.0612,
    lng: 120.6241,
    category: 'Leisure',
  },
  {
    name: 'Nasugbu West Central School',
    address: 'P. Burgos St., Poblacion',
    lat: 14.0745,
    lng: 120.6355,
    category: 'School',
  },
  {
    name: 'SM Savemore Nasugbu',
    address: 'National Highway, Brgy 10',
    lat: 14.0755,
    lng: 120.6308,
    category: 'Commercial',
  },
];

export function calculateDistance(loc1: LocationPoint, loc2: LocationPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) *
      Math.cos((loc2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDist = R * c;
  // Fallback to minimum 0.8 km for town tricycles
  return Number(Math.max(0.8, rawDist * 1.35).toFixed(1));
}

/** Trips up to and including this distance are covered by the flat base fare. */
const FREE_DISTANCE_KM = 4.0;
/** Charge per kilometer beyond FREE_DISTANCE_KM, charged once per passenger. Billed
 * continuously (fractional km), not rounded up to the next whole km. */
const RATE_PER_KM = 5.0;
/** Flat base fare for a single-passenger trip. */
const BASE_FARE_SINGLE = 50.0;
/** Base fare charged per passenger for a trip with 2 or more passengers. */
const BASE_FARE_PER_PASSENGER = 25.0;

/**
 * The passenger app's fare preview — must mirror FareService (baseFare + perPassengerFare +
 * calculate) on the backend exactly (same base-by-passenger-count rule, same free distance, same
 * per-km rate, same continuous/non-ceiled excess-distance billing, same per-passenger x count
 * multiplication), since this is only ever a preview: BookingController::requestBooking()
 * recomputes and stores the authoritative fare server-side from the same
 * distance_km/passenger_count this function is given, ignoring whatever the client sends. This is
 * the ONE place the passenger app multiplies fare by passenger count — callers must never
 * separately multiply an already-calculated total themselves.
 *
 * `passengerCount` defaults to 1 so existing call sites that only care about the distance-based
 * preview (before the passenger has chosen a count) don't need to change.
 */
export function calculateFare(distanceKm: number, _todaZone?: any, passengerCount: number = 1): FareCalculation {
  const safePassengerCount = Math.max(1, Math.floor(passengerCount) || 1);
  const base = safePassengerCount <= 1 ? BASE_FARE_SINGLE : BASE_FARE_PER_PASSENGER;
  const excessKm = Math.max(0, Number(distanceKm.toFixed(2)) - FREE_DISTANCE_KM);
  const distanceFee = Number((excessKm * RATE_PER_KM).toFixed(2));
  const perPassengerFare = Number((base + distanceFee).toFixed(2));
  const total = Number((perPassengerFare * safePassengerCount).toFixed(2));
  const durationMinutes = Math.max(3, Math.round(distanceKm * 3.3));

  return {
    base,
    distanceFee,
    perPassengerFare,
    passengerCount: safePassengerCount,
    total,
    distanceKm,
    durationMinutes,
  };
}
