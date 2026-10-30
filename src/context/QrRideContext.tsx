import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { passengerApi } from '../services/api';
import { useAuth } from './AuthContext';
import { useBooking } from './BookingContext';
import { useToast } from '../components/Toast';
import { parseRideQrToken } from '../utils/qrRide';
import { LocationPoint, PaymentMethod, QrActiveRide, QrQuote, QrScanResult } from '../types';

/**
 * QR Ride / Scan to Ride state — a separate, small flow next to the normal booking flow
 * (BookingContext), which it never touches. Everything shown comes from /passenger/qr-rides/*:
 * the app never computes fares, distances, capacity or pick-up points itself.
 *
 *   idle -> scan (camera) -> setup (tricycle, destination, party size, server quote, Join)
 *        -> ride (waiting for Start Ride -> riding -> dropped off, payment pending -> paid
 *           [Rate Driver / Home] | cancelled) -> idle
 * All of 'ride' is the one QrRideScreen; payment is a state of it, not a separate page.
 *
 * Drop-off is NOT the end of the passenger's flow: the booking is 'completed' but its payment can
 * still be unpaid, so the ride is kept (and polled) until payment_status = 'paid'. The passenger
 * can minimize an unfinished ride to Home (stage 'idle' with `ride` kept) and resume it from
 * Home's active-ride bar; on launch the backend's active QR ride is restored.
 *
 * The scanned token lives only in memory (a ref) and is never rendered.
 */

export type QrStage = 'idle' | 'scan' | 'setup' | 'ride';

export interface QrError {
  code: string | null;
  message: string;
}

/** Same cadence as the normal ride's active-booking poll (BookingContext ACTIVE_BOOKING_POLL_MS).
 * Also the cadence for re-checking a scanned tricycle's availability while the setup screen is
 * open, so filling seats are reflected live before a passenger joins. */
export const QR_RIDE_POLL_MS = 5000;

/** Still part of the passenger's flow: seated, or dropped off with the driver yet to confirm payment. */
export function isQrRideUnfinished(ride: QrActiveRide | null): boolean {
  if (!ride) return false;
  const { status, payment_status } = ride.booking;
  if (status === 'accepted' || status === 'in_transit') return true;
  return status === 'completed' && payment_status !== 'paid';
}

interface QrRideContextType {
  stage: QrStage;
  scan: QrScanResult | null;
  scanError: QrError | null;
  isResolving: boolean;
  quote: QrQuote | null;
  quoteError: QrError | null;
  isQuoting: boolean;
  /** Signature (destination + party size) of the exact request that produced the current `quote`;
   *  null when there is no quote. The quote is only a confirmed fare for a selection whose
   *  signature equals this — an older response can never validate a newer selection. */
  quoteSignature: string | null;
  joinError: QrError | null;
  isJoining: boolean;
  ride: QrActiveRide | null;
  isLeaving: boolean;
  openScanner: () => void;
  closeQr: () => void;
  /** Handles a raw scanned QR value. Returns false (and stays on the scanner) when it isn't a
   * Trivora ride QR, so the camera can keep looking. */
  submitScannedData: (data: string) => boolean;
  /** Re-resolves the scanned tricycle. Pass `{ silent: true }` for background re-checks (live
   * availability polling) that keep the current scan + quote on screen and swallow failures —
   * the visible "Check Again" / Join paths surface problems themselves. */
  refreshScan: (opts?: { silent?: boolean }) => Promise<void>;
  /** `passengerLocation.name`: the place name of where the passenger boards (pick-up label). */
  requestQuote: (destination: LocationPoint, partySize: number, passengerLocation: { lat: number; lng: number; name?: string | null }, signature: string) => Promise<void>;
  clearQuote: () => void;
  /** Joins only when the held quote belongs to `expectedSignature` (the selection now on screen)
   *  and no refresh is in progress; otherwise it is a no-op. */
  joinRide: (expectedSignature: string | null, paymentMethod?: PaymentMethod | string) => Promise<void>;
  leaveRide: () => Promise<boolean>;
  finishRide: () => void;
  /** Go to Home without abandoning the ride; it stays polled and resumable from Home. */
  minimizeRide: () => void;
  /** Reopen the kept ride (QR ride screen, or the payment screen once dropped off). */
  resumeRide: () => void;
}

const QrRideContext = createContext<QrRideContextType | null>(null);

function toQrError(err: any, fallback: string): QrError {
  // A server-side timeout is its own outcome — never conflated with a user-triggered cancel
  // (which the callers swallow) or a generic connection failure.
  if (err?.name === 'TimeoutError' || err?.code === 'timeout') {
    return { code: 'timeout', message: fallback };
  }
  if (err && err.status === undefined) {
    return { code: 'network', message: 'Could not reach Trivora. Check your connection and try again.' };
  }
  // Only the QR Ride API's own rejections ({ message, code }) and validation/authorization messages
  // are shown as-is. Anything else (e.g. a framework "route ... could not be found" 404, which
  // echoes the request URL and therefore the scanned token) gets a safe generic message instead.
  const code: string | null = err?.data?.code ?? null;
  const readable = code || [403, 409, 422].includes(err?.status);
  const message = readable && err?.data?.message ? err.data.message : fallback;
  return { code: code ?? (err?.status === 404 ? 'invalid_qr' : null), message };
}

export function QrRideProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { refreshHistory } = useBooking();
  const { showToast } = useToast();

  const [stage, setStage] = useState<QrStage>('idle');
  const [scan, setScan] = useState<QrScanResult | null>(null);
  const [scanError, setScanError] = useState<QrError | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [quote, setQuote] = useState<QrQuote | null>(null);
  const [quoteError, setQuoteError] = useState<QrError | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteSignature, setQuoteSignature] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<QrError | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [ride, setRide] = useState<QrActiveRide | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const quoteRequestRef = useRef(0);
  const quoteAbortControllerRef = useRef<AbortController | null>(null);

  const resetSetup = useCallback(() => {
    tokenRef.current = null;
    setScan(null);
    setScanError(null);
    setQuote(null);
    setQuoteError(null);
    setQuoteSignature(null);
    setJoinError(null);
  }, []);

  const enterRide = useCallback((next: QrActiveRide) => {
    setRide(next);
    setStage('ride');
    resetSetup();
  }, [resetSetup]);

  // Resume a QR ride after the app is reopened (or on login): the server is the source of truth.
  useEffect(() => {
    if (!isAuthenticated) {
      setStage('idle');
      setRide(null);
      resetSetup();
      return;
    }
    let cancelled = false;
    passengerApi
      .qrActive()
      .then((res) => {
        if (!cancelled && res?.ride) enterRide(res.ride);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, enterRide, resetSetup]);

  const resolveToken = useCallback(async (token: string, opts?: { silent?: boolean }) => {
    setIsResolving(true);
    if (!opts?.silent) {
      // Only a user-visible re-check (first scan or "Check Again") blanks the current screen —
      // a background availability poll must keep showing the resolved tricycle while it works.
      setScan(null);
      setScanError(null);
      setQuote(null);
      setQuoteError(null);
      setQuoteSignature(null);
    }
    setJoinError(null);
    try {
      const result = await passengerApi.qrScanTricycle(token);
      // Already in this tricycle's ride (e.g. scanned again) — go straight back to it.
      if (result.ride.your_booking_code) {
        const active = await passengerApi.qrActive(result.ride.your_booking_code).catch(() => null);
        if (active?.ride) {
          enterRide(active.ride);
          return;
        }
      }
      setScan(result);
    } catch (err: any) {
      // A background poll failing (e.g. a blip) shouldn't rip an otherwise-fine tricycle view
      // away from the passenger; the Join attempt re-checks server-side anyway.
      if (!opts?.silent) setScanError(toQrError(err, "This QR code couldn't be checked."));
    } finally {
      setIsResolving(false);
    }
  }, [enterRide]);

  const openScanner = useCallback(() => {
    resetSetup();
    setStage('scan');
  }, [resetSetup]);

  const closeQr = useCallback(() => {
    resetSetup();
    setStage((prev) => (prev === 'ride' ? prev : 'idle'));
  }, [resetSetup]);

  const submitScannedData = useCallback((data: string) => {
    const token = parseRideQrToken(data);
    if (!token) return false;
    tokenRef.current = token;
    setStage('setup');
    resolveToken(token);
    return true;
  }, [resolveToken]);

  const refreshScan = useCallback(async (opts?: { silent?: boolean }) => {
    if (tokenRef.current) await resolveToken(tokenRef.current, opts);
  }, [resolveToken]);

  const requestQuote = useCallback(async (
    destination: LocationPoint,
    partySize: number,
    passengerLocation: { lat: number; lng: number; name?: string | null },
    signature: string,
  ) => {
    if (!tokenRef.current) return;
    const requestId = ++quoteRequestRef.current;
    if (quoteAbortControllerRef.current) {
      quoteAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    quoteAbortControllerRef.current = controller;

    setIsQuoting(true);
    setQuoteError(null);
    setJoinError(null);
    try {
      const result = await passengerApi.qrQuote({
        token: tokenRef.current,
        party_size: partySize,
        pickup_lat: passengerLocation.lat,
        pickup_lng: passengerLocation.lng,
        ...(passengerLocation.name ? { pickup_name: passengerLocation.name } : {}),
        dropoff_name: destination.name,
        dropoff_lat: destination.lat,
        dropoff_lng: destination.lng,
      }, { signal: controller.signal });
      if (requestId === quoteRequestRef.current) {
        setQuote(result);
        // Bind the quote to the exact request that produced it, so a later selection change (or a
        // superseded request) can never treat this response as fresh for a different selection.
        setQuoteSignature(signature);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (requestId !== quoteRequestRef.current) return;
      setQuote(null);
      setQuoteSignature(null);
      setQuoteError(toQrError(err, "Couldn't get a fare for this trip."));
    } finally {
      if (requestId === quoteRequestRef.current) setIsQuoting(false);
    }
  }, []);

  const clearQuote = useCallback(() => {
    quoteRequestRef.current++;
    if (quoteAbortControllerRef.current) {
      quoteAbortControllerRef.current.abort();
      quoteAbortControllerRef.current = null;
    }
    setQuote(null);
    setQuoteError(null);
    setQuoteSignature(null);
    setIsQuoting(false);
  }, []);

  const joinRide = useCallback(async (expectedSignature: string | null, paymentMethod: PaymentMethod | string = 'cash') => {
    // Refuse to submit anything but the quote produced for the selection now on screen, and never
    // while a refresh is in flight. The disabled button mirrors this, but the guard lives here too
    // so a stale quote can't be joined even if the UI is out of sync.
    if (!quote || isJoining || isQuoting) return;
    if (!expectedSignature || expectedSignature !== quoteSignature) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await passengerApi.qrJoin(quote.quote, paymentMethod);
      enterRide({ booking: res.booking, session: res.session, tricycle: res.tricycle, driver_location: res.driver_location });
      showToast("You've joined the ride.");
    } catch (err: any) {
      const error = toQrError(err, "Couldn't join this ride.");
      // The request may have reached the server before the connection dropped — joining is
      // retry-safe server-side, so check whether the seat was actually taken.
      if (error.code === 'network') {
        const active = await passengerApi.qrActive().catch(() => null);
        if (active?.ride) {
          enterRide(active.ride);
          showToast("You've joined the ride.");
          return;
        }
      }
      if (error.code === 'quote_expired' || error.code === 'invalid_quote') {
        setQuote(null);
        setQuoteSignature(null);
      }
      setJoinError(error);
      // Seats, ride state or the driver may have changed — refresh what the tricycle shows.
      if (error.code && error.code !== 'network' && error.code !== 'quote_expired' && error.code !== 'invalid_quote') {
        setQuote(null);
        setQuoteSignature(null);
        if (tokenRef.current) {
          passengerApi.qrScanTricycle(tokenRef.current).then(setScan).catch((e) => setScanError(toQrError(e, error.message)));
        }
      }
    } finally {
      setIsJoining(false);
    }
  }, [quote, isJoining, isQuoting, quoteSignature, enterRide, showToast]);

  const leaveRide = useCallback(async () => {
    if (!ride || isLeaving) return false;
    setIsLeaving(true);
    try {
      const res = await passengerApi.qrLeave(ride.booking.booking_code);
      if (res?.ride) setRide(res.ride);
      return true;
    } catch (err: any) {
      showToast(toQrError(err, "Couldn't leave the ride.").message, 'info');
      return false;
    } finally {
      setIsLeaving(false);
    }
  }, [ride, isLeaving, showToast]);

  const finishRide = useCallback(() => {
    setRide(null);
    setStage('idle');
    resetSetup();
    refreshHistory();
  }, [resetSetup, refreshHistory]);

  const minimizeRide = useCallback(() => {
    setStage((prev) => (prev === 'ride' ? 'idle' : prev));
  }, []);

  const resumeRide = useCallback(() => {
    if (ride) {
      resetSetup();
      setStage('ride');
    }
  }, [ride, resetSetup]);

  // While a QR ride is unfinished — on its own screen or minimized to Home: follow it on the
  // backend (joined -> started -> dropped off -> paid / cancelled), including the shared driver
  // GPS and, after drop-off, the driver's payment confirmation. Stops once paid or cancelled.
  const bookingCode = ride?.booking.booking_code;
  const bookingStatus = ride?.booking.status;
  const paymentStatus = ride?.booking.payment_status;
  const unfinished = isQrRideUnfinished(ride);
  useEffect(() => {
    if (!unfinished || !bookingCode || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await passengerApi.qrActive(bookingCode);
        if (cancelled || !res?.ride) return;
        setRide((prev) => {
          const before = prev?.booking.status;
          const after = res.ride!.booking.status;
          if (before && before !== after) {
            if (after === 'in_transit') showToast('Your ride has started.');
            if (after === 'completed') showToast("You've been dropped off.");
            if (after === 'cancelled') {
              const by = res.ride!.booking.cancelled_by;
              showToast(
                by === 'driver' ? 'The driver removed you from this ride.'
                  : by === 'system' ? 'This ride expired before it started.'
                  : 'You left the ride.',
                'info'
              );
            }
          }
          if (prev && prev.booking.payment_status !== 'paid' && res.ride!.booking.payment_status === 'paid') {
            showToast('Payment confirmed.');
          }
          return res.ride;
        });
        if (!isQrRideUnfinished(res.ride)) refreshHistory();
      } catch {
        // Transient network hiccup — keep polling.
      }
    };
    poll();
    const interval = setInterval(poll, QR_RIDE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [unfinished, bookingCode, bookingStatus, paymentStatus, isAuthenticated, showToast, refreshHistory]);

  return (
    <QrRideContext.Provider
      value={{
        stage, scan, scanError, isResolving, quote, quoteError, isQuoting, quoteSignature, joinError, isJoining, ride, isLeaving,
        openScanner, closeQr, submitScannedData, refreshScan, requestQuote, clearQuote, joinRide, leaveRide, finishRide,
        minimizeRide, resumeRide,
      }}
    >
      {children}
    </QrRideContext.Provider>
  );
}

export function useQrRide(): QrRideContextType {
  const ctx = useContext(QrRideContext);
  if (!ctx) throw new Error('useQrRide must be used within a QrRideProvider');
  return ctx;
}
