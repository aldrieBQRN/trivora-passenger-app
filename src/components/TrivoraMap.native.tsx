import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';
import { Compass, Zap, LocateFixed } from 'lucide-react-native';

import { PICKUP_PIN_IMAGE, DESTINATION_PIN_IMAGE, TRICYCLE_MARKER_IMAGE } from '../constants/mapPins';
import {
  MAP_STYLES,
  ACTIVE_RIDE_PITCH,
  TOP_DOWN_PITCH,
  MapVariant,
  NO_PADDING,
  PIN_SIZE,
  TRICYCLE_MARKER_SIZE,
  deltaToZoom,
  boundsOf,
  routeLineFeature,
  routeLinePaint,
} from '../constants/openFreeMap';
import { TODA_ZONES } from '../constants/todaRoutes';
import { fetchTodaZones } from '../services/api';
import { TodaZone } from '../types';
import { TrivoraMapProps } from './TrivoraMap.types';
import { haversineKm } from '../utils/routeInterpolation';

/** Max route vertices used for fitBounds - covers the route's whole extent without walking
 * thousands of points on every reframe. */
const MAX_FIT_ROUTE_POINTS = 40;

/** Home map zoom: visible span in degrees (~0.004° ≈ 450 m; was 0.008°), converted to a MapLibre
 * zoom by deltaToZoom. Same value as the Driver Home map. Used for the initial camera and the Home
 * recenter — single-point framing only. */
const HOME_ZOOM_DELTA = 0.004;
/** Follow mode: a location update at least this far (km, ~3 m) from where the camera last
 * centered moves the camera; smaller moves (GPS jitter) don't twitch it. */
const FOLLOW_MIN_MOVE_KM = 0.003;

/** Once following a driver (en-route or in-transit), re-frame only after this much real
 * movement since the camera was last positioned — keeps the destination in view as the driver
 * approaches without re-animating the camera on every GPS tick. */
const REFRAME_THRESHOLD_KM = 0.12;
/** Fixed breathing room added on top of the caller-supplied chrome insets. */
const EDGE_MARGIN = 40;

export default function TrivoraMapNative({
  pickup = { lat: 14.0715, lng: 120.633, name: 'Bucana, Nasugbu Batangas' },
  dropoff = null,
  driverLocation = null,
  activeZone,
  rideState = 'idle',
  suggestedRouteInfo,
  routeCoordinates,
  routeSource = 'osrm',
  showTodaPill = true,
  showTodaPins = true,
  showCompass = true,
  showRouteBadge = true,
  topInset = 0,
  bottomInset = 0,
  onTodaPress,
  onRecenter,
  focusCurrentLocation = false,
  currentLocation = null,
  mapVariant,
  mapStyleUrl,
  pitch,
  style,
}: TrivoraMapProps) {
  // Map style and camera pitch presentation:
  // Active booking & ride screens (destination select route, fare confirmation, driver approaching,
  // or in transit) use OpenFreeMap Liberty in 3D pitched mode (~50°).
  // Home and ordinary location selection screens use OpenFreeMap Bright in 2D top-down mode (0°).
  const isActiveRide =
    rideState === 'in_transit' ||
    rideState === 'driver_en_route' ||
    rideState === 'accepted';
  const effectiveVariant: MapVariant = mapVariant ?? (isActiveRide ? 'liberty' : 'bright');
  const effectiveMapStyle = mapStyleUrl ?? MAP_STYLES[effectiveVariant];
  const effectivePitch = pitch ?? (effectiveVariant === 'liberty' || isActiveRide ? ACTIVE_RIDE_PITCH : TOP_DOWN_PITCH);

  const [todaList, setTodaList] = useState<TodaZone[]>(TODA_ZONES);

  useEffect(() => {
    fetchTodaZones().then((zones) => {
      if (zones && zones.length > 0) {
        setTodaList(zones);
      }
    });
  }, []);

  const cameraRef = useRef<CameraRef | null>(null);
  const mapMountedRef = useRef(false);
  const [mapWidth, setMapWidth] = useState(0);
  const homeZoom = deltaToZoom(HOME_ZOOM_DELTA, mapWidth);
  // Set once the native map has loaded (and so has its real layout) — the automatic framing waits
  // for it, because a fit issued earlier can be dropped and leave the camera on its initial view.
  const [mapReady, setMapReady] = useState(false);

  // ---- Focus Current Location (Home only) ----
  // Following starts only when the user taps Focus. Live positions arrive through the
  // `currentLocation` prop (HomeScreen's useLiveLocation, falling back to the app's one-shot real
  // fix) — the same coordinate the green pin is drawn at, so pin and camera never separate. No
  // native blue dot.
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const isFollowingRef = useRef(false);
  const followCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const centerOnUser = (loc: { lat: number; lng: number }) => {
    followCenterRef.current = loc;
    // Home only, so the chrome padding (the old mapPadding) always applies.
    cameraRef.current?.easeTo({ center: [loc.lng, loc.lat], zoom: homeZoom, padding: edgePadding, pitch: effectivePitch, duration: 500 });
  };

  const setFollowing = (on: boolean) => {
    isFollowingRef.current = on;
    setIsFollowingUser(on);
  };
  const handleFocusCurrentLocation = () => {
    const loc = homeLocation;
    if (!loc) return; // no real position known yet — never center on a guessed coordinate
    setFollowing(true);
    centerOnUser(loc);
  };
  const lastFramedRef = useRef<{ lat: number; lng: number } | null>(null);

  const isEnRoute = rideState === 'driver_en_route' || rideState === 'accepted';
  const isInTransit = rideState === 'in_transit';
  const hasRoute = !!dropoff || isEnRoute || isInTransit;
  const isFollowing = (isEnRoute || isInTransit) && !!driverLocation;

  // Home with Focus: the green pin IS the passenger's live position (not the booking pickup), and
  // the Home camera centers on the same coordinate — one source for marker and camera.
  const homeLocation = focusCurrentLocation && !hasRoute && currentLocation ? currentLocation : null;
  // Home map before the first real GPS fix: the map is already mounted and loading tiles, but has
  // no pin and no camera target yet (never the booking's default pickup coordinate).
  const isHomeMap = focusCurrentLocation && !hasRoute;
  const awaitingHomeLocation = isHomeMap && !homeLocation;
  // Captured at mount: a map that mounted with no position yet jumps (not flies from the world
  // view) to the first real fix.
  const mountedWithoutCenterRef = useRef(awaitingHomeLocation);

  // Following: every new live position (>= FOLLOW_MIN_MOVE_KM from the last centered one) moves
  // the camera to exactly where the pin now is.
  useEffect(() => {
    if (!homeLocation || !isFollowingRef.current) return;
    const last = followCenterRef.current;
    if (!last || haversineKm(last, homeLocation) >= FOLLOW_MIN_MOVE_KM) centerOnUser(homeLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeLocation?.lat, homeLocation?.lng]);

  // Derived from the caller's actual header/bottom-sheet heights (not a guessed geographic
  // offset) — passed as the camera padding (route fits, and every Home camera move), so the
  // "important pin" stays inside the visible area instead of the map treating the full screen
  // (chrome included) as usable space.
  const edgePadding = useMemo(
    () => ({ top: topInset + EDGE_MARGIN, right: EDGE_MARGIN, bottom: bottomInset + EDGE_MARGIN, left: EDGE_MARGIN }),
    [topInset, bottomInset]
  );

  /** Frames whichever of pickup/dropoff/driver are relevant right now — shared by the
   * automatic phase-transition follow effect and the manual recenter button, so both behave
   * identically instead of recenter only ever framing pickup. Uses fitBounds' padding for
   * multi-point framing instead of a manually computed lat/lng midpoint, so markers stay inside
   * the visible (non-overlaid) map area rather than the raw geographic center. */
  const frameRelevantPoints = useCallback(
    (animated: boolean) => {
      const camera = cameraRef.current;
      if (!camera) return;

      const targetEnd =
        dropoff ||
        (isEnRoute && driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null);

      if (targetEnd) {
        const points = [
          { lat: pickup.lat, lng: pickup.lng },
          { lat: targetEnd.lat, lng: targetEnd.lng },
        ];
        if (driverLocation) points.push({ lat: driverLocation.lat, lng: driverLocation.lng });
        // Also fit the road route itself (sampled) so a route that bulges past its two endpoints
        // is not clipped - the route is the trip's real extent, not the span of its two ends.
        if (routeCoordinates && routeCoordinates.length > 0) {
          const step = Math.max(1, Math.ceil(routeCoordinates.length / MAX_FIT_ROUTE_POINTS));
          routeCoordinates.forEach((c, i) => {
            if (i % step === 0 || i === routeCoordinates.length - 1) points.push({ lat: c.lat, lng: c.lng });
          });
        }
        camera.fitBounds(boundsOf(points), { padding: edgePadding, pitch: effectivePitch, duration: animated ? 500 : 0 });
      } else {
        if (awaitingHomeLocation) return; // no real position yet — framed when the first fix lands
        if (mountedWithoutCenterRef.current) {
          mountedWithoutCenterRef.current = false;
          animated = false;
        }
        // Single point (no route yet): center EXACTLY on the pin's own coordinate (the live
        // position on Home, otherwise pickup). Home centers within the header/sheet padding; a
        // route-less non-Home map gets none. No pixel/coordinate correction or timer: one camera
        // call, nothing competing.
        const pinPoint = homeLocation ?? pickup;
        const padding = isHomeMap ? edgePadding : NO_PADDING;
        followCenterRef.current = homeLocation;
        if (__DEV__) {
          console.log(
            `[passenger-map] easeTo target=(${pinPoint.lat}, ${pinPoint.lng}) marker=(${pinPoint.lat}, ${pinPoint.lng}) ` +
              `padding=${JSON.stringify(padding)} zoom=${homeZoom.toFixed(2)}`
          );
        }
        camera.easeTo({ center: [pinPoint.lng, pinPoint.lat], zoom: homeZoom, padding, pitch: effectivePitch, duration: animated ? 600 : 0 });
      }
      if (driverLocation) lastFramedRef.current = { lat: driverLocation.lat, lng: driverLocation.lng };
    },
    [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, driverLocation?.lat, driverLocation?.lng, edgePadding, routeCoordinates, homeLocation?.lat, homeLocation?.lng, isHomeMap, homeZoom, effectivePitch]
  );

  // Auto-frame on mount and whenever the destination or ride phase changes — deliberately NOT
  // on every driver-position tick (previously this effect depended on driverLocation directly
  // and re-ran on every ~2.8s simulated GPS update, fighting any manual pan/zoom and animating
  // the whole map every few seconds even when nothing meaningful had changed).
  useEffect(() => {
    if (!mapReady) return;
    frameRelevantPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  // The route arrives asynchronously after the endpoints - re-fit when it does, but only while the
  // trip is being PLANNED. During an active ride the route is re-fetched as the driver moves and
  // must not keep re-animating the camera.
  }, [mapReady, pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, isInTransit, edgePadding, isEnRoute || isInTransit ? null : routeCoordinates, !!homeLocation]);

  // While following a driver, keep them (and the target) in frame as they move — but only once
  // they've moved meaningfully since the camera was last positioned, not on every tick.
  useEffect(() => {
    if (!isFollowing || !driverLocation || !lastFramedRef.current) return;
    const moved = haversineKm(lastFramedRef.current, driverLocation);
    if (moved >= REFRAME_THRESHOLD_KM) frameRelevantPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation?.lat, driverLocation?.lng]);

  const handleRecenter = () => {
    frameRelevantPoints(true);
    if (onRecenter) onRecenter();
  };

  const polylineCoords = routeCoordinates || [];
  const routeFeature = useMemo(() => routeLineFeature(routeCoordinates || []), [routeCoordinates]);

  const isFallbackRoute = routeSource === 'fallback';

  if (__DEV__ && driverLocation) {
    console.log(`[passenger-driver-heading] latitude=${driverLocation.lat}`);
    console.log(`[passenger-driver-heading] longitude=${driverLocation.lng}`);
    console.log(`[passenger-driver-heading] heading=${driverLocation.heading} (value passed to the marker's rotate transform)`);
  }

  if (__DEV__ && hasRoute) {
    const first = polylineCoords[0];
    const last = polylineCoords[polylineCoords.length - 1];
    console.log(
      `[passenger-route] count=${polylineCoords.length} source=${routeSource} ` +
        `first=${first ? `(${first.lat}, ${first.lng})` : 'none'} ` +
        `last=${last ? `(${last.lat}, ${last.lng})` : 'none'} ` +
        `pickup=(${pickup.lat}, ${pickup.lng}) dropoff=${dropoff ? `(${dropoff.lat}, ${dropoff.lng})` : 'none'}`
    );
  }

  // Same as the Driver Home map: a Home map framed before the header/sheet heights are measured
  // would be framed against the wrong (0) padding. Create Home's map only once both insets are
  // known, so it starts with its final padding and centers the pin in the visible area from the
  // first frame.
  // Waits only for the header/sheet LAYOUT (one frame), never for GPS or any API data; once the
  // map has mounted it is never torn down again by later inset changes.
  const homeInsetsMeasured = !isHomeMap || (topInset > 0 && bottomInset > 0) || mapMountedRef.current;
  if (!homeInsetsMeasured) {
    return <View style={[styles.container, style]} />;
  }
  mapMountedRef.current = true;

  return (
    <View style={[styles.container, style]} onLayout={(e) => setMapWidth(e.nativeEvent.layout.width)}>
      <Map
        style={StyleSheet.absoluteFillObject}
        mapStyle={effectiveMapStyle}
        attribution={true}
        attributionPosition={{ bottom: 8, left: 8 }}
        logo={false}
        compass={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onRegionDidChange={(e) => {
          // A manual pan/zoom pauses following and leaves the map where the user put it.
          if (e.nativeEvent.userInteraction && isFollowingRef.current) setFollowing(false);
        }}
      >
        <Camera
          ref={cameraRef}
          // Home (live-location pin) starts centered in the VISIBLE strip between header and sheet
          // (the measured insets as camera padding, exactly like the Driver Home map). Route
          // framing carries the insets itself via fitBounds' padding.
          // A planned trip (dropoff set) starts already framed on pickup + destination, so it never
          // opens zoomed in on the pickup alone; the fit effect adds the route after load.
          initialViewState={dropoff ? {
            bounds: boundsOf([pickup, dropoff]),
            padding: edgePadding,
            pitch: effectivePitch,
          } : awaitingHomeLocation ? undefined : {
            center: [(homeLocation ?? pickup).lng, (homeLocation ?? pickup).lat],
            zoom: homeZoom,
            padding: isHomeMap ? edgePadding : NO_PADDING,
            pitch: effectivePitch,
          }}
        />

        {/* Route: a style layer, so it draws above the OpenFreeMap basemap and below the markers (which
            are native views on top of the map). */}
        {polylineCoords.length > 0 && (
          <GeoJSONSource id="route" data={routeFeature}>
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': isFallbackRoute ? 'butt' : 'round' }}
              paint={routeLinePaint(isFallbackRoute)}
            />
          </GeoJSONSource>
        )}

        {/* Pickup / destination pins — static bitmaps (assets/map/pin-*.png, 28x36 at 1x,
            @2x/@3x variants), cropped so the pin's tip is the bottom-center pixel of the image.
            anchor "bottom" = bottom-center = the tip = the exact coordinate, at every zoom. */}
        {!awaitingHomeLocation ? (
          <Marker id="pickup-pin" lngLat={[(homeLocation ?? pickup).lng, (homeLocation ?? pickup).lat]} anchor="bottom">
            <Image source={PICKUP_PIN_IMAGE} style={PIN_SIZE} />
          </Marker>
        ) : null}

        {dropoff ? (
          <Marker id="dropoff-pin" lngLat={[dropoff.lng, dropoff.lat]} anchor="bottom">
            <Image source={DESTINATION_PIN_IMAGE} style={PIN_SIZE} />
          </Marker>
        ) : null}

        {/* Moving Driver Marker — rendered last so it draws above the pins. */}
        {driverLocation ? (
          <Marker id="driver" lngLat={[driverLocation.lng, driverLocation.lat]} anchor="center">
            <View style={{ transform: [{ rotate: `${driverLocation.heading || 0}deg` }] }}>
              <Image
                source={TRICYCLE_MARKER_IMAGE}
                style={styles.tricycleMarker}
                resizeMode="contain"
              />
            </View>
          </Marker>
        ) : null}
      </Map>

      {/* Floating Route Info Badge */}
      {showRouteBadge && hasRoute && suggestedRouteInfo && (
        <View style={styles.suggestedRouteBadge}>
          <View style={styles.routeHeaderRow}>
            <Zap size={11} color={isFallbackRoute ? COLORS.textSecondary : '#16A34A'} />
            <Text style={styles.suggestedRouteTitle}>
              {isFallbackRoute ? 'Estimated Route' : 'Fastest Route'}
            </Text>
          </View>
          <Text style={styles.suggestedRouteSub}>
            {suggestedRouteInfo.distance} • {suggestedRouteInfo.duration}
          </Text>
        </View>
      )}

      {/* Focus Current Location (Home only) — just above the bottom sheet; filled while following. */}
      {focusCurrentLocation && !hasRoute && (
        <TouchableOpacity
          style={[styles.focusButton, { bottom: bottomInset + 12 }, isFollowingUser && styles.focusButtonActive]}
          onPress={handleFocusCurrentLocation}
          activeOpacity={0.8}
          accessibilityLabel="Focus current location"
        >
          <LocateFixed size={18} color={isFollowingUser ? '#FFFFFF' : COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* Floating Compass / Recenter Button */}
      {showCompass && (
        <TouchableOpacity style={styles.compassButton} onPress={handleRecenter} activeOpacity={0.8}>
          <Compass size={18} color="#D97706" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  focusButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  focusButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF6EE',
    position: 'relative',
    overflow: 'hidden',
  },
  suggestedRouteBadge: {
    position: 'absolute',
    top: 140,
    right: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    ...SHADOWS.md,
    maxWidth: 155,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestedRouteTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
  },
  suggestedRouteSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tricycleMarker: {
    width: TRICYCLE_MARKER_SIZE.width,
    height: TRICYCLE_MARKER_SIZE.height,
  },
  todaPill: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...SHADOWS.md,
  },
  todaPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  compassButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    ...SHADOWS.sm,
  },
});
