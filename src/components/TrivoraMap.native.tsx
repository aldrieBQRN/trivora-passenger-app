import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';
import { MapPin, Compass, Shield, ChevronRight, Zap } from 'lucide-react-native';
import { TricycleMarker } from './icons';
import { TODA_ZONES } from '../constants/todaRoutes';
import { fetchTodaZones } from '../services/api';
import { TodaZone } from '../types';
import { TrivoraMapProps } from './TrivoraMap.types';
import { haversineKm } from '../utils/routeInterpolation';

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
  const lastFramedRef = useRef<{ lat: number; lng: number } | null>(null);

  const isEnRoute = rideState === 'driver_en_route' || rideState === 'accepted';
  const isInTransit = rideState === 'in_transit';
  const hasRoute = !!dropoff || isEnRoute || isInTransit;
  const isFollowing = (isEnRoute || isInTransit) && !!driverLocation;

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
        mapRef.current.fitToCoordinates(points, { edgePadding, animated });
      } else {
        const map = mapRef.current;
        map.animateToRegion(
          {
            latitude: pickup.lat,
            longitude: pickup.lng,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          animated ? 600 : 0
        );
        // Single point (Home, no route yet) — fitToCoordinates has nothing to fit, and
        // `mapPadding` alone isn't reliably honored for a plain region center on every
        // provider/platform. Once the region above has settled, measure where pickup actually
        // rendered and correct the center in pixel space (via the map's own current projection)
        // so it lands in the middle of the VISIBLE area, not the full container.
        if (topInset !== 0 || bottomInset !== 0) {
          const verticalOffset = (topInset - bottomInset) / 2;
          setTimeout(async () => {
            try {
              const point = await map.pointForCoordinate({ latitude: pickup.lat, longitude: pickup.lng });
              const corrected = await map.coordinateForPoint({ x: point.x, y: point.y - verticalOffset });
              map.animateToRegion(
                {
                  latitude: corrected.latitude,
                  longitude: corrected.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                },
                animated ? 300 : 0
              );
            } catch {}
          }, animated ? 650 : 50);
        }
      }
      if (driverLocation) lastFramedRef.current = { lat: driverLocation.lat, lng: driverLocation.lng };
    },
    [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, driverLocation?.lat, driverLocation?.lng, edgePadding]
  );

  // Auto-frame on mount and whenever the destination or ride phase changes — deliberately NOT
  // on every driver-position tick (previously this effect depended on driverLocation directly
  // and re-ran on every ~2.8s simulated GPS update, fighting any manual pan/zoom and animating
  // the whole map every few seconds even when nothing meaningful had changed).
  useEffect(() => {
    frameRelevantPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, isEnRoute, isInTransit, edgePadding]);

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

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: pickup.lat,
          longitude: pickup.lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        customMapStyle={VOYAGER_MAP_STYLE}
        showsUserLocation={false}
        showsCompass={false}
        mapPadding={edgePadding}
      >
        <UrlTile
          urlTemplate={CARTO_URL_TEMPLATE}
          maximumZ={19}
          flipY={false}
          tileSize={256}
          shouldReplaceMapContent={true}
          zIndex={1}
        />

        {/* TODA Terminal Markers */}
        {showTodaPins &&
          todaList.map((zone) => (
            <Marker
              key={zone.code}
              zIndex={8}
              coordinate={{ latitude: zone.centerLat, longitude: zone.centerLng }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={(e) => {
                e.stopPropagation();
                onTodaPress?.(zone);
              }}
            >
              <View style={styles.todaPinContainer}>
                <View style={styles.todaPinDrop}>
                  <View style={styles.todaPinIconInner}>
                    <MapPin size={11} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                </View>
              </View>
            </Marker>
          ))}

        {/* Pickup Location Marker — same teardrop pin as the TODA markers above, recolored
            green so pickup/dropoff/TODA all read as the same family of pin. */}
        <Marker zIndex={10} coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.todaPinContainer}>
            <View style={[styles.todaPinDrop, styles.pickupPinDrop]}>
              <View style={styles.todaPinIconInner}>
                <MapPin size={11} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
          </View>
        </Marker>

        {/* Dropoff Destination Marker — same pin, colored red */}
        {dropoff && (
          <Marker zIndex={10} coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.todaPinContainer}>
              <View style={[styles.todaPinDrop, styles.destPinDrop]}>
                <View style={styles.todaPinIconInner}>
                  <MapPin size={11} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </View>
            </View>
          </Marker>
        )}

        {/* Moving Driver Marker */}
        {driverLocation && (
          <Marker
            zIndex={12}
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            rotation={driverLocation.heading}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <TricycleMarker size={36} isDriver showEta etaText="3 MIN" heading={driverLocation.heading} />
          </Marker>
        )}

        {/* Real road-following route (or a visibly-fallback straight line) */}
        {polylineCoords.length > 0 && (
          <Polyline
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

      {/* Floating TODA Zone Pill */}
      {showTodaPill && (
        <TouchableOpacity
          style={styles.todaPill}
          onPress={() => onTodaPress?.(activeZone || todaList[0])}
          activeOpacity={0.88}
        >
          <Shield size={12} color={COLORS.textInverse} />
          <Text style={styles.todaPillText}>{activeZone?.name || 'TODA Bucana Zone'}</Text>
          <ChevronRight size={14} color={COLORS.textInverse} />
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
  todaPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaPinDrop: {
    width: 24,
    height: 24,
    backgroundColor: '#1D2542',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 0,
    transform: [{ rotate: '-45deg' }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  todaPinIconInner: {
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPinDrop: {
    backgroundColor: '#059669',
  },
  destPinDrop: {
    backgroundColor: '#EF4444',
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
