/**
 * Reads the token out of a scanned Trivora "Scan to Ride" QR — the full public URL
 * `https://<app domain>/ride/q/{token}` printed by the TMO (never the token alone, never a driver).
 *
 * Only the path shape is checked here; the host isn't pinned so development and production QRs
 * both work. Nothing in the QR is trusted beyond that: the token is resolved server-side
 * (GET /passenger/qr-rides/tricycle/{token}), which decides what tricycle it is and whether it
 * may take passengers. Returns null for anything that isn't a Trivora ride QR.
 */
// A plain regex rather than `new URL()`: React Native's URL polyfill doesn't implement `pathname`.
const RIDE_QR_URL = /^https?:\/\/[^/\s?#]+\/ride\/q\/([A-Za-z0-9]{20,64})\/?(?:[?#][^\s]*)?$/i;

export function parseRideQrToken(data: string | null | undefined): string | null {
  const match = RIDE_QR_URL.exec((data || '').trim());
  return match ? match[1] : null;
}

/** "Honda TMX 125 · Red" — only the parts the server actually returned. */
export function describeTricycle(t: { make: string | null; model: string | null; body_color: string | null } | null): string {
  if (!t) return 'Tricycle';
  const vehicle = [t.make, t.model].filter(Boolean).join(' ');
  return [vehicle || 'Tricycle', t.body_color].filter(Boolean).join(' · ');
}

export function formatPeso(amount: number | null | undefined): string {
  return `₱${Number(amount ?? 0).toFixed(2)}`;
}
