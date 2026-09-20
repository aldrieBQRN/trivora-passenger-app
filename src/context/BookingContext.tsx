import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  LocationPoint,
  TodaZone,
  FareCalculation,
  PassengerScreenState,
  DriverProfile,
  HistoryItem,
  PaymentMethod,
  NotificationItem,
  TripReceipt,
} from '../types';
import {
  TODA_ZONES,
  POPULAR_DESTINATIONS,
  calculateDistance,
  calculateFare,
} from '../constants/todaRoutes';
import { fetchRoute, reverseGeocode, RouteCoordinate, RouteSource } from '../services/routingService';
import { interpolateAlongRoute, destinationPoint, bearingDegrees, haversineKm, findNearestZone } from '../utils/routeInterpolation';
import { passengerApi, mapBookingDriverToProfile, mapBookingRecordToHistoryItem, fetchTodaZones } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from './AuthContext';
import { useCurrentLocation } from '../hooks/useCurrentLocation';

export type PickupMode = 'current_location' | 'manual';

/**
 * Single decision point for the whole booking flow: 'real' talks to the Laravel backend end to
 * end (passenger creates a booking, eligible drivers see it, one of them accepts, the passenger
 * polls for that assignment); 'simulated' is the original local-only demo behavior, kept intact
 * for development/offline use. Flip via EXPO_PUBLIC_BOOKING_MODE=simulated in the environment —
 * no other file should re-derive this decision; every simulation-only effect below just checks
 * this one constant.
 */
const BOOKING_MODE: 'real' | 'simulated' =
  process.env.EXPO_PUBLIC_BOOKING_MODE === 'simulated' ? 'simulated' : 'real';

/** How often the passenger polls the real backend for booking status changes while waiting. */
const ACTIVE_BOOKING_POLL_MS = 4000;

/** Length of each real-mode search display cycle. The backend already broadcasts a pending
 * booking to every online/available driver in the matching TODA zone at once (see
 * BookingController::getPendingRequests) and keeps it open to all of them until one accepts —
 * there's no single targeted driver to "time out" and replace. So instead of freezing once the
 * countdown reaches zero, real mode loops it back to a fresh cycle and keeps broadcasting until
 * a driver accepts (detected by the active-booking poll) or the passenger cancels. */
const REAL_SEARCH_CYCLE_SECONDS = 60;

/** How far the driver must move from the route's last-fetched origin before the real
 * driver->pickup route is refetched — same threshold convention as the Driver app's own
 * useLiveRoute hook, so a normal GPS tick doesn't spam the routing service. */
const DRIVER_ROUTE_REROUTE_THRESHOLD_KM = 0.05;

function mapBackendStatusToScreenState(status: string): PassengerScreenState | null {
  switch (status) {
    case 'pending':
      return 'searching';
    case 'accepted':
    case 'arrived':
      return 'driver_en_route';
    case 'in_transit':
      return 'in_transit';
    case 'completed':
      return 'trip_completed';
    default:
      return null;
  }
}

interface BookingContextType {
  screenState: PassengerScreenState;
  setScreenState: (state: PassengerScreenState) => void;
  pickup: LocationPoint;
  setPickup: (loc: LocationPoint) => void;
  dropoff: LocationPoint;
  setDropoff: (loc: LocationPoint) => void;
  /** False until the passenger has explicitly picked a destination (search, quick-destination,
   * pin-on-map) — `dropoff` itself always holds a real coordinate internally (for the map/route
   * machinery), but no screen should display it as a chosen destination while this is false. */
  hasDestination: boolean;
  /** 'current_location' while pickup tracks the device's GPS fix (the default); 'manual' once
   * the passenger has explicitly picked a different pickup — GPS updates never overwrite it
   * after that, only useCurrentLocationForPickup() switches it back. */
  pickupMode: PickupMode;
  isLocatingPickup: boolean;
  /** Set only when a GPS fetch actually failed (permission denied, unavailable) — from the same
   * underlying useCurrentLocation() hook that isLocatingPickup comes from. */
  locationError: string | null;
  /** The real device GPS fix — null until the first successful fetch lands. This (not a separate
   * boolean) is what Home gates its initial loading state on, same as the Driver app's
   * currentLat/currentLng. */
  currentLat: number | null;
  currentLng: number | null;
  /** Re-fetches device GPS and sets it as pickup, switching pickupMode back to 'current_location'. */
  useCurrentLocationForPickup: () => void;
  /** Alias for useCurrentLocationForPickup used specifically as the location-error Retry action —
   * same function, named to match the Driver app's own retryLocation for the equivalent role. */
  retryLocation: () => void;
  matchedToda: TodaZone;
  setMatchedToda: (zone: TodaZone) => void;
  fareEstimate: FareCalculation;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  noteToDriver: string;
  setNoteToDriver: (note: string) => void;
  activeDriver: DriverProfile;
  historyList: HistoryItem[];
  addHistoryItem: (item: HistoryItem) => void;
  searchCountdown: number;
  searchStatusText: string;
  driverDistanceKm: number;
  driverEtaMinutes: number;
  tripRemainingKm: number;

  // Real road-routing (pickup -> dropoff), shared by the route-review/fare
  // screens and reused as the in-transit leg's route.
  routeCoordinates: RouteCoordinate[];
  routeSource: RouteSource;
  // Real road-routing for the driver's approach (synthetic start -> pickup).
  driverRouteCoordinates: RouteCoordinate[];
  driverRouteSource: RouteSource;
  // Live interpolated position along whichever route is currently active,
  // fed to the map instead of a frozen literal.
  liveDriverLocation: { lat: number; lng: number; heading: number } | null;

  // Dynamic Route & Destination actions
  selectDestination: (dest: LocationPoint) => void;
  selectPickup: (pickupLoc: LocationPoint) => void;
  swapLocations: () => void;

  // Dynamic Rate & Review
  selectedRating: number;
  setSelectedRating: (rating: number) => void;
  reviewComment: string;
  setReviewComment: (comment: string) => void;
  selectedCompliments: string[];
  toggleCompliment: (tag: string) => void;

  // Dynamic Notifications
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markNotificationRead: (id: number) => void;

  // Dynamic E-Receipt
  latestReceipt: TripReceipt;

  // State transitions
  startBookingFlow: () => void;
  /** Returns once the request has actually settled (screen moves to 'searching' on success, or
   * a toast is shown and the caller stays put on failure) — callers can await this to show a
   * loading state on the Confirm button instead of it looking unresponsive on a slow network. */
  confirmBooking: (numberOfPassengers: number, farePerPassenger: number) => Promise<void>;
  /** Server-authoritative: only clears the active booking locally once the backend has actually
   * confirmed the cancellation. Resolves false (and shows a toast) if the backend call fails, so
   * the passenger is never shown "cancelled/back to Home" while the booking is still active
   * server-side. */
  cancelBooking: () => Promise<boolean>;
  simulateDriverArrival: () => void;
  startRideTransit: () => void;
  completeRide: () => void;
  /** Starts rating a specific already-completed ride from Ride History — sets the booking to be
   * rated explicitly, rather than assuming whichever one completed most recently. */
  startRatingBooking: (bookingId: number | string) => void;
  finishReview: () => void;
  resetToHome: () => void;
  fastForwardSearch: () => void;
}

const BookingContext = createContext<BookingContextType | null>(null);

const DEFAULT_PICKUP: LocationPoint = {
  name: 'Bucana, Nasugbu Batangas',
  address: 'Bridge St., Bucana',
  lat: 14.0638,
  lng: 120.6289,
  zoneCode: 'TODA-BUCANA',
};

const DEFAULT_DROPOFF: LocationPoint = {
  name: 'Nasugbu Municipal Hall',
  address: 'J.P. Rizal St., Poblacion',
  lat: 14.0718,
  lng: 120.6325,
  zoneCode: 'TODA-BRGY8',
};


const DEFAULT_DRIVER: DriverProfile = {
  id: 101,
  name: 'Juan Dela Cruz',
  mobile: '+63 912 345 6789',
  rating: 4.9,
  trips: 1245,
  todaName: 'TODA Bucana',
  tricycle: {
    plateNumber: 'ABC 1234',
    bodyNumber: '04-128',
    model: 'Kawasaki Barako II (Blue)',
  },
  distanceKm: 1.2,
  etaMinutes: 3,
};

const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 1,
    bookingCode: 'TRV-20240520-0941',
    date: 'May 20, 2024',
    pickup: 'Bucana, Nasugbu Batangas',
    dropoff: 'Nasugbu Municipal Hall',
    fare: 29.0,
    distanceKm: 1.8,
    durationMinutes: 6,
    status: 'Completed',
    driverName: 'Juan Dela Cruz',
    plateNumber: 'ABC 1234',
    rating: 5,
  },
  {
    id: 2,
    bookingCode: 'TRV-20240518-1420',
    date: 'May 18, 2024',
    pickup: 'Bucana Public Market',
    dropoff: 'Brgy. 10, Nasugbu',
    fare: 25.0,
    distanceKm: 1.2,
    durationMinutes: 4,
    status: 'Completed',
    driverName: 'Pedro Ramos',
    plateNumber: 'XYZ 9876',
    rating: 5,
  },
  {
    id: 3,
    bookingCode: 'TRV-20240516-1105',
    date: 'May 16, 2024',
    pickup: 'Nasugbu Municipal Hall',
    dropoff: 'Bucana, Nasugbu Batangas',
    fare: 32.0,
    distanceKm: 2.4,
    durationMinutes: 8,
    status: 'Completed',
    driverName: 'Ramon Bautista',
    plateNumber: 'DEF 4567',
    rating: 4,
  },
  {
    id: 4,
    bookingCode: 'TRV-20240515-0812',
    date: 'May 15, 2024',
    pickup: 'Bucana, Nasugbu Batangas',
    dropoff: 'Papaya, Nasugbu',
    fare: 27.0,
    distanceKm: 1.5,
    durationMinutes: 5,
    status: 'Cancelled',
  },
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: 'Official Ride Receipt Ready',
    body: 'Ride TRV-20240520-0941 to Nasugbu Municipal Hall is certified. View official MTOP breakdown.',
    time: '2h ago',
    read: false,
    type: 'receipt',
  },
  {
    id: 2,
    title: 'TODA Bucana Tariff Update',
    body: 'Municipal standard base fare ₱20.00 is active. Report any unauthorized overcharging.',
    time: '1d ago',
    read: false,
    type: 'system',
  },
  {
    id: 3,
    title: 'Commuter Safety Priority',
    body: 'Always verify tricycle MTOP body number (e.g. 04-128) before boarding.',
    time: '3d ago',
    read: true,
    type: 'alert',
  },
];

const INITIAL_RECEIPT: TripReceipt = {
  bookingCode: 'TRV-20240520-0941',
  date: 'May 20, 2024',
  time: '09:41 AM',
  pickup: 'Bucana, Nasugbu Batangas',
  dropoff: 'Nasugbu Municipal Hall',
  distanceKm: 1.8,
  durationMinutes: 6,
  baseFare: 20.0,
  distanceFee: 9.0,
  totalFare: 29.0,
  paymentMethod: 'cash',
  driverName: 'Juan Dela Cruz',
  plateNumber: 'ABC 1234',
  bodyNumber: '04-128',
  todaName: 'TODA Bucana',
  mtopNumber: 'MTOP-2024-0089',
};

export function BookingProvider({ children }: { children: ReactNode }) {
  const [screenState, setScreenState] = useState<PassengerScreenState>('home');
  const [pickup, setPickup] = useState<LocationPoint>(DEFAULT_PICKUP);
  const [dropoff, setDropoff] = useState<LocationPoint>(DEFAULT_DROPOFF);
  const [hasDestination, setHasDestination] = useState(false);
  const [pickupMode, setPickupMode] = useState<PickupMode>('current_location');
  const { isLocating: isLocatingPickup, error: locationError, requestCurrentLocation } = useCurrentLocation();
  // The real device GPS fix, kept separate from `pickup` (which always has a value — the default
  // or a manually-chosen place — since the rest of the booking flow depends on it never being
  // null). These two stay null until the first real fix lands, which is exactly what Home gates
  // its initial loading state on — the same source-of-truth pattern as the Driver app's own
  // currentLat/currentLng in DriverShiftContext, instead of a separate "ready" flag that would
  // just duplicate what these two already say.
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  // Guards a reverse-geocode reply that resolves after the passenger has already moved on to a
  // manual pickup (or a newer GPS fix) — without this, a slow network reply could stomp a
  // pickup the passenger no longer has selected.
  const currentLocationRequestIdRef = useRef(0);
  const [matchedToda, setMatchedToda] = useState<TodaZone>(TODA_ZONES[0]);
  // Live TODA list from the backend's TODA Management data — falls back to the static
  // TODA_ZONES constant until this resolves (or if the request fails), same convention as
  // TrivoraMap/usePinLocation. Pickup-matching must use this, not the hardcoded array, so an
  // admin adding/editing/moving a TODA is reflected here without an app update.
  const [todaList, setTodaList] = useState<TodaZone[]>(TODA_ZONES);
  useEffect(() => {
    fetchTodaZones().then((zones) => {
      if (zones && zones.length > 0) setTodaList(zones);
    });
  }, []);
  // Re-match the current pickup once live TODA data actually arrives — the initial GPS fix can
  // resolve before this fetch does, which would otherwise leave matchedToda computed against the
  // stale static list until the passenger happens to move the pin again.
  useEffect(() => {
    setMatchedToda(findNearestZone(pickup, todaList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaList]);
  const [fareEstimate, setFareEstimate] = useState<FareCalculation>(() => {
    const dist = calculateDistance(DEFAULT_PICKUP, DEFAULT_DROPOFF);
    return calculateFare(dist, TODA_ZONES[0]);
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [noteToDriver, setNoteToDriver] = useState<string>('');
  const [activeDriver, setActiveDriver] = useState<DriverProfile>(DEFAULT_DRIVER);
  const [historyList, setHistoryList] = useState<HistoryItem[]>(INITIAL_HISTORY);
  const [searchCountdown, setSearchCountdown] = useState<number>(REAL_SEARCH_CYCLE_SECONDS);
  const [searchStatusText, setSearchStatusText] = useState<string>(
    'Broadcasting to nearby tricycles in Bucana Zone...'
  );
  // How many full countdown cycles the current real-mode search has gone through with no driver
  // accepting yet — purely for the status message ("still searching"); reset each time a new
  // search actually starts.
  const [searchCycleCount, setSearchCycleCount] = useState<number>(1);
  const [driverDistanceKm, setDriverDistanceKm] = useState<number>(1.2);
  const [driverEtaMinutes, setDriverEtaMinutes] = useState<number>(3);
  const [tripRemainingKm, setTripRemainingKm] = useState<number>(0);

  // Real routing state
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [routeSource, setRouteSource] = useState<RouteSource>('fallback');
  const [driverRouteCoordinates, setDriverRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [driverRouteSource, setDriverRouteSource] = useState<RouteSource>('fallback');
  const [driverRouteTotalKm, setDriverRouteTotalKm] = useState<number>(1.2);
  const [tripRouteTotalKm, setTripRouteTotalKm] = useState<number>(0);
  const [liveDriverLocation, setLiveDriverLocation] = useState<{ lat: number; lng: number; heading: number } | null>(
    null
  );
  const routeRequestIdRef = useRef(0);
  const driverRouteRequestIdRef = useRef(0);
  const dropoffRouteRequestIdRef = useRef(0);
  // Real-mode only: the driver position the driver->pickup route was last fetched from, so a
  // new fetch only fires once the driver has moved meaningfully (see
  // DRIVER_ROUTE_REROUTE_THRESHOLD_KM), not on every poll tick.
  const driverRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  // Same throttling, for the in-transit driver->dropoff leg — kept separate from
  // driverRouteOriginRef so entering/leaving each phase resets only its own throttle.
  const dropoffRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);

  // Real-backend booking state (BOOKING_MODE === 'real') — the id the backend assigned to the
  // passenger's own booking, polled via GET /passenger/bookings/active until the ride ends.
  const [realBookingId, setRealBookingId] = useState<number | string | null>(null);
  const realBookingPollRequestIdRef = useRef(0);
  // The specific booking currently being rated — kept separately from realBookingId (which is
  // cleared the moment the poll sees 'completed', so polling stops). Set two ways: automatically
  // the moment a ride completes (so the immediate post-ride RateReviewScreen flow submits against
  // the right id), or explicitly via startRatingBooking() when the passenger rates an OLDER,
  // already-completed ride from Ride History later. Previously this only had the first path
  // (named lastCompletedBookingId) — rating anything other than the single most-recently-
  // completed ride, or rating after an app reload (this is plain useState, not persisted), meant
  // finishReview()'s `if (... && lastCompletedBookingId)` guard was false, so the API call never
  // fired at all — the rating only ever existed in local state and vanished on the next real
  // fetch. Renamed to reflect that it now identifies whichever booking is actually being rated.
  const [bookingIdToRate, setBookingIdToRate] = useState<number | string | null>(null);
  const { showToast } = useToast();
  const { user, isAuthenticated, refreshProfile } = useAuth();

  // Defense-in-depth alongside the isAuthenticated guard on the active-booking poll below: a
  // logout mid-ride also drops any leftover booking-flow state so a later different account on
  // the same device (or a re-login) never inherits a stale realBookingId/bookingIdToRate/
  // screenState from the previous session.
  useEffect(() => {
    if (isAuthenticated) return;
    setRealBookingId(null);
    setBookingIdToRate(null);
    setScreenState((prev) => (prev === 'home' || prev === 'auth' || prev === 'onboarding' ? prev : 'home'));
  }, [isAuthenticated]);

  // Real-mode ride history: historyList otherwise stays permanently seeded from the hardcoded
  // INITIAL_HISTORY demo array above — nothing ever replaced it with the account's real
  // completed/cancelled bookings. Fetches once the passenger is known; a genuinely empty real
  // result correctly replaces the demo list with an empty one (so "No rides yet" shows for a
  // real account with no rides) — only a failed request (backend unreachable) leaves the
  // existing list alone, same offline-fallback convention used elsewhere in this app.
  useEffect(() => {
    if (BOOKING_MODE !== 'real' || !isAuthenticated || !user?.id) return;
    let cancelled = false;
    passengerApi
      .getHistory(user.id)
      .then((res: any) => {
        if (cancelled) return;
        const rawList = res?.bookings || res?.history || [];
        const finished = rawList.filter((b: any) => b.status === 'completed' || b.status === 'cancelled');
        setHistoryList(finished.map(mapBookingRecordToHistoryItem));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Resumes an in-progress real booking after a cold start (app relaunch after being killed by
  // the OS while backgrounded, or a web tab reloaded after being reclaimed) instead of dropping
  // the passenger back on Home mid-ride — the passenger must stay authenticated AND stay on their
  // ride when that happens, not just the former. Seeds pickup/dropoff/fareEstimate/realBookingId
  // from the fetched record, then hands off to the realBookingId poll effect below (which calls
  // its endpoint immediately on mount) for everything else — driver assignment, live location,
  // route, and further status transitions. A booking already at a terminal status (completed/
  // cancelled) is not resumed; that's no longer an "active" ride to protect.
  useEffect(() => {
    if (BOOKING_MODE !== 'real' || !isAuthenticated || !user?.id || realBookingId) return;
    const resumableStatuses = ['pending', 'accepted', 'arrived', 'in_transit'];
    let cancelled = false;
    passengerApi
      .getActiveBooking(user.id)
      .then((res: any) => {
        if (cancelled) return;
        const booking = res?.booking;
        if (!booking || !resumableStatuses.includes(booking.status)) return;

        setPickup({
          name: booking.pickup_name,
          lat: Number(booking.pickup_lat),
          lng: Number(booking.pickup_lng),
        });
        setDropoff({
          name: booking.dropoff_name,
          lat: Number(booking.dropoff_lat),
          lng: Number(booking.dropoff_lng),
        });
        setFareEstimate({
          base: 0,
          distanceFee: Number(booking.fare_amount ?? 0),
          total: Number(booking.fare_amount ?? 0),
          distanceKm: Number(booking.distance_km ?? 0),
          durationMinutes: Number(booking.estimated_duration_mins ?? 0),
        });
        setRealBookingId(booking.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Dynamic Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Dynamic E-Receipt state
  const [latestReceipt, setLatestReceipt] = useState<TripReceipt>(INITIAL_RECEIPT);

  // Rate & Review state
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('Mabait ang driver at maingat magmaneho.');
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([
    'Safe Driving',
    'Courteous',
    'Clean Trike',
  ]);

  // Fetches the real road route for a pickup/dropoff pair and, once it
  // resolves, refines the instant haversine-based fareEstimate with the
  // route's real distance (and real duration, when a real OSRM route was
  // found — the fallback keeps the existing flat-speed duration estimate).
  // Guarded by a request id so a fast second edit (e.g. rapid destination
  // changes) can't have its result overwritten by a slower, now-stale one.
  const refreshRoute = (origin: LocationPoint, destination: LocationPoint, zone: TodaZone) => {
    const requestId = ++routeRequestIdRef.current;
    fetchRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng }).then(
      (result) => {
        if (requestId !== routeRequestIdRef.current) return;
        setRouteCoordinates(result.coordinates);
        setRouteSource(result.source);
        const fare = calculateFare(result.distanceKm, zone);
        if (result.source === 'osrm') {
          fare.durationMinutes = result.durationMinutes;
        }
        setFareEstimate(fare);
      }
    );
  };

  // Seed an initial real route for the default pickup/dropoff pair so the
  // route screen has something real to draw even if the passenger jumps
  // straight into booking without picking a new destination first.
  useEffect(() => {
    refreshRoute(DEFAULT_PICKUP, DEFAULT_DROPOFF, TODA_ZONES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic Destination Selection
  const selectDestination = (dest: LocationPoint) => {
    setDropoff(dest);
    setHasDestination(true);
    const dist = calculateDistance(pickup, dest);
    // Matched TODA is always the geometrically nearest zone to the pickup — never a place's own
    // pre-assigned zoneCode, which can be stale or simply wrong (e.g. a "popular destination"
    // whose zoneCode was hand-curated and doesn't match its actual nearest zone center). Destination
    // changes recompute from the same pickup, so the TODA itself never changes here.
    const zone = findNearestZone(pickup, todaList);
    setMatchedToda(zone);
    const calculated = calculateFare(dist, zone);
    setFareEstimate(calculated);
    setScreenState('destination_select');
    refreshRoute(pickup, dest, zone);
  };

  // Dynamic Pickup Selection — always an explicit passenger action (search result, saved place
  // used as pickup via Pin on Map, or a manual map pin), so pickup no longer tracks GPS after this.
  const selectPickup = (pickupLoc: LocationPoint) => {
    setPickup(pickupLoc);
    setPickupMode('manual');
    const dist = calculateDistance(pickupLoc, dropoff);
    // Always the geometrically nearest zone to the new pickup — see selectDestination above.
    const zone = findNearestZone(pickupLoc, todaList);
    setMatchedToda(zone);
    const calculated = calculateFare(dist, zone);
    setFareEstimate(calculated);
    refreshRoute(pickupLoc, dropoff, zone);
  };

  // Re-fetches device GPS and sets it as pickup — the passenger's explicit way back to
  // "current_location" mode after having manually changed pickup (or the initial fetch when
  // booking starts). Ignores a stale reply if pickup has moved on again before it resolves.
  const useCurrentLocationForPickup = () => {
    const requestId = ++currentLocationRequestIdRef.current;
    return requestCurrentLocation().then((coords) => {
      if (!coords || requestId !== currentLocationRequestIdRef.current) return;

      setCurrentLat(coords.lat);
      setCurrentLng(coords.lng);

      const zone = findNearestZone(coords, todaList);
      // "Locating..." is a transient loading state, never the final label — reverseGeocode below
      // replaces it with the real resolved address. The passenger must never see the literal
      // words "Current Location" as their pickup.
      const loc: LocationPoint = {
        name: 'Locating your position…',
        address: 'Resolving address...',
        lat: coords.lat,
        lng: coords.lng,
        zoneCode: zone.code,
        category: 'Current',
      };
      setPickup(loc);
      setPickupMode('current_location');
      setMatchedToda(zone);
      const dist = calculateDistance(loc, dropoff);
      setFareEstimate(calculateFare(dist, zone));
      refreshRoute(loc, dropoff, zone);

      reverseGeocode(coords).then((geo) => {
        if (requestId !== currentLocationRequestIdRef.current) return;
        setPickup((prev) =>
          prev.category === 'Current' && prev.lat === coords.lat && prev.lng === coords.lng
            ? { ...prev, name: geo.address, address: geo.address }
            : prev
        );
      });
    });
  };

  // Retry action for Home's location-error state — identical to the initial fetch below, just
  // triggered manually. Named to match the Driver app's own retryLocation for the same role.
  const retryLocation = () => {
    useCurrentLocationForPickup();
  };

  // Real GPS, requested the moment the passenger is known — independent of which tab is showing,
  // so Home's initial loading state resolves even if the passenger isn't looking at Home yet.
  // Keyed on user?.id (not run on every render) so this fires exactly once per login, the same
  // way DriverShiftContext fetches the driver's initial fix once per driver?.id. currentLat/
  // currentLng staying null after this settles (permission denied/GPS unavailable) is exactly
  // what drives Home's error+retry state — no separate "ready" flag needed.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    useCurrentLocationForPickup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Swap Locations — the new pickup is whatever the destination was, a place the passenger
  // explicitly chose, so it's a manual pickup from here on, not GPS-tracked. No-ops while no
  // destination has actually been chosen yet — there's nothing real to swap into pickup, and
  // doing so would silently overwrite the passenger's real current-location pickup.
  const swapLocations = () => {
    if (!hasDestination) return;
    const oldPickup = pickup;
    const oldDropoff = dropoff;
    setPickup(oldDropoff);
    setDropoff(oldPickup);
    setPickupMode('manual');
    // The pickup just changed (it's now the old dropoff) — the matched TODA must be recomputed
    // from it, not left as whatever zone matched the previous pickup.
    const zone = findNearestZone(oldDropoff, todaList);
    setMatchedToda(zone);
    const dist = calculateDistance(oldDropoff, oldPickup);
    const calculated = calculateFare(dist, zone);
    setFareEstimate(calculated);
    refreshRoute(oldDropoff, oldPickup, zone);
  };

  const markNotificationRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const toggleCompliment = (tag: string) => {
    setSelectedCompliments((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addHistoryItem = (item: HistoryItem) => {
    setHistoryList((prev) => [item, ...prev]);
  };

  const startBookingFlow = () => {
    setScreenState('destination_select');
    // "Book a Tricycle" always starts a fresh destination pick — clears any destination left
    // over from an earlier pass through this flow (e.g. the passenger went back to Home without
    // completing a booking), so the destination screen opens with a real empty/unselected state
    // rather than silently reusing a stale one.
    setHasDestination(false);
    // Refresh pickup to a real GPS fix the moment booking starts — only while still in
    // current_location mode, so this never overwrites a pickup the passenger already
    // manually chose in an earlier pass through this flow.
    if (pickupMode === 'current_location') {
      useCurrentLocationForPickup();
    }
  };

  const confirmBooking = async (numberOfPassengers: number, farePerPassenger: number): Promise<void> => {
    if (BOOKING_MODE === 'simulated') {
      setScreenState('searching');
      setSearchCountdown(8);
      setSearchStatusText('Broadcasting to nearby tricycles in Bucana Zone...');
      return;
    }

    // Real mode: create the actual backend booking. screenState only moves to 'searching' once
    // the request succeeds — a failure keeps the passenger on the confirmation screen with a
    // real error instead of silently sliding into a fake search. matchedToda should already be
    // the geometrically nearest zone (kept in sync by selectPickup/selectDestination), but this
    // recomputes from pickup coordinates as a safety net rather than trusting stale state or a
    // place's own pre-assigned zoneCode.
    const pickupZone = matchedToda || findNearestZone(pickup, todaList);

    setSearchStatusText(`Broadcasting request to tricycles in ${pickupZone?.name || 'nearest TODA'}...`);
    try {
      const res: any = await passengerApi.requestBooking({
        pickup_name: pickup.name,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_name: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        passenger_count: numberOfPassengers,
        fare_per_passenger: farePerPassenger,
        distance_km: fareEstimate.distanceKm,
        estimated_duration_mins: fareEstimate.durationMinutes,
        payment_method: 'cash',
        toda_zone_id: pickupZone.id,
        // Previously never sent at all — the passenger could type a note here, but it stayed
        // local-only (noteToDriver state) and the backend's already-existing passenger_notes
        // column simply never received it, so the driver had nothing to see regardless of what
        // the driver app itself did with it.
        passenger_notes: noteToDriver.trim() || undefined,
      });
      setRealBookingId(res.booking.id);
      // Reset the display countdown fresh every time a search actually starts — otherwise a
      // search cancelled partway through (e.g. at 6s) would leave a stale low value that the
      // next search inherits instead of starting from the top.
      setSearchCountdown(REAL_SEARCH_CYCLE_SECONDS);
      setSearchCycleCount(1);
      setScreenState('searching');
    } catch (err: any) {
      showToast(err?.message || 'Could not create your booking. Please try again.', 'info');
    }
  };

  const cancelBooking = async (): Promise<boolean> => {
    if (BOOKING_MODE === 'real' && realBookingId) {
      try {
        await passengerApi.cancelBooking(realBookingId, 'Cancelled by passenger');
      } catch (err: any) {
        // Previously this fired the API call without awaiting it and moved to Home
        // unconditionally — a failed cancellation (network error, or the backend rejecting it)
        // would still show the passenger as "cancelled" while the booking stayed active
        // server-side. Now the screen only moves on once the backend has actually confirmed it.
        showToast(err?.message || 'Could not cancel this ride. Please check your connection and try again.', 'info');
        return false;
      }
      setRealBookingId(null);
    }
    setScreenState('home');
    return true;
  };

  const simulateDriverArrival = () => {
    setScreenState('driver_en_route');
    // Immediate defaults while the real route resolves, so the UI isn't stuck.
    setDriverDistanceKm(1.2);
    setDriverEtaMinutes(3);
    setDriverRouteTotalKm(1.2);
    setDriverRouteCoordinates([]);
    setLiveDriverLocation(null);

    // This demo has no real driver-location source, so synthesize a
    // plausible starting point near pickup (stable per driver id) and let
    // the routing service snap it onto the nearest real road.
    const requestId = ++driverRouteRequestIdRef.current;
    const bearing = (activeDriver.id * 47) % 360;
    const start = destinationPoint({ lat: pickup.lat, lng: pickup.lng }, bearing, 1.2);
    fetchRoute(start, { lat: pickup.lat, lng: pickup.lng }).then((result) => {
      if (requestId !== driverRouteRequestIdRef.current) return;
      setDriverRouteCoordinates(result.coordinates);
      setDriverRouteSource(result.source);
      setDriverRouteTotalKm(result.distanceKm);
      setDriverDistanceKm(result.distanceKm);
      setDriverEtaMinutes(result.durationMinutes);
    });
  };

  const fastForwardSearch = () => {
    simulateDriverArrival();
  };

  const startRideTransit = () => {
    setTripRemainingKm(fareEstimate.distanceKm);
    setTripRouteTotalKm(fareEstimate.distanceKm);
    setLiveDriverLocation(null);
    setScreenState('in_transit');
  };

  const completeRide = () => {
    const code = `TRV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newReceipt: TripReceipt = {
      bookingCode: code,
      date: dateStr,
      time: nowStr,
      pickup: pickup.name,
      dropoff: dropoff.name,
      distanceKm: fareEstimate.distanceKm,
      durationMinutes: fareEstimate.durationMinutes,
      baseFare: fareEstimate.base,
      distanceFee: fareEstimate.distanceFee,
      totalFare: fareEstimate.total,
      paymentMethod,
      driverName: activeDriver.name,
      plateNumber: activeDriver.tricycle.plateNumber,
      bodyNumber: activeDriver.tricycle.bodyNumber,
      todaName: activeDriver.todaName || 'TODA Bucana',
      mtopNumber: 'MTOP-2024-0412',
    };

    setLatestReceipt(newReceipt);

    // Add to history automatically
    const newHistoryItem: HistoryItem = {
      id: Date.now(),
      bookingCode: code,
      date: dateStr,
      pickup: pickup.name,
      dropoff: dropoff.name,
      fare: fareEstimate.total,
      distanceKm: fareEstimate.distanceKm,
      durationMinutes: fareEstimate.durationMinutes,
      status: 'Completed',
      driverName: activeDriver.name,
      plateNumber: activeDriver.tricycle.plateNumber,
      rating: null,
    };
    addHistoryItem(newHistoryItem);

    // Add notification
    const newNotif: NotificationItem = {
      id: Date.now(),
      title: 'Ride Completed & Receipt Ready',
      body: `Ride ${code} completed. Paid ₱${fareEstimate.total.toFixed(2)} via ${paymentMethod.toUpperCase()}.`,
      time: 'Just now',
      read: false,
      type: 'receipt',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    setScreenState('trip_completed');
  };

  // Driver-matching countdown: single source shared by SearchingDriversScreen
  // so it doesn't need its own local setInterval. Simulated mode counts down to exactly 0 once
  // (the effect below reacts to that to fabricate an arrival). Real mode has no single driver to
  // time out — the backend already broadcasts the pending booking to every eligible driver in
  // the zone and keeps it open to all of them — so instead of freezing at 00:00 once it reaches
  // zero, it loops back to a fresh cycle and keeps counting, for as long as the passenger keeps
  // waiting (a real acceptance is detected separately by the active-booking poll, and cancelling
  // navigates away from this screen entirely).
  useEffect(() => {
    if (screenState !== 'searching') return;
    if (BOOKING_MODE !== 'real' && searchCountdown <= 0) return;
    const timer = setTimeout(() => {
      setSearchCountdown((prev) => {
        if (prev > 1) return prev - 1;
        if (BOOKING_MODE === 'real') {
          setSearchCycleCount((c) => c + 1);
          return REAL_SEARCH_CYCLE_SECONDS;
        }
        return 0;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [screenState, searchCountdown]);

  // Status copy tracks the same countdown thresholds the screen used to
  // compute locally: broadcasting -> matched -> accepted. Simulation-only — in real mode this
  // text is set from actual booking state instead (see confirmBooking / the active-booking poll).
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState !== 'searching') return;
    if (searchCountdown > 5) {
      setSearchStatusText(
        `Broadcasting request to tricycles in ${matchedToda?.name || 'Bucana Zone'}...`
      );
    } else if (searchCountdown > 2) {
      setSearchStatusText(`Driver found nearby! Confirming dispatch with ${activeDriver.name}...`);
    } else {
      setSearchStatusText(
        `Driver ${activeDriver.name} (${activeDriver.tricycle.plateNumber}) accepted your ride!`
      );
    }
  }, [screenState, searchCountdown, matchedToda, activeDriver]);

  // Real mode: once the first cycle completes with no acceptance yet, make it visible to the
  // passenger that the app is still actively broadcasting to nearby TODA drivers rather than
  // having silently stalled — this is what fires each time the countdown loops.
  useEffect(() => {
    if (BOOKING_MODE !== 'real') return;
    if (screenState !== 'searching' || searchCycleCount <= 1) return;
    setSearchStatusText(
      `Still searching — broadcasting to more tricycles in ${matchedToda?.name || 'Bucana Zone'}...`
    );
  }, [searchCycleCount, screenState, matchedToda]);

  // Once a driver is matched, auto-advance into the en-route state. Simulation-only — in real
  // mode, "no driver accepted yet" must never fabricate one; the passenger just keeps searching
  // until the active-booking poll detects a real acceptance.
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState === 'searching' && searchCountdown === 0) {
      simulateDriverArrival();
    }
  }, [screenState, searchCountdown]);

  // Driver-approaching-pickup countdown: single source shared by DriverEnRouteScreen so it
  // doesn't need its own local setInterval. Simulation-only.
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState !== 'driver_en_route' || driverDistanceKm <= 0) return;
    const timer = setTimeout(() => {
      setDriverDistanceKm((prev) => (prev <= 0.3 ? 0 : Number((prev - 0.3).toFixed(1))));
      setDriverEtaMinutes((prev) => Math.max(0, prev - 1));
    }, 2800);
    return () => clearTimeout(timer);
  }, [screenState, driverDistanceKm]);

  // Once the driver reaches the pickup point, auto-advance to boarding/transit. Simulation-only —
  // in real mode this transition only happens when the driver's own app reports it for real.
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState === 'driver_en_route' && driverDistanceKm <= 0) {
      const timeout = setTimeout(() => startRideTransit(), 3500);
      return () => clearTimeout(timeout);
    }
  }, [screenState, driverDistanceKm]);

  // Derives the driver's live position from the countdown's progress along the real
  // driver->pickup route, so the map marker actually moves instead of sitting frozen while the
  // surrounding text counts down. Simulation-only — real-mode live location isn't wired yet
  // (see BookingContext's active-booking poll / the driver-dispatch analysis).
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState !== 'driver_en_route' || driverRouteCoordinates.length === 0) return;
    const progress = driverRouteTotalKm > 0 ? 1 - driverDistanceKm / driverRouteTotalKm : 1;
    setLiveDriverLocation(interpolateAlongRoute(driverRouteCoordinates, progress));
  }, [screenState, driverDistanceKm, driverRouteCoordinates, driverRouteTotalKm]);

  // In-transit-to-destination countdown: single source shared by ActiveRideScreen. Simulation-only.
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState !== 'in_transit' || tripRemainingKm <= 0) return;
    const timer = setTimeout(() => {
      setTripRemainingKm((prev) => (prev <= 0.3 ? 0 : Number((prev - 0.3).toFixed(1))));
    }, 2800);
    return () => clearTimeout(timer);
  }, [screenState, tripRemainingKm]);

  // Once the destination is reached, auto-complete the ride. Simulation-only — in real mode,
  // completion only happens when the driver's own app reports it for real.
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState === 'in_transit' && tripRemainingKm <= 0) {
      const timeout = setTimeout(() => completeRide(), 3200);
      return () => clearTimeout(timeout);
    }
  }, [screenState, tripRemainingKm]);

  // Same live-position derivation for the in-transit leg, reusing the already-fetched
  // pickup->dropoff route rather than fetching a new one. Simulation-only.
  useEffect(() => {
    if (BOOKING_MODE !== 'simulated') return;
    if (screenState !== 'in_transit' || routeCoordinates.length === 0) return;
    const progress = tripRouteTotalKm > 0 ? 1 - tripRemainingKm / tripRouteTotalKm : 1;
    setLiveDriverLocation(interpolateAlongRoute(routeCoordinates, progress));
  }, [screenState, tripRemainingKm, routeCoordinates, tripRouteTotalKm]);

  // Real-mode active-booking polling: the single loop that discovers pending -> accepted ->
  // arrived -> in_transit -> completed/cancelled transitions from the backend and drives
  // screenState/activeDriver accordingly. Runs only while there's a real booking to track —
  // realBookingId is cleared (by this effect itself, or by cancelBooking/resetToHome/
  // finishReview) on every terminal outcome, which tears the interval down naturally via the
  // dependency array below, so no separate screenState guard is needed here at all. Using the
  // functional setScreenState((prev) => ...) form means screenState itself never needs to be a
  // dependency, so this effect is NOT torn down and recreated on every phase transition — only
  // one interval ever runs per realBookingId.
  useEffect(() => {
    // isAuthenticated guards against this outliving a logout — BookingProvider wraps the whole
    // app and never unmounts on its own, so without this a booking left active through a logout
    // (or a stale realBookingId from a previous account on a shared device) would keep polling
    // with a cleared auth token indefinitely instead of stopping the moment the session ends.
    if (BOOKING_MODE !== 'real' || !realBookingId || !isAuthenticated) return;

    let cancelled = false;
    // Guards against an in-flight request resolving after a NEWER one already has — e.g. a slow
    // response for tick N arriving after tick N+1's faster response was already applied.
    const requestId = ++realBookingPollRequestIdRef.current;

    const poll = async () => {
      try {
        const res: any = await passengerApi.getActiveBooking(undefined, realBookingId);
        if (cancelled || requestId !== realBookingPollRequestIdRef.current) return;
        const booking = res?.booking;
        if (!booking) return;

        if (booking.status === 'cancelled') {
          showToast('Your ride was cancelled.', 'info');
          setRealBookingId(null);
          setScreenState('home');
          return;
        }

        const driverProfile = mapBookingDriverToProfile(booking);
        const isPickupPhase = booking.status === 'accepted' || booking.status === 'arrived';
        const isTransitPhase = booking.status === 'in_transit';
        const hasRealDriverFix = booking.driver?.current_lat != null && booking.driver?.current_lng != null;

        if (driverProfile) {
          const distanceKm = Number(calculateDistance(
            { name: '', lat: booking.driver.current_lat ?? pickup.lat, lng: booking.driver.current_lng ?? pickup.lng },
            pickup
          ).toFixed(1));
          setActiveDriver({
            ...driverProfile,
            distanceKm,
            etaMinutes: Math.max(1, Math.round((distanceKm / 20) * 60)),
          });

          // Backend status is authoritative for the pickup phase, not the raw distance number —
          // 'arrived' always reads as 0 km / 0 min regardless of the computed distance, and
          // DriverEnRouteScreen's existing `hasArrived = driverDistanceKm <= 0` check (unchanged,
          // same as simulated mode) is what actually flips its UI between "en route" and
          // "arrived — waiting for you" once that happens.
          if (booking.status === 'arrived') {
            setDriverDistanceKm(0);
            setDriverEtaMinutes(0);
          } else if (booking.status === 'accepted') {
            setDriverDistanceKm(Math.max(0.1, distanceKm));
            setDriverEtaMinutes(Math.max(1, Math.round((distanceKm / 20) * 60)));
          }
        }

        if (isPickupPhase && hasRealDriverFix) {
          // The driver's REAL backend position — never the passenger's own location, never
          // pickup, never a synthesized/simulated point.
          const driverPos = { lat: Number(booking.driver.current_lat), lng: Number(booking.driver.current_lng) };
          const heading = bearingDegrees(driverPos, { lat: pickup.lat, lng: pickup.lng });
          setLiveDriverLocation({ ...driverPos, heading });

          // Refetch the real road route only once the driver has moved meaningfully from where
          // it was last fetched (or this is the first fix for this booking) — not on every poll
          // tick, which would spam the routing service and fight the map's own camera framing
          // with a route update on every 4s tick even when nothing actually changed.
          const lastOrigin = driverRouteOriginRef.current;
          const movedFarEnough = !lastOrigin || haversineKm(lastOrigin, driverPos) >= DRIVER_ROUTE_REROUTE_THRESHOLD_KM;
          if (movedFarEnough) {
            driverRouteOriginRef.current = driverPos;
            const requestId = ++driverRouteRequestIdRef.current;
            fetchRoute(driverPos, { lat: pickup.lat, lng: pickup.lng }).then((result) => {
              if (requestId !== driverRouteRequestIdRef.current) return;
              setDriverRouteCoordinates(result.coordinates);
              setDriverRouteSource(result.source);
              setDriverRouteTotalKm(result.distanceKm);
            });
          }
        } else if (!isPickupPhase) {
          // Leaving the pickup phase (in_transit/completed) — reset so a later new booking's
          // first poll doesn't skip its route fetch because of a stale origin from this ride.
          driverRouteOriginRef.current = null;
        }

        if (isTransitPhase && hasRealDriverFix) {
          // Same live-tracking pattern as the pickup phase above, now aimed at the dropoff —
          // the tricycle marker follows the driver's real position toward pickup while en
          // route, then toward the destination once in transit, instead of freezing wherever it
          // was when the ride started.
          const driverPos = { lat: Number(booking.driver.current_lat), lng: Number(booking.driver.current_lng) };
          const heading = bearingDegrees(driverPos, { lat: dropoff.lat, lng: dropoff.lng });
          setLiveDriverLocation({ ...driverPos, heading });

          const lastOrigin = dropoffRouteOriginRef.current;
          const movedFarEnough = !lastOrigin || haversineKm(lastOrigin, driverPos) >= DRIVER_ROUTE_REROUTE_THRESHOLD_KM;
          if (movedFarEnough) {
            dropoffRouteOriginRef.current = driverPos;
            const requestId = ++dropoffRouteRequestIdRef.current;
            fetchRoute(driverPos, { lat: dropoff.lat, lng: dropoff.lng }).then((result) => {
              if (requestId !== dropoffRouteRequestIdRef.current) return;
              // Reusing routeCoordinates/routeSource — ActiveRideScreen already reads these as
              // "the route to draw"; in real mode nothing else needs the original static
              // pickup->dropoff planned route once the ride is actually in transit.
              setRouteCoordinates(result.coordinates);
              setRouteSource(result.source);
              setTripRemainingKm(result.distanceKm);
            });
          }
        } else if (isTransitPhase) {
          // No driver GPS fix yet this tick — fall back to the full trip distance so
          // ActiveRideScreen's `hasArrivedDestination = tripRemainingKm <= 0` check doesn't read
          // as "arrived" the instant the ride starts.
          setTripRemainingKm(Number(booking.distance_km ?? fareEstimate.distanceKm) || 0.1);
        } else {
          dropoffRouteOriginRef.current = null;
        }

        if (booking.status === 'completed') {
          // The Driver app's own history mapper (mapBookingRecordToHistoryItem) already uses
          // completed_at as the ride's history timestamp, falling back to cancelled_at/
          // requested_at — this previously used requested_at unconditionally, which is a
          // DIFFERENT timestamp for the same booking (when it was first requested, not when it
          // actually happened), causing Passenger and Driver to show different times for the
          // identical ride. Matching the same field + fallback chain keeps both apps deriving
          // the displayed time from the same source of truth.
          const rideAt = booking.completed_at || booking.cancelled_at || booking.requested_at;
          const rideDate = rideAt ? new Date(rideAt) : new Date();
          const receipt: TripReceipt = {
            bookingCode: booking.booking_code,
            date: rideDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: rideDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            pickup: booking.pickup_name,
            dropoff: booking.dropoff_name,
            distanceKm: Number(booking.distance_km ?? fareEstimate.distanceKm),
            durationMinutes: fareEstimate.durationMinutes,
            baseFare: fareEstimate.base,
            distanceFee: fareEstimate.distanceFee,
            totalFare: Number(booking.fare_amount ?? fareEstimate.total),
            paymentMethod: 'cash',
            driverName: driverProfile?.name || activeDriver.name,
            plateNumber: driverProfile?.tricycle.plateNumber || activeDriver.tricycle.plateNumber,
            bodyNumber: driverProfile?.tricycle.bodyNumber || activeDriver.tricycle.bodyNumber,
            todaName: driverProfile?.todaName || activeDriver.todaName || 'TODA Bucana',
            mtopNumber: booking.tricycle?.or_number || '',
          };
          setLatestReceipt(receipt);
          addHistoryItem({
            id: booking.id,
            bookingCode: booking.booking_code,
            date: receipt.date,
            time: receipt.time,
            pickup: booking.pickup_name,
            dropoff: booking.dropoff_name,
            fare: receipt.totalFare,
            distanceKm: receipt.distanceKm,
            durationMinutes: receipt.durationMinutes,
            status: 'Completed',
            driverName: receipt.driverName,
            plateNumber: receipt.plateNumber,
            rating: null,
          });
          // Kept until the rating is actually submitted (finishReview), unlike realBookingId
          // which is cleared right below to stop polling.
          setBookingIdToRate(booking.id);
          // Ride is done — stop polling naturally (tears this effect down via the dependency
          // array) instead of continuing to hit an endpoint with nothing left to change.
          setRealBookingId(null);
          // total_rides (and any other booking-derived profile stat) just changed on the backend
          // — refetch now instead of waiting for the passenger to happen to reopen Profile, so it
          // reads correctly the moment they do.
          refreshProfile();
        }

        const nextState = mapBackendStatusToScreenState(booking.status);
        setScreenState((prev) => (nextState && nextState !== prev ? nextState : prev));
      } catch {
        // Transient network hiccup — keep polling, don't drop the passenger out of the flow.
      }
    };

    poll();
    const interval = setInterval(poll, ACTIVE_BOOKING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [realBookingId, isAuthenticated]);

  // Entry point for rating an already-completed ride from Ride History (as opposed to the
  // immediate post-ride flow, which sets bookingIdToRate itself the moment the active-booking
  // poll sees 'completed'). Explicitly recording WHICH booking is being rated here — rather than
  // letting RateReviewScreen assume "whatever the last-known one was" — is what makes rating an
  // older, non-most-recent ride submit against the correct booking instead of silently doing
  // nothing or overwriting the wrong history row.
  const startRatingBooking = (bookingId: number | string) => {
    setBookingIdToRate(bookingId);
    setScreenState('rate_review');
  };

  const finishReview = () => {
    const bookingId = bookingIdToRate;

    // Optimistic — matched by the specific booking id being rated, not "whichever entry happens
    // to be first in the list", so rating an older ride from History can never overwrite a
    // different, unrelated entry. Real persistence happens via the API call below; the backend
    // remains authoritative — a later fetch (tab switch, reload, background poll) reflects
    // whatever is actually in `ride_ratings`, not this local mutation.
    if (bookingId != null) {
      setHistoryList((prev) =>
        prev.map((item) => (item.id === bookingId ? { ...item, rating: selectedRating } : item))
      );
    }

    // This previously guarded on lastCompletedBookingId, which was only ever set right when a
    // ride completed and was never persisted — rating anything other than the single most-
    // recently-completed ride in the same session (e.g. an older ride from History, or ANY ride
    // after an app reload) meant this guard was false and the API call never fired at all, so the
    // rating only ever existed in the optimistic local state above and vanished on the next real
    // fetch. bookingIdToRate is now set correctly for both entry points (see startRatingBooking),
    // so this actually reaches the backend every time.
    if (BOOKING_MODE === 'real' && bookingId != null) {
      passengerApi.rateRide(bookingId, selectedRating, selectedCompliments, reviewComment).catch(() => {
        showToast('Could not submit your rating. Please try again from Ride History.', 'info');
      });
    }

    setBookingIdToRate(null);
    setRealBookingId(null);
    setScreenState('home');
  };

  const resetToHome = () => {
    setRealBookingId(null);
    setScreenState('home');
  };

  return (
    <BookingContext.Provider
      value={{
        screenState,
        setScreenState,
        pickup,
        setPickup,
        dropoff,
        setDropoff,
        hasDestination,
        pickupMode,
        isLocatingPickup,
        locationError,
        currentLat,
        currentLng,
        useCurrentLocationForPickup,
        retryLocation,
        matchedToda,
        setMatchedToda,
        fareEstimate,
        paymentMethod,
        setPaymentMethod,
        noteToDriver,
        setNoteToDriver,
        activeDriver,
        historyList,
        addHistoryItem,
        searchCountdown,
        searchStatusText,
        driverDistanceKm,
        driverEtaMinutes,
        tripRemainingKm,
        routeCoordinates,
        routeSource,
        driverRouteCoordinates,
        driverRouteSource,
        liveDriverLocation,
        selectDestination,
        selectPickup,
        swapLocations,
        selectedRating,
        setSelectedRating,
        reviewComment,
        setReviewComment,
        selectedCompliments,
        toggleCompliment,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        latestReceipt,
        startBookingFlow,
        confirmBooking,
        cancelBooking,
        simulateDriverArrival,
        startRideTransit,
        completeRide,
        startRatingBooking,
        finishReview,
        resetToHome,
        fastForwardSearch,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking(): BookingContextType {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
