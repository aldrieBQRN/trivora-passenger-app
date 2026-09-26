/**
 * Trivora Passenger - Full Specification Types
 */

export interface TodaZone {
  id: number;
  code: string;
  name: string;
  terminal: string;
  terminal_name?: string;
  badgeColor: string;
  centerLat: number;
  centerLng: number;
  coverageKm: number;
  baseFare: number;
  perKmRate: number;
  description?: string;
  barangay?: string;
  address?: string;
}

export interface LocationPoint {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  zoneCode?: string;
  barangay?: string;
  todaName?: string;
  terminalName?: string;
}

/** A passenger's saved destination shortcut — backed by the real `saved_places` table, always
 * carrying the exact coordinates confirmed when it was created/edited. */
export interface SavedPlace {
  id: number;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface FareCalculation {
  /** Base fare for trips up to and including 4 km: ₱50 flat for exactly 1 passenger, or ₱25 per
   * passenger for 2 or more. */
  base: number;
  /** Per-passenger additional-distance charge — ₱5 per km beyond 4 km, billed continuously
   * (a partial km is charged proportionally, not rounded up). */
  distanceFee: number;
  /** base + distanceFee — the fare charged per rider. Same value as `total` when passengerCount
   * is 1; the field to display for a "fare per passenger" line at any other count. */
  perPassengerFare: number;
  /** The passenger count this FareCalculation was computed for. */
  passengerCount: number;
  /** perPassengerFare * passengerCount — the final trip total. */
  total: number;
  distanceKm: number;
  durationMinutes: number;
}

export type PaymentMethod = 'cash' | 'gcash' | 'wallet';

export type PassengerScreenState =
  | 'onboarding'
  | 'auth'
  | 'home'
  | 'destination_select'
  | 'confirm_fare'
  | 'searching'
  | 'driver_en_route'
  | 'in_transit'
  | 'trip_completed'
  | 'rate_review';

export type RideLifecycleState =
  | 'idle'
  | 'searching'
  | 'accepted'
  | 'arrived'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export interface DriverInfo {
  id: number;
  name: string;
  mobile: string;
  rating: number;
  trips: number;
  todaName?: string;
  avatarUrl?: string;
  tricycle: {
    plateNumber: string;
    codingNumber: string;
    model: string;
    color?: string;
  };
}

export type DriverProfile = DriverInfo & {
  distanceKm: number;
  etaMinutes: number;
};

export interface HistoryItem {
  id: number | string;
  bookingCode: string;
  date: string;
  /** Optional so existing hardcoded demo entries stay valid — real entries (added from the
   * backend booking record) always carry this alongside `date`, both derived from the same
   * timestamp. */
  time?: string;
  pickup: string;
  dropoff: string;
  fare: number;
  distanceKm: number;
  durationMinutes: number;
  status: 'Completed' | 'Cancelled';
  driverName?: string;
  plateNumber?: string;
  rating?: number | null;
  /** Optional so existing hardcoded demo entries stay valid — real entries always carry this. */
  passengerCount?: number;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  mobile: string;
  avatarUrl?: string;
  rating: number;
  totalRides: number;
  /** Raw ISO timestamp of account creation, formatted at render time (e.g. "Sep 2026"). */
  memberSince?: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'receipt' | 'alert' | 'promo' | 'system';
}

export interface TripReceipt {
  bookingCode: string;
  date: string;
  time: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  durationMinutes: number;
  baseFare: number;
  distanceFee: number;
  farePerPassenger: number;
  passengerCount: number;
  totalFare: number;
  paymentMethod: PaymentMethod;
  driverName: string;
  plateNumber: string;
  codingNumber: string;
  todaName?: string;
  mtopNumber: string;
}
