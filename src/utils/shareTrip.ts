import { Platform, Share } from 'react-native';

export interface TripShareDetails {
  driverName?: string | null;
  plateNumber?: string | null;
  unitNumber?: string | null;
  todaName?: string | null;
  pickup?: string | null;
  destination?: string | null;
  status?: string | null;
}

/** 'shared' = share sheet handled it, 'copied' = text copied to clipboard (web fallback), 'unavailable' = nothing worked. */
export type ShareTripResult = 'shared' | 'copied' | 'unavailable';

/** Builds the plain-text trip summary from the details the app actually has — blank fields are left out. */
export function buildTripShareText(d: TripShareDetails): string {
  const line = (label: string, value?: string | null) => (value?.trim() ? `${label}: ${value.trim()}` : null);
  return [
    'Trivora trip details',
    line('Driver', d.driverName),
    line('Plate No.', d.plateNumber),
    line('Unit No.', d.unitNumber),
    line('TODA', d.todaName),
    line('Pick-up', d.pickup),
    line('Destination', d.destination),
    d.status?.trim() || null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Opens the native share sheet with the trip summary. On web, uses the Web Share API when the
 * browser has it, otherwise copies the text to the clipboard.
 */
export async function shareTripDetails(details: TripShareDetails): Promise<ShareTripResult> {
  return shareText('Trivora trip details', buildTripShareText(details));
}

/** Shares plain text: native share sheet, Web Share API, or clipboard copy on web. */
export async function shareText(title: string, message: string): Promise<ShareTripResult> {
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    try {
      if (nav?.share) {
        await nav.share({ title, text: message });
        return 'shared';
      }
    } catch (e: any) {
      // The user closed the share dialog — that's not a failure.
      if (e?.name === 'AbortError') return 'shared';
    }
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(message);
        return 'copied';
      }
    } catch {
      // fall through
    }
    return 'unavailable';
  }

  try {
    await Share.share({ message, title });
    return 'shared';
  } catch {
    return 'unavailable';
  }
}
