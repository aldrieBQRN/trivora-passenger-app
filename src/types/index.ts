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
  base: number;
  distanceFee: number;
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
    bodyNumber: string;
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
}

export type ReportCategory = 'driver' | 'vehicle' | 'fare' | 'booking' | 'pickup_dropoff' | 'other';

export type ReportStatus = 'submitted' | 'under_review' | 'resolved';

export interface ReportItem {
  id: number;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  bookingId: number | null;
  bookingPickup: string | null;
  bookingDropoff: string | null;
  createdAt: string;
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
  totalFare: number;
  paymentMethod: PaymentMethod;
  driverName: string;
  plateNumber: string;
  bodyNumber: string;
  todaName: string;
  mtopNumber: string;
}
