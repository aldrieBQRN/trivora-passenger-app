import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';
import { Compass, Shield, ChevronRight, Zap, LocateFixed } from 'lucide-react-native';
import { TricycleIcon } from './icons';

import { PICKUP_PIN_IMAGE, DESTINATION_PIN_IMAGE } from '../constants/mapPins';
import { TODA_ZONES } from '../constants/todaRoutes';
import { fetchTodaZones } from '../services/api';
import { TodaZone } from '../types';
import { TrivoraMapProps } from './TrivoraMap.types';
import { haversineKm } from '../utils/routeInterpolation';

/** Max route vertices handed to fitToCoordinates - covers the route's whole extent without
 * passing thousands of points across the native bridge. */
const MAX_FIT_ROUTE_POINTS = 40;

/** Home map zoom: visible span in degrees (~0.004° ≈ 450 m top-to-bottom; was 0.008°). Same value as
 * the Driver Home map. Used for the initial region and the Home recenter — single-point framing only. */
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

const CARTO_URL_TEMPLATE =
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3qo7_1_ac41fdc9883213d666d06544';

const VOYAGER_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#FAF6EE' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#786F66' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FAF6EE' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#F0ECE3' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D8F3DC' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#427848' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFB74D' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#E68A00' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FFE4BA' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#F4C793' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#E8DEC8' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#85CBE6' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2E7997' }] },
];

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
  style,
}: TrivoraMapProps) {
  const [todaList, setTodaList] = useState<TodaZone[]>(TODA_ZONES);

  useEffect(() => {
    fetchTodaZones().then((zones) => {
      if (zones && zones.length > 0) {
        setTodaList(zones);
      }
    });
  }, []);

  const mapRef = useRef<MapView | null>(null);

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
    mapRef.current?.animateToRegion(
      { latitude: loc.lat, longitude: loc.lng, latitudeDelta: HOME_ZOOM_DELTA, longitudeDelta: HOME_ZOOM_DELTA },
      500
    );
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

  // Following: every new live position (>= FOLLOW_MIN_MOVE_KM from the last centered one) moves
  // the camera to exactly where the pin now is.
  useEffect(() => {
    if (!homeLocation || !isFollowingRef.current) return;
    const last = followCenterRef.current;
    if (!last || haversineKm(last, homeLocation) >= FOLLOW_MIN_MOVE_KM) centerOnUser(homeLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeLocation?.lat, homeLocation?.lng]);

  // Derived from the caller's actual header/bottom-sheet heights (not a guessed geographic
  // offset) — react-native-maps applies this to every camera operation, including the plain
  // single-point animateToRegion below, so the "important pin" stays inside the visible area
  // instead of the map treating the full screen (chrome included) as usable space.
  const edgePadding = useMemo(
    () => ({ top: topInset + EDGE_MARGIN, right: EDGE_MARGIN, bottom: bottomInset + EDGE_MARGIN, left: EDGE_MARGIN }),
    [topInset, bottomInset]
  );

  /** Frames whichever of pickup/dropoff/driver are relevant right now — shared by the
   * automatic phase-transition follow effect and the manual recenter button, so both behave
   * identically instead of recenter only ever framing pickup. Uses fitToCoordinates' edge
   * padding for multi-point framing instead of a manually computed lat/lng midpoint, so markers
   * stay inside the visible (non-overlaid) map area rather than the raw geographic center. */
  const frameRelevantPoints = useCallback(
    (animated: boolean) => {
      if (!mapRef.current) return;

      const targetEnd =
        dropoff ||
        (isEnRoute && driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null);

      if (targetEnd) {
        const points = [
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: targetEnd.lat, longitude: targetEnd.lng },
        ];
        if (driverLocation) points.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
        // Also fit the road route itself (sampled) so a route that bulges past its two endpoints
        // is not clipped - the route is the trip's real extent, not the span of its two ends.
        if (routeCoordinates && routeCoordinates.length > 0) {
          const step = Math.max(1, Math.ceil(routeCoordinates.length / MAX_FIT_ROUTE_POINTS));
          routeCoordinates.forEach((c, i) => {
            if (i % step === 0 || i === routeCoordinates.length - 1) points.push({ latitude: c.lat, longitude: c.lng });
          });
        }
        mapRef.current.fitToCoordinates(points, { edgePadding, animated });
      } else {
        const map = mapRef.current;
        // Single point (Home, no route yet): center EXACTLY on the pin's own coordinate (the live
        // position on Home, otherwise pickup). No mapPadding is applied to a route-less map (see the MapView below), and
        // there is no pixel/coordinate correction or timer: one camera call, nothing competing.
        const pinPoint = homeLocation ?? pickup;
        followCenterRef.current = homeLocation;
        if (__DEV__) {
          console.log(
            `[passenger-map] animateToRegion target=(${pinPoint.lat}, ${pinPoint.lng}) marker=(${pinPoint.lat}, ${pinPoint.lng}) ` +
              `mapPadding=none delta=${HOME_ZOOM_DELTA}`
          );
        }
        map.animateToRegion(
          {
            latitude: pinPoint.lat,
            longitude: pinPoint.lng,
            latitudeDelta: HOME_ZOOM_DELTA,
            longitudeDelta: HOME_ZOOM_DELTA,
          },
          animated ? 600 : 0
        );
      }
      if (driverLocation) lastFramedRef.current = { lat: driverLocation.lat, lng: driverLocation.lng };
    },
    [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, driverLocation?.lat, driverLocation?.lng, edgePadding, routeCoordinates, homeLocation?.lat, homeLocation?.lng]
  );

  // Auto-frame on mount and whenever the destination or ride phase changes — deliberately NOT
  // on every driver-position tick (previously this effect depended on driverLocation directly
  // and re-ran on every ~2.8s simulated GPS update, fighting any manual pan/zoom and animating
  // the whole map every few seconds even when nothing meaningful had changed).
  useEffect(() => {
    frameRelevantPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  // The route arrives asynchronously after the endpoints - re-fit when it does, but only while the
  // trip is being PLANNED. During an active ride the route is re-fetched as the driver moves and
  // must not keep re-animating the camera.
  }, [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, isInTransit, edgePadding, isEnRoute || isInTransit ? null : routeCoordinates]);

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

  const polylineCoords = useMemo(
    () => (routeCoordinates || []).map((c) => ({ latitude: c.lat, longitude: c.lng })),
    [routeCoordinates]
  );

  const isFallbackRoute = routeSource === 'fallback';

  if (__DEV__ && driverLocation) {
    console.log(`[passenger-driver-heading] latitude=${driverLocation.lat}`);
    console.log(`[passenger-driver-heading] longitude=${driverLocation.lng}`);
    console.log(`[passenger-driver-heading] heading=${driverLocation.heading} (value passed to rotation={heading})`);
  }

  if (__DEV__ && hasRoute) {
    const first = polylineCoords[0];
    const last = polylineCoords[polylineCoords.length - 1];
    console.log(
      `[passenger-route] count=${polylineCoords.length} source=${routeSource} ` +
        `first=${first ? `(${first.latitude}, ${first.longitude})` : 'none'} ` +
        `last=${last ? `(${last.latitude}, ${last.longitude})` : 'none'} ` +
        `pickup=(${pickup.lat}, ${pickup.lng}) dropoff=${dropoff ? `(${dropoff.lat}, ${dropoff.lng})` : 'none'}`
    );
  }

  // Same as the Driver Home map: native applies a mapPadding change asynchronously, so a Home map
  // framed before the header/sheet heights are measured would be framed against the wrong (0)
  // padding. Create Home's MapView only once both insets are known, so it starts with its final
  // padding and centers the pin in the visible area from the first frame.
  const homeInsetsMeasured = !homeLocation || (topInset > 0 && bottomInset > 0);
  if (!homeInsetsMeasured) {
    return <View style={[styles.container, style]} />;
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: (homeLocation ?? pickup).lat,
          longitude: (homeLocation ?? pickup).lng,
          latitudeDelta: HOME_ZOOM_DELTA,
          longitudeDelta: HOME_ZOOM_DELTA,
        }}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        customMapStyle={VOYAGER_MAP_STYLE}
        showsUserLocation={false}
        onRegionChangeComplete={(_region, details) => {
          // A manual pan/zoom pauses following and leaves the map where the user put it.
          if (details?.isGesture && isFollowingRef.current) setFollowing(false);
        }}
        showsCompass={false}
        // Home (live-location pin): mapPadding = the measured header/sheet insets, exactly like the
        // Driver Home map — the native map then centers every camera move (initial region, Focus,
        // follow) in the VISIBLE strip between header and sheet, with no pixel correction on top.
        // Route framing (hasRoute) still gets NO mapPadding: fitToCoordinates carries the insets
        // itself via edgePadding, and both together would apply them twice.
        mapPadding={homeLocation ? edgePadding : undefined}
      >
        <UrlTile
          urlTemplate={CARTO_URL_TEMPLATE}
          maximumZ={19}
          flipY={false}
          tileSize={256}
          shouldReplaceMapContent={true}
          zIndex={1}
        />

        {/* Pickup / destination pins — static bitmap markers (assets/map/pin-*.png, 28x36 at 1x,
            @2x/@3x variants), cropped so the pin's tip is the bottom-center pixel of the image.
            Passed as the Marker `image` (not a React/SVG child), so the native map anchors the
            bitmap itself: no view-to-bitmap snapshot whose bounds could differ from the visible
            pin. anchor (0.5, 1) = bottom-center = the tip = the exact coordinate, at every zoom. */}
        <Marker
          zIndex={10}
          coordinate={{ latitude: (homeLocation ?? pickup).lat, longitude: (homeLocation ?? pickup).lng }}
          image={PICKUP_PIN_IMAGE}
          anchor={{ x: 0.5, y: 1 }}
        />

        {dropoff && (
          <Marker
            zIndex={10}
            coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
            image={DESTINATION_PIN_IMAGE}
            anchor={{ x: 0.5, y: 1 }}
          />
        )}

        {/* Moving Driver Marker */}
        {driverLocation && (
          <Marker
            zIndex={12}
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            rotation={driverLocation.heading}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {/* Same rendering as the Driver app's own map marker (TrivoraDriverMap.native.tsx):
                white bubble + TricycleIcon, native rotation = heading with NO base offset. */}
            <View style={styles.trikeBubble}>
              <TricycleIcon size={20} color={COLORS.primary} accentColor="#3B82F6" />
            </View>
          </Marker>
        )}

        {polylineCoords.length > 0 && (
          <Polyline
            // Must sit ABOVE the basemap UrlTile (zIndex 1, shouldReplaceMapContent) and below the
            // markers (10+). Left at the default 0 it is drawn UNDER the opaque tile overlay on
            // native (notably Android/Expo Go) — the route exists but is invisible.
            zIndex={2}
            coordinates={polylineCoords}
            strokeColor={isFallbackRoute ? '#94A3B8' : '#2563EB'}
            strokeWidth={isFallbackRoute ? 4 : 5}
            lineDashPattern={isFallbackRoute ? [8, 6] : undefined}
          />
        )}
      </MapView>

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
  trikeBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
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
