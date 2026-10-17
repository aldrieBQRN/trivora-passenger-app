import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { PICKUP_PIN_IMAGE, DESTINATION_PIN_IMAGE } from '../constants/mapPins';
import { OPENFREEMAP_BRIGHT_STYLE, TOP_DOWN_PITCH, PIN_SIZE, deltaToZoom, routeLineFeature, routeLinePaint } from '../constants/openFreeMap';
import { LocationPoint } from '../types';
import { usePinLocation } from '../hooks/usePinLocation';
import PinLocationSheet from './PinLocationSheet';
import PinLocationPending from './PinLocationPending';

/** Pin Location camera span (degrees, ~1.1 km), converted to a MapLibre zoom. */
const PIN_ZOOM_DELTA = 0.01;
/** Below this (degrees, ~2 m) a settled camera counts as "same point" — e.g. a pinch zoom. */
const SAME_POINT_EPS = 0.00002;
const isSamePoint = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < SAME_POINT_EPS && Math.abs(a.lng - b.lng) < SAME_POINT_EPS;

interface PinLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmPin: (location: LocationPoint) => void;
  currentPickup?: LocationPoint;
  initialLocation?: LocationPoint;
  mode?: 'pickup' | 'destination';
  confirmLabel?: string;
  showRoute?: boolean;
}

function PinLocationModalContent({
  visible,
  onClose,
  onConfirmPin,
  currentPickup,
  initialLocation,
  mode = 'destination',
  confirmLabel,
  showRoute = true,
}: PinLocationModalProps) {
  const cameraRef = useRef<CameraRef | null>(null);
  const pinZoom = deltaToZoom(PIN_ZOOM_DELTA);
  // The second endpoint (pin + route). Without a route, currentPickup only centers the map.
  const otherEndpoint = showRoute ? currentPickup : undefined;
  const {
    pinnedLocation,
    routeCoordinates,
    routeSource,
    distanceKm,
    durationMinutes,
    fareTotal,
    isResolving,
    pickPoint,
    awaitingLocation,
    isLocating,
    locationError,
    retryLocation,
  } = usePinLocation(
    otherEndpoint,
    initialLocation,
    mode
  );

  // Pin Pickup Location: the map mounts immediately (tiles start loading) while the real GPS fix
  // is fetched; the pin and camera land on it the moment it arrives. Nothing is pinned, and
  // nothing can be confirmed, until then.
  const initialCenter = useRef(
    pinnedLocation || (currentPickup ? currentPickup : { lat: 14.0718, lng: 120.6325 })
  ).current;

  const wasAwaitingRef = useRef(awaitingLocation);
  useEffect(() => {
    if (wasAwaitingRef.current && !awaitingLocation && pinnedLocation) {
      wasAwaitingRef.current = false;
      cameraRef.current?.easeTo({
        center: [pinnedLocation.lng, pinnedLocation.lat],
        zoom: pinZoom,
        pitch: TOP_DOWN_PITCH,
        duration: initialCenter ? 600 : 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingLocation]);

  // The pin is fixed at the map's centre and the map moves under it, so the camera must follow any
  // pin change the user didn't make by dragging (e.g. Pin Pickup's GPS fix arriving).
  const [isDragging, setIsDragging] = useState(false);
  const lastPickRef = useRef<{ lat: number; lng: number } | null>(null);
  const pick = (point: { lat: number; lng: number }) => {
    lastPickRef.current = point;
    pickPoint(point);
  };
  useEffect(() => {
    if (!pinnedLocation || awaitingLocation) return;
    if (lastPickRef.current && isSamePoint(lastPickRef.current, pinnedLocation)) return;
    lastPickRef.current = { lat: pinnedLocation.lat, lng: pinnedLocation.lng };
    cameraRef.current?.easeTo({ center: [pinnedLocation.lng, pinnedLocation.lat], pitch: TOP_DOWN_PITCH, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedLocation?.lat, pinnedLocation?.lng, awaitingLocation]);

  // Only a FAILED location (permission denied / no GPS) replaces the map with the retry screen.
  if (awaitingLocation && locationError && !isLocating) {
    return <PinLocationPending isLocating={isLocating} error={locationError} onRetry={retryLocation} onClose={onClose} />;
  }

  // Tap is a shortcut: the map glides so the tapped point sits under the centre pin.
  const handlePress = (e: { nativeEvent: { lngLat: [number, number] } }) => {
    if (awaitingLocation) return;
    const [lng, lat] = e.nativeEvent.lngLat;
    cameraRef.current?.easeTo({ center: [lng, lat], pitch: TOP_DOWN_PITCH, duration: 400 });
    pick({ lat, lng });
  };

  // Dragging the map: the point under the centre pin is picked once the map settles. Programmatic
  // moves (recenter, follow, tap glide) aren't user interaction, so they never re-pick.
  const handleRegionWillChange = (e: { nativeEvent: { userInteraction: boolean } }) => {
    if (e.nativeEvent.userInteraction) setIsDragging(true);
  };
  const handleRegionDidChange = (e: { nativeEvent: { userInteraction: boolean; center: [number, number] } }) => {
    setIsDragging(false);
    if (awaitingLocation || !e.nativeEvent.userInteraction) return;
    const [lng, lat] = e.nativeEvent.center;
    if (lastPickRef.current && isSamePoint(lastPickRef.current, { lat, lng })) return;
    pick({ lat, lng });
  };

  // Recenter on the pin (not a fit-to-route): the centre pin must always mark the map's centre.
  const handleRecenter = () => {
    if (awaitingLocation) return;
    if (pinnedLocation) {
      cameraRef.current?.easeTo({ center: [pinnedLocation.lng, pinnedLocation.lat], zoom: pinZoom, pitch: TOP_DOWN_PITCH, duration: 600 });
    } else if (currentPickup) {
      cameraRef.current?.easeTo({ center: [currentPickup.lng, currentPickup.lat], zoom: pinZoom, pitch: TOP_DOWN_PITCH, duration: 600 });
    }
  };

  return (
    <PinLocationSheet
      pinnedLocation={pinnedLocation}
      isResolving={isResolving || awaitingLocation}
      onClose={onClose}
      onRecenter={handleRecenter}
      onConfirm={() => {
        if (!pinnedLocation) return;
        onConfirmPin(pinnedLocation);
        onClose();
      }}
      mode={mode}
      confirmLabel={confirmLabel}
      interaction="drag"
      estimate={
        otherEndpoint && routeCoordinates.length > 0
          ? `${distanceKm.toFixed(1)} km · ${Math.max(1, Math.round(durationMinutes))} min · ₱${fareTotal.toFixed(2)} est.`
          : null
      }
    >
      <Map
        style={StyleSheet.absoluteFillObject}
        mapStyle={OPENFREEMAP_BRIGHT_STYLE}
        attribution={true}
        attributionPosition={{ bottom: 8, left: 8 }}
        logo={false}
        compass={false}
        onPress={handlePress}
        onRegionWillChange={handleRegionWillChange}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera
          ref={cameraRef}
          initialViewState={initialCenter ? { center: [initialCenter.lng, initialCenter.lat], zoom: pinZoom, pitch: TOP_DOWN_PITCH } : undefined}
        />

        {/* Route: a style layer above the OpenFreeMap basemap, below the pins (native views). */}
        {routeCoordinates.length > 0 && (
          <GeoJSONSource id="pin-route" data={routeLineFeature(routeCoordinates)}>
            <Layer
              id="pin-route-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': routeSource === 'fallback' ? 'butt' : 'round' }}
              paint={routeLinePaint(routeSource === 'fallback')}
            />
          </GeoJSONSource>
        )}

        {/* Same static pins as the booking map (constants/mapPins) — tip anchored "bottom".
            currentPickup is really "the other, unchanged endpoint": in pickup mode that's the
            destination (red), in destination mode the pickup (green); the pin being dropped is
            colored by what it's ABOUT TO BECOME. */}
        {otherEndpoint ? (
          <Marker id="other-endpoint-pin" lngLat={[otherEndpoint.lng, otherEndpoint.lat]} anchor="bottom">
            <Image source={mode === 'pickup' ? DESTINATION_PIN_IMAGE : PICKUP_PIN_IMAGE} style={PIN_SIZE} />
          </Marker>
        ) : null}

      </Map>

      {/* The pin being dropped: fixed at the map's centre (tip on the exact point), lifted a little
          while the map is being dragged. Coloured by what it's ABOUT TO BECOME. */}
      {!awaitingLocation ? (
        <View style={[styles.centerPin, isDragging && styles.centerPinLifted]} pointerEvents="none">
          <Image source={mode === 'pickup' ? PICKUP_PIN_IMAGE : DESTINATION_PIN_IMAGE} style={PIN_SIZE} />
        </View>
      ) : null}
    </PinLocationSheet>
  );
}

const styles = StyleSheet.create({
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -PIN_SIZE.width / 2,
    marginTop: -PIN_SIZE.height,
  },
  centerPinLifted: {
    transform: [{ translateY: -8 }],
  },
});

/** Mounts the content only while open, so each opening starts fresh — in particular Pin Pickup
 * Location re-acquires the user's current position every time it is opened. */
export default function PinLocationModal(props: PinLocationModalProps) {
  if (!props.visible) return null;
  return <PinLocationModalContent {...props} />;
}
