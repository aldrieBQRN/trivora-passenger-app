import Echo from 'laravel-echo';
import PusherImport from 'pusher-js';
import { getApiBaseUrl, getAuthToken } from './api';

// pusher-js ships different builds per platform: the web build exports the Pusher class itself,
// but the React Native build Metro resolves on Android/iOS exports it as a named property
// (`module.exports.Pusher = …`). A default import therefore yields `{ Pusher }` on native — not a
// constructor — and Echo's `new window.Pusher(...)` threw the first time a channel was opened
// (the moment a driver accepted the booking), crashing the release APK.
const Pusher: typeof PusherImport = (PusherImport as any)?.Pusher ?? PusherImport;

// In React Native / mobile environment, expose Pusher globally so Echo finds it
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Pusher = Pusher;
}
if (typeof global !== 'undefined') {
  (global as any).Pusher = Pusher;
}
if (typeof window !== 'undefined') {
  (window as any).Pusher = Pusher;
}

export interface DriverLocationEventPayload {
  booking_id: number;
  driver_id: number;
  tricycle_id: number;
  latitude: number;
  longitude: number;
  heading_deg: number | null;
  recorded_at: string;
  /** Server road-route distance/ETA to pick-up (Booking::pickupEta) — null unless 'accepted'. */
  pickup_distance_km?: number | null;
  pickup_eta_mins?: number | null;
}

let echoInstance: Echo<'reverb'> | null = null;

function getReverbHost(): string {
  const envHost = process.env.EXPO_PUBLIC_REVERB_HOST?.trim();
  if (envHost) return envHost;

  const apiUrl = getApiBaseUrl();
  const match = apiUrl.match(/^https?:\/\/([^/:]+)/i);
  return match ? match[1] : '127.0.0.1';
}

function getReverbPort(): number {
  const envPort = process.env.EXPO_PUBLIC_REVERB_PORT;
  if (envPort) {
    const p = parseInt(envPort, 10);
    if (!isNaN(p)) return p;
  }
  // Production (https) reaches Reverb through the web server's nginx proxy on 443;
  // local dev talks to `php artisan reverb:start` directly on 8080.
  return getReverbScheme() === 'https' ? 443 : 8080;
}

function getReverbScheme(): 'http' | 'https' {
  const envScheme = process.env.EXPO_PUBLIC_REVERB_SCHEME;
  if (envScheme === 'https' || envScheme === 'http') return envScheme;
  const apiUrl = getApiBaseUrl();
  return apiUrl.startsWith('https://') ? 'https' : 'http';
}

const DEFAULT_REVERB_KEY = 'ysbbrwfe2zovsygafcnn';
function getReverbKey(): string {
  return process.env.EXPO_PUBLIC_REVERB_KEY || DEFAULT_REVERB_KEY;
}

export function getEcho(): Echo<'reverb'> {
  if (echoInstance) {
    return echoInstance;
  }

  const host = getReverbHost();
  const port = getReverbPort();
  const scheme = getReverbScheme();
  const key = getReverbKey();

  if (__DEV__) {
    console.log(`[Echo] Initializing Reverb client => host: ${host}, port: ${port}, scheme: ${scheme}, key: ${key}`);
  }

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: any) => {
      return {
        authorize: (socketId: string, callback: (error: any, authData: any) => void) => {
          const token = getAuthToken();
          const authUrl = `${getApiBaseUrl()}/broadcasting/auth`;
          if (__DEV__) {
            console.log(`[Echo] Authorizing channel ${channel.name} at ${authUrl}`);
          }
          fetch(authUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channel.name,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text();
                throw new Error(`Broadcast auth HTTP ${res.status}: ${text}`);
              }
              return res.json();
            })
            .then((data) => callback(null, data))
            .catch((err) => {
              if (__DEV__) {
                console.warn(`[Echo] Channel authorization failed for ${channel.name}:`, err.message);
              }
              callback(err, null);
            });
        },
      };
    },
  });

  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {
      // ignore
    }
    echoInstance = null;
  }
}
