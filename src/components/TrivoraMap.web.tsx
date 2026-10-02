import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';
import { Compass, Shield, ChevronRight, Zap, LocateFixed } from 'lucide-react-native';
import { TODA_ZONES } from '../constants/todaRoutes';
import { fetchTodaZones } from '../services/api';
import { TodaZone } from '../types';
import { TrivoraMapProps } from './TrivoraMap.types';
import { haversineKm } from '../utils/routeInterpolation';
import { TRICYCLE_MARKER_IMAGE } from '../constants/mapPins';
import {
  MAP_STYLES,
  ACTIVE_RIDE_PITCH,
  TOP_DOWN_PITCH,
  MapVariant,
  boundsOf,
} from '../constants/openFreeMap';

const tricycleUri: string =
  typeof TRICYCLE_MARKER_IMAGE === 'string'
    ? TRICYCLE_MARKER_IMAGE
    : (TRICYCLE_MARKER_IMAGE as any)?.default || (TRICYCLE_MARKER_IMAGE as any)?.uri || String(TRICYCLE_MARKER_IMAGE);

const REFRAME_THRESHOLD_KM = 0.12;
const FOLLOW_MIN_MOVE_KM = 0.003;
const EDGE_MARGIN = 40;
const MAX_FIT_ROUTE_POINTS = 40;

export const PICKUP_ICON_HTML = `
  <div style="cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center;">
    <div style="background: #059669; width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #FFFFFF;">
      <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    </div>
  </div>
`;

export const DROPOFF_ICON_HTML = `
  <div style="cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center;">
    <div style="background: #EF4444; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #FFFFFF;">
      <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    </div>
  </div>
`;

export function todaIconHtml(): string {
  return `
    <div style="cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center;">
      <div style="
        background: #1D2542;
        width: 24px;
        height: 24px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #FFFFFF;
      ">
        <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    </div>
  `;
}

export function driverIconHtml(heading: number, uri: string): string {
  return `
    <div style="width:45px;height:30px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35));transform:rotate(${heading}deg);">
      <img src="${uri}" alt="Tricycle" style="width:45px;height:30px;object-fit:contain;pointer-events:none;" />
    </div>
  `;
}

/** Backward compatibility helper for any legacy callers importing makeDivIcon. */
export function makeDivIcon(html: string, _size: number, _anchorBottom = false): any {
  return { html };
}

export default function TrivoraMapWeb({
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [todaList, setTodaList] = useState<TodaZone[]>(TODA_ZONES);
  useEffect(() => {
    fetchTodaZones().then((zones) => {
      if (zones && zones.length > 0) setTodaList(zones);
    });
  }, []);

  const isEnRoute = rideState === 'driver_en_route' || rideState === 'accepted';
  const isInTransit = rideState === 'in_transit';
  const isActiveRide =
    rideState === 'in_transit' ||
    rideState === 'driver_en_route' ||
    rideState === 'accepted';
  const hasRoute = !!dropoff || isEnRoute || isInTransit;
  const isFallbackRoute = routeSource === 'fallback';
  const isFollowing = (isEnRoute || isInTransit) && !!driverLocation;

  const effectiveVariant: MapVariant = mapVariant ?? (isActiveRide ? 'liberty' : 'bright');
  const effectiveMapStyle = mapStyleUrl ?? MAP_STYLES[effectiveVariant];
  const effectivePitch = pitch ?? (effectiveVariant === 'liberty' || isActiveRide ? ACTIVE_RIDE_PITCH : TOP_DOWN_PITCH);

  const homeLocation = focusCurrentLocation && !hasRoute && currentLocation ? currentLocation : null;
  const isHomeMap = focusCurrentLocation && !hasRoute;

  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const isFollowingRef = useRef(false);
  const followCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastFramedRef = useRef<{ lat: number; lng: number } | null>(null);

  const edgePadding = useMemo(
    () => ({
      top: topInset + EDGE_MARGIN,
      right: EDGE_MARGIN,
      bottom: bottomInset + EDGE_MARGIN,
      left: EDGE_MARGIN,
    }),
    [topInset, bottomInset]
  );

  // Markers refs
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const todaMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Route layer sync helper
  const syncRouteLayer = useCallback(
    (map: maplibregl.Map, coords: { lat: number; lng: number }[], fallback: boolean) => {
      if (!map.isStyleLoaded()) return;
      const lineCoords = coords.map((c) => [c.lng, c.lat]);
      const data: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: lineCoords },
      };

      const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else if (lineCoords.length > 0) {
        map.addSource('route', { type: 'geojson', data });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': fallback ? 'butt' : 'round',
          },
          paint: fallback
            ? { 'line-color': '#94A3B8', 'line-width': 4, 'line-dasharray': [2, 1.5] }
            : { 'line-color': '#2563EB', 'line-width': 5 },
        });
      }
    },
    []
  );

  // Initialize MapLibre GL map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialPoint = homeLocation ?? pickup;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: effectiveMapStyle,
      center: [initialPoint.lng, initialPoint.lat],
      zoom: 16,
      pitch: effectivePitch,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      setMapReady(true);
      syncRouteLayer(map, routeCoordinates || [], isFallbackRoute);
    });

    map.on('style.load', () => {
      syncRouteLayer(map, routeCoordinates || [], isFallbackRoute);
    });

    map.on('styleimagemissing', (e: { id: string }) => {
      const id = e?.id;
      if (id && !map.hasImage(id)) {
        map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });

    map.on('dragstart', () => {
      if (isFollowingRef.current) {
        isFollowingRef.current = false;
        setIsFollowingUser(false);
      }
    });

    mapRef.current = map;

    return () => {
      pickupMarkerRef.current?.remove();
      dropoffMarkerRef.current?.remove();
      driverMarkerRef.current?.remove();
      todaMarkersRef.current.forEach((m) => m.remove());
      todaMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update style when effectiveMapStyle changes
  const currentStyleUrlRef = useRef(effectiveMapStyle);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (currentStyleUrlRef.current !== effectiveMapStyle) {
      currentStyleUrlRef.current = effectiveMapStyle;
      map.setStyle(effectiveMapStyle);
    }
  }, [effectiveMapStyle, mapReady]);

  // Update pitch when effectivePitch changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ pitch: effectivePitch, duration: 400 });
  }, [effectivePitch, mapReady]);

  // Sync route coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncRouteLayer(map, routeCoordinates || [], isFallbackRoute);
  }, [routeCoordinates, isFallbackRoute, mapReady, syncRouteLayer]);

  // Pickup marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const targetLoc = homeLocation ?? pickup;
    if (!targetLoc) return;

    if (!pickupMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'trivora-marker-icon';
      el.innerHTML = PICKUP_ICON_HTML;
      pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([targetLoc.lng, targetLoc.lat])
        .addTo(map);
    } else {
      pickupMarkerRef.current.setLngLat([targetLoc.lng, targetLoc.lat]);
    }
  }, [homeLocation?.lat, homeLocation?.lng, pickup.lat, pickup.lng]);

  // Dropoff marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (dropoff) {
      if (!dropoffMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'trivora-marker-icon';
        el.innerHTML = DROPOFF_ICON_HTML;
        dropoffMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([dropoff.lng, dropoff.lat])
          .addTo(map);
      } else {
        dropoffMarkerRef.current.setLngLat([dropoff.lng, dropoff.lat]);
      }
    } else if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }
  }, [dropoff?.lat, dropoff?.lng]);

  // Driver marker
  const roundedHeading = driverLocation ? Math.round(driverLocation.heading / 5) * 5 : 0;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driverLocation) {
      if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'trivora-driver-marker-icon';
        el.innerHTML = driverIconHtml(roundedHeading, tricycleUri);
        driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map);
      } else {
        driverMarkerRef.current.setLngLat([driverLocation.lng, driverLocation.lat]);
        const el = driverMarkerRef.current.getElement();
        if (el) el.innerHTML = driverIconHtml(roundedHeading, tricycleUri);
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }
  }, [driverLocation?.lat, driverLocation?.lng, roundedHeading]);

  // Toda pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    todaMarkersRef.current.forEach((m) => m.remove());
    todaMarkersRef.current = [];

    if (showTodaPins && (!hasRoute || rideState === 'idle')) {
      todaList.forEach((zone) => {
        const el = document.createElement('div');
        el.className = 'toda-pin-marker';
        el.innerHTML = todaIconHtml();
        el.onclick = () => onTodaPress?.(zone);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([zone.centerLng, zone.centerLat])
          .addTo(map);
        todaMarkersRef.current.push(marker);
      });
    }
  }, [showTodaPins, hasRoute, rideState, todaList, onTodaPress]);

  // Camera framing function
  const frameRelevantPoints = useCallback(
    (animated: boolean) => {
      const map = mapRef.current;
      if (!map) return;

      const targetEnd =
        dropoff ||
        (isEnRoute && driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null);

      if (targetEnd) {
        const points = [
          { lat: pickup.lat, lng: pickup.lng },
          { lat: targetEnd.lat, lng: targetEnd.lng },
        ];
        if (driverLocation) points.push({ lat: driverLocation.lat, lng: driverLocation.lng });

        if (routeCoordinates && routeCoordinates.length > 0) {
          const step = Math.max(1, Math.ceil(routeCoordinates.length / MAX_FIT_ROUTE_POINTS));
          routeCoordinates.forEach((c, i) => {
            if (i % step === 0 || i === routeCoordinates.length - 1) points.push({ lat: c.lat, lng: c.lng });
          });
        }
        const b = boundsOf(points);
        map.fitBounds(
          [
            [b[0], b[1]],
            [b[2], b[3]],
          ],
          { padding: edgePadding, pitch: effectivePitch, duration: animated ? 500 : 0 }
        );
      } else {
        const pinPoint = homeLocation ?? pickup;
        const padding = isHomeMap ? edgePadding : { top: 0, right: 0, bottom: 0, left: 0 };
        followCenterRef.current = homeLocation;
        map.easeTo({
          center: [pinPoint.lng, pinPoint.lat],
          zoom: 16,
          padding,
          pitch: effectivePitch,
          duration: animated ? 600 : 0,
        });
      }
      if (driverLocation) lastFramedRef.current = { lat: driverLocation.lat, lng: driverLocation.lng };
    },
    [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, driverLocation?.lat, driverLocation?.lng, edgePadding, routeCoordinates, homeLocation?.lat, homeLocation?.lng, isHomeMap, effectivePitch]
  );

  // Auto-frame on destination / phase changes
  useEffect(() => {
    if (!mapReady) return;
    frameRelevantPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, isInTransit, edgePadding, isEnRoute || isInTransit ? null : routeCoordinates, !!homeLocation]);

  // While following driver, re-frame once moved >= REFRAME_THRESHOLD_KM
  useEffect(() => {
    if (!isFollowing || !driverLocation || !lastFramedRef.current) return;
    const moved = haversineKm(lastFramedRef.current, driverLocation);
    if (moved >= REFRAME_THRESHOLD_KM) frameRelevantPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation?.lat, driverLocation?.lng]);

  // Following user on Home
  useEffect(() => {
    if (!homeLocation || !isFollowingRef.current) return;
    const last = followCenterRef.current;
    if (!last || haversineKm(last, homeLocation) >= FOLLOW_MIN_MOVE_KM) {
      followCenterRef.current = homeLocation;
      mapRef.current?.easeTo({
        center: [homeLocation.lng, homeLocation.lat],
        zoom: 16,
        padding: edgePadding,
        pitch: effectivePitch,
        duration: 500,
      });
    }
  }, [homeLocation?.lat, homeLocation?.lng, edgePadding, effectivePitch]);

  const handleFocus = () => {
    if (!homeLocation) return;
    isFollowingRef.current = true;
    setIsFollowingUser(true);
    followCenterRef.current = homeLocation;
    mapRef.current?.easeTo({
      center: [homeLocation.lng, homeLocation.lat],
      zoom: 16,
      padding: edgePadding,
      pitch: effectivePitch,
      duration: 500,
    });
  };

  const handleRecenter = () => {
    frameRelevantPoints(true);
    if (onRecenter) onRecenter();
  };

  return (
    <View style={[styles.container, style]}>
      {/* MapLibre Web GL Map Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

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

      {/* TODA Zone Floating Pill */}
      {showTodaPill && activeZone && (
        <TouchableOpacity style={styles.todaPill} activeOpacity={0.8} onPress={() => onTodaPress?.(activeZone)}>
          <Shield size={13} color="#FFFFFF" />
          <Text style={styles.todaPillText}>{activeZone.code}</Text>
          <ChevronRight size={11} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
      )}

      {/* Focus Current Location (Home only) */}
      {focusCurrentLocation && !hasRoute && (
        <TouchableOpacity
          style={[styles.focusButton, { bottom: bottomInset + 12 }, isFollowingUser && styles.focusButtonActive]}
          onPress={handleFocus}
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
    zIndex: 10,
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
    zIndex: 10,
  },
  todaPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
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
    zIndex: 10,
  },
  focusButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
    zIndex: 10,
  },
});
