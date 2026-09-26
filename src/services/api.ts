import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { DriverProfile, UserProfile, HistoryItem, SavedPlace, TodaZone } from '../types';
import { TODA_ZONES } from '../constants/todaRoutes';

function getDefaultApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  const isPlaceholder = Boolean(envUrl && envUrl.includes('your-ngrok-url'));

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000/api/v1';
      }
      if (hostname && (!envUrl || isPlaceholder)) {
        return `http://${hostname}:8000/api/v1`;
      }
    }
    if (envUrl && !isPlaceholder) {
      return envUrl;
    }
    return 'http://localhost:8000/api/v1';
  }

  if (envUrl && !isPlaceholder) {
    return envUrl;
  }

  // In Expo Go on physical device, hostUri holds the development machine's LAN IP
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000/api/v1`;
    }
  }

  // Fallback for Android emulator connecting to host PC
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }

  return 'http://localhost:8000/api/v1';
}

let API_BASE_URL = getDefaultApiBaseUrl();

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  // FormData bodies (profile photo upload) must NOT get a manual Content-Type — fetch/RN needs
  // to set 'multipart/form-data; boundary=...' itself, which only happens when the header is
  // absent (same convention as the Driver app's own request() helper).
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    Accept: 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = (data && data.message) || `HTTP error ${response.status}`;
    const err = new Error(errorMsg) as any;
    err.data = data;
    err.status = response.status;
    throw err;
  }

  return data as T;
}

/**
 * Appends a locally-picked file to a FormData body. On native, RN's networking layer understands
 * the `{uri, name, type}` object shape directly. On web, it does not — an expo-image-picker
 * asset's `uri` there is a blob:/data: URL, and appending that object as-is produces no real file
 * part at all (the backend's `image` validation then fails outright, even for a genuinely valid
 * picture), so it must be fetched into a real Blob first.
 */
async function appendFileToFormData(
  form: FormData,
  fieldName: string,
  file: { uri: string; name: string; type: string }
): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    form.append(fieldName, blob, file.name);
  } else {
    form.append(fieldName, { uri: file.uri, name: file.name, type: file.type } as any);
  }
}

export const passengerApi = {
  login: async (email: string, password: string) => {
    return request('/passenger/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (payload: {
    name: string;
    email: string;
    mobile_number: string;
    password: string;
    terms_accepted: boolean;
    privacy_policy_accepted: boolean;
  }) => {
    return request('/passenger/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Validates the current token and returns the passenger's latest profile — used to restore a
   * session after a cold start (app relaunch/reload) instead of forcing a fresh login. */
  me: async () => {
    return request('/passenger/me');
  },

  logout: async () => {
    return request('/passenger/logout', { method: 'POST' });
  },

  /** Persists the Emergency Contact fields to the authenticated passenger's own record — the
   * only Edit Profile field that previously had no backend write path at all. */
  updateProfile: async (payload: { emergency_contact_name?: string; emergency_contact_phone?: string }) => {
    return request('/passenger/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  requestBooking: async (bookingData: any) => {
    return request('/passenger/bookings/request', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  getActiveBooking: async (passengerId?: number, bookingId?: number | string) => {
    const params = new URLSearchParams();
    if (passengerId) params.append('passenger_id', String(passengerId));
    if (bookingId) params.append('booking_id', String(bookingId));
    return request(`/passenger/bookings/active?${params.toString()}`);
  },

  cancelBooking: async (bookingId: number | string, reason = 'Cancelled by passenger') => {
    return request(`/passenger/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ status: 'cancelled', cancellation_reason: reason }),
    });
  },

  // Body shape must match the backend's actual validation (`score`, `feedback_tags`, `comment`)
  // — this previously sent `{ rating, feedback }`, which the backend would have rejected with a
  // 422 (score is required) had anything ever actually called this function.
  rateRide: async (bookingId: number | string, score: number, feedbackTags: string[] = [], comment = '') => {
    return request(`/passenger/bookings/${bookingId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ score, feedback_tags: feedbackTags, comment }),
    });
  },

  getHistory: async (passengerId?: number) => {
    const params = new URLSearchParams();
    if (passengerId) params.append('passenger_id', String(passengerId));
    return request(`/passenger/bookings/history?${params.toString()}`);
  },

  getSavedPlaces: async () => {
    return request('/passenger/saved-places');
  },

  createSavedPlace: async (payload: { label: string; address: string; latitude: number; longitude: number }) => {
    return request('/passenger/saved-places', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSavedPlace: async (
    id: number | string,
    payload: { label: string; address: string; latitude: number; longitude: number }
  ) => {
    return request(`/passenger/saved-places/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteSavedPlace: async (id: number | string) => {
    return request(`/passenger/saved-places/${id}`, { method: 'DELETE' });
  },

  /** `photo` is a local file URI from the image picker/camera. Replaces any existing photo. */
  uploadProfilePhoto: async (photo: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    await appendFileToFormData(form, 'photo', photo);
    return request('/passenger/profile-photo', {
      method: 'POST',
      body: form,
    });
  },

  removeProfilePhoto: async () => {
    return request('/passenger/profile-photo', { method: 'DELETE' });
  },
};

/** Maps a raw saved_places row into the app's SavedPlace shape. */
export function mapSavedPlaceRecordToSavedPlace(raw: any): SavedPlace {
  return {
    id: raw.id,
    label: raw.label,
    address: raw.address,
    lat: Number(raw.latitude),
    lng: Number(raw.longitude),
  };
}

/**
 * Parses the backend's single `passengers.emergency_contact` string (stored as "Name (Phone)",
 * the same convention already used by UsersSeeder) into the app's `{ name, phone }` shape. The
 * column stays the one source of truth — this split only exists for display/editing.
 */
export function parseEmergencyContact(raw: string | null | undefined): { name: string; phone: string } {
  if (!raw) return { name: '', phone: '' };
  const match = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (match) return { name: match[1].trim(), phone: match[2].trim() };
  return { name: raw.trim(), phone: '' };
}

/** Maps a raw passenger login/register API response into the app's UserProfile shape. */
export function mapAuthResponseToUserProfile(res: any, fallbackEmail?: string): UserProfile {
  const user = res.user || {};
  return {
    id: user.id,
    name: user.name || 'Passenger',
    email: user.email || fallbackEmail || '',
    mobile: user.mobile_number || '',
    avatarUrl: user.profile_photo_url || undefined,
    rating: Number(user.rating ?? 5.0),
    totalRides: Number(user.total_rides ?? 0),
    memberSince: user.member_since || undefined,
    emergencyContact: parseEmergencyContact(user.emergency_contact),
  };
}

/**
 * Maps a raw Eloquent Booking record (from GET /passenger/bookings/active, with `driver.user`
 * and `tricycle` eager-loaded) into the app's DriverProfile shape — mirrors the Driver app's own
 * `mapBookingRecordToIncoming`. Returns null when the booking has no assigned driver yet (still
 * `pending`), so callers only ever populate `activeDriver` with a real, backend-confirmed driver.
 */
export function mapBookingDriverToProfile(booking: any): DriverProfile | null {
  const driver = booking?.driver;
  if (!driver) return null;

  const driverUser = driver.user || {};
  const tricycle = booking.tricycle || {};

  return {
    id: driver.id,
    name: driverUser.name || 'Driver',
    avatarUrl: driverUser.profile_photo_url || undefined,
    mobile: driver.mobile_number || '',
    rating: Number(driver.rating ?? 5.0),
    trips: Number(driver.total_trips ?? 0),
    tricycle: {
      plateNumber: tricycle.plate_number || 'N/A',
      codingNumber: tricycle.coding_scheme_number || tricycle.body_number || 'N/A',
      model: tricycle.make_model || `${tricycle.make || ''} ${tricycle.model || ''}`.trim() || 'N/A',
    },
    distanceKm: 0,
    etaMinutes: 0,
  };
}

/**
 * Maps a raw Eloquent Booking record (from GET /passenger/bookings/history, with `driver.user`,
 * `tricycle` and `rating` eager-loaded) into the app's HistoryItem shape — mirrors the Driver
 * app's own `mapBookingRecordToHistoryItem`, using the same completed_at-first fallback chain so
 * both apps derive the same displayed time for the same booking.
 */
export function mapBookingRecordToHistoryItem(raw: any): HistoryItem {
  const driverUser = raw.driver?.user || {};
  const rideAt = raw.completed_at || raw.cancelled_at || raw.requested_at;
  const rideDate = rideAt ? new Date(rideAt) : new Date();

  return {
    id: raw.id,
    bookingCode: raw.booking_code,
    date: rideDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: rideDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    pickup: raw.pickup_name,
    dropoff: raw.dropoff_name,
    fare: Number(raw.fare_amount ?? 0),
    distanceKm: Number(raw.distance_km ?? 0),
    durationMinutes: Number(raw.estimated_duration_mins ?? 0),
    status: raw.status === 'completed' ? 'Completed' : 'Cancelled',
    driverName: driverUser.name || undefined,
    plateNumber: raw.tricycle?.plate_number || undefined,
    rating: raw.rating?.score != null ? Number(raw.rating.score) : null,
  };
}

export async function fetchTodaZones(): Promise<TodaZone[]> {
  return [];
}
