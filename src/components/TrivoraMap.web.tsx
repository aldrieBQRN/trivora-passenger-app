import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';
import { Compass, Shield, ChevronRight, Zap } from 'lucide-react-native';
import { TODA_ZONES } from '../constants/todaRoutes';
import { fetchTodaZones } from '../services/api';
import { TodaZone } from '../types';
import { TrivoraMapProps } from './TrivoraMap.types';
import { haversineKm } from '../utils/routeInterpolation';

/** Mirrors the native map's re-frame threshold — see TrivoraMap.native.tsx. */
const REFRAME_THRESHOLD_KM = 0.12;
const EDGE_MARGIN = 40;

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3qo7_1_ac41fdc9883213d666d06544';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

/** `anchorBottom` switches the icon's anchor from its center (plain circular markers, e.g. the
 * driver marker) to its bottom tip (teardrop pin markers, e.g. pickup/dropoff/TODA) — a pin
 * shape needs to point down at the actual coordinate, not float centered over it. */
export function makeDivIcon(html: string, size: number, anchorBottom = false): L.DivIcon {
  return L.divIcon({
    html,
    className: 'trivora-marker-icon',
    iconSize: [size, size],
    iconAnchor: anchorBottom ? [size / 2, size] : [size / 2, size / 2],
  });
}

/** Same teardrop-pin shape as the TODA marker below, just recolored — pickup is green,
 * dropoff is red, so both read as pins "similar to the TODA pin" rather than a plain dot. */
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

function driverIconHtml(heading: number): string {
  return `
    <div style="width:36px;height:36px;border-radius:18px;background:#FFFFFF;border:2.5px solid ${COLORS.primary};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(15,23,42,0.35);transform:rotate(${heading}deg);">
      <div style="width:11px;height:11px;border-radius:6px;background:#3B82F6;"></div>
    </div>
  `;
}

interface MapControllerProps {
  pickup: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number } | null;
  driverLocation?: { lat: number; lng: number } | null;
  isEnRoute: boolean;
  isFollowing: boolean;
  topInset: number;
  bottomInset: number;
  recenterSignal: number;
}

/** Imperatively frames the map — Leaflet has no declarative "fit these points" prop. Frames on
 * mount and on destination/phase changes (not on every driver-position tick — previously this
 * re-ran on every ~2.8s simulated GPS update, fighting any manual pan/zoom), re-frames while
 * following a driver only once they've moved meaningfully since the last frame, and re-frames on
 * demand via the compass button's recenterSignal. Padding is derived from the caller's actual
 * header/bottom-sheet insets instead of a fixed guess. */
function MapController({
  pickup,
  dropoff,
  driverLocation,
  isEnRoute,
  isFollowing,
  topInset,
  bottomInset,
  recenterSignal,
}: MapControllerProps) {
  const map = useMap();
  const lastFramedRef = useRef<{ lat: number; lng: number } | null>(null);

  const frame = useCallback(
    (animated: boolean) => {
      const targetEnd = dropoff || (isEnRoute && driverLocation ? driverLocation : null);
      if (targetEnd) {
        const points: [number, number][] = [
          [pickup.lat, pickup.lng],
          [targetEnd.lat, targetEnd.lng],
        ];
        if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
        const bounds = L.latLngBounds(points);
        const opts = {
          paddingTopLeft: [EDGE_MARGIN, topInset + EDGE_MARGIN] as [number, number],
          paddingBottomRight: [EDGE_MARGIN, bottomInset + EDGE_MARGIN] as [number, number],
        };
        if (animated) map.flyToBounds(bounds, { ...opts, duration: 0.6 });
        else map.fitBounds(bounds, opts);
      } else {
        // Single point (Home, no route yet) — fitBounds/flyToBounds has no effect with only one
        // point, and a plain setView/flyTo centers on the mathematical middle of the WHOLE
        // container, ignoring the header/sheet chrome entirely. Instead, find where the pickup
        // point would render if the map were centered on it, shift that pixel by half the
        // top/bottom inset difference, and center the map on whatever geographic point lands
        // there instead — using the map's own current projection/zoom, not a guessed offset.
        const zoom = 16;
        const pickupPixel = map.project(L.latLng(pickup.lat, pickup.lng), zoom);
        const verticalOffset = (topInset - bottomInset) / 2;
        const shiftedPixel = L.point(pickupPixel.x, pickupPixel.y - verticalOffset);
        const center = map.unproject(shiftedPixel, zoom);
        if (animated) map.flyTo(center, zoom, { duration: 0.6 });
        else map.setView(center, zoom);
      }
      if (driverLocation) lastFramedRef.current = driverLocation;
    },
    [map, pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, driverLocation?.lat, driverLocation?.lng, topInset, bottomInset]
  );

  // Leaflet needs an explicit size recalculation once it's actually laid out
  // inside a flex container, otherwise tiles can render blank until resize.
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    frame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, topInset, bottomInset]);

  useEffect(() => {
    if (!isFollowing || !driverLocation || !lastFramedRef.current) return;
    const moved = haversineKm(lastFramedRef.current, driverLocation);
    if (moved >= REFRAME_THRESHOLD_KM) frame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation?.lat, driverLocation?.lng]);

  useEffect(() => {
    if (recenterSignal > 0) frame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  return null;
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

  const [recenterSignal, setRecenterSignal] = useState(0);

  const isEnRoute = rideState === 'driver_en_route' || rideState === 'accepted';
  const isInTransit = rideState === 'in_transit';
  const hasRoute = !!dropoff || isEnRoute || isInTransit;
  const isFallbackRoute = routeSource === 'fallback';
  const isFollowing = (isEnRoute || isInTransit) && !!driverLocation;

  const pickupIcon = useMemo(() => makeDivIcon(PICKUP_ICON_HTML, 22, true), []);
  const dropoffIcon = useMemo(() => makeDivIcon(DROPOFF_ICON_HTML, 32, true), []);
  const todaMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'toda-pin-marker',
        html: `
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
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      }),
    []
  );
  // Rounded to the nearest 5° so tiny simulated-GPS heading jitter doesn't rebuild this DOM icon
  // on every tick — imperceptible visually, but cuts marker recreation frequency noticeably.
  const roundedHeading = driverLocation ? Math.round(driverLocation.heading / 5) * 5 : 0;
  const driverIcon = useMemo(
    () => (driverLocation ? makeDivIcon(driverIconHtml(roundedHeading), 36) : null),
    [!!driverLocation, roundedHeading]
  );

  const polylinePositions = useMemo<[number, number][]>(
    () => (routeCoordinates || []).map((c) => [c.lat, c.lng]),
    [routeCoordinates]
  );

  const handleRecenter = () => {
    setRecenterSignal((n) => n + 1);
    if (onRecenter) onRecenter();
  };

  return (
    <View style={[styles.container, style]}>
      {/* zoomControl disabled to match the Driver app's map — pinch/scroll zoom still works,
          and the default +/- buttons had no free corner to sit in over a full-bleed map. */}
      <MapContainer center={[pickup.lat, pickup.lng]} zoom={16} zoomControl={false} style={styles.leafletContainer as any}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

        <MapController
          pickup={pickup}
          dropoff={dropoff}
          driverLocation={driverLocation}
          isEnRoute={isEnRoute}
          isFollowing={isFollowing}
          topInset={topInset}
          bottomInset={bottomInset}
          recenterSignal={recenterSignal}
        />

        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />

        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}

        {driverLocation && driverIcon && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
        )}

        {polylinePositions.length > 0 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: isFallbackRoute ? '#94A3B8' : '#2563EB',
              weight: isFallbackRoute ? 4 : 5,
              dashArray: isFallbackRoute ? '8,6' : undefined,
            }}
          />
        )}
      </MapContainer>

      {/* Floating Elements on Top of the Map */}

      {showRouteBadge && hasRoute && suggestedRouteInfo && (
        <View style={styles.suggestedRouteBadge} pointerEvents="none">
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
  leafletContainer: {
    height: '100%',
    width: '100%',
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
    zIndex: 500,
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
    fontSize: 9,
    color: '#2563EB',
    fontWeight: '800',
    marginTop: 2,
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
    zIndex: 500,
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
    zIndex: 500,
  },
});
