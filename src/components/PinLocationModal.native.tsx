import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { PICKUP_PIN_IMAGE, DESTINATION_PIN_IMAGE } from '../constants/mapPins';
import { CARTO_MAP_STYLE, PIN_SIZE, deltaToZoom, routeLineFeature, routeLinePaint, boundsOf } from '../constants/cartoMap';
import { LocationPoint } from '../types';
import { usePinLocation } from '../hooks/usePinLocation';
import PinLocationSheet from './PinLocationSheet';
import PinLocationPending from './PinLocationPending';

/** Pin Location camera span (degrees, ~1.1 km), converted to a MapLibre zoom. */
const PIN_ZOOM_DELTA = 0.01;

interface PinLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmPin: (location: LocationPoint) => void;
  currentPickup?: LocationPoint;
  initialLocation?: LocationPoint;
  mode?: 'pickup' | 'destination';
  confirmLabel?: string;
}

function PinLocationModalContent({
  visible,
  onClose,
  onConfirmPin,
  currentPickup,
  initialLocation,
  mode = 'destination',
  confirmLabel,
}: PinLocationModalProps) {
  const cameraRef = useRef<CameraRef | null>(null);
  const pinZoom = deltaToZoom(PIN_ZOOM_DELTA);
  const {
    pinnedLocation,
    routeCoordinates,
    routeSource,
    isResolving,
    pickPoint,
    awaitingLocation,
    isLocating,
    locationError,
    retryLocation,
  } = usePinLocation(
    currentPickup,
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
        duration: initialCenter ? 600 : 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingLocation]);

  // Only a FAILED location (permission denied / no GPS) replaces the map with the retry screen.
  if (awaitingLocation && locationError && !isLocating) {
    return <PinLocationPending isLocating={isLocating} error={locationError} onRetry={retryLocation} onClose={onClose} />;
  }

  const handlePress = (e: { nativeEvent: { lngLat: [number, number] } }) => {
    if (awaitingLocation) return;
    const [lng, lat] = e.nativeEvent.lngLat;
    pickPoint({ lat, lng });
  };

  const handleRecenter = () => {
    if (awaitingLocation) return;
    if (currentPickup && pinnedLocation) {
      const points: { lat: number; lng: number }[] = [
        { lat: currentPickup.lat, lng: currentPickup.lng },
        { lat: pinnedLocation.lat, lng: pinnedLocation.lng },
      ];
      if (routeCoordinates && routeCoordinates.length > 0) {
        const step = Math.max(1, Math.ceil(routeCoordinates.length / 20));
        routeCoordinates.forEach((c, i) => {
          if (i % step === 0 || i === routeCoordinates.length - 1) {
            points.push({ lat: c.lat, lng: c.lng });
          }
        });
      }
      cameraRef.current?.fitBounds(boundsOf(points), {
        padding: { top: 110, right: 32, bottom: 220, left: 32 },
        duration: 500,
      });
    } else if (pinnedLocation) {
      cameraRef.current?.easeTo({ center: [pinnedLocation.lng, pinnedLocation.lat], zoom: pinZoom, duration: 600 });
    } else if (currentPickup) {
      cameraRef.current?.easeTo({ center: [currentPickup.lng, currentPickup.lat], zoom: pinZoom, duration: 600 });
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
    >
      <Map
        style={StyleSheet.absoluteFillObject}
        mapStyle={CARTO_MAP_STYLE}
        attribution={false}
        logo={false}
        compass={false}
        onPress={handlePress}
      >
        <Camera
          ref={cameraRef}
          initialViewState={initialCenter ? { center: [initialCenter.lng, initialCenter.lat], zoom: pinZoom } : undefined}
        />

        {/* Route: a style layer above the CARTO raster, below the pins (native views). */}
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
        {currentPickup ? (
          <Marker id="other-endpoint-pin" lngLat={[currentPickup.lng, currentPickup.lat]} anchor="bottom">
            <Image source={mode === 'pickup' ? DESTINATION_PIN_IMAGE : PICKUP_PIN_IMAGE} style={PIN_SIZE} />
          </Marker>
        ) : null}

        {/* Rendered last so it draws above the other pin. Tapping it recenters (not a new pick). */}
        {!awaitingLocation && pinnedLocation ? (
          <Marker
            id="pinned-pin"
            lngLat={[pinnedLocation.lng, pinnedLocation.lat]}
            anchor="bottom"
            onPress={handleRecenter}
          >
            <Image source={mode === 'pickup' ? PICKUP_PIN_IMAGE : DESTINATION_PIN_IMAGE} style={PIN_SIZE} />
          </Marker>
        ) : null}
      </Map>
    </PinLocationSheet>
  );
}

/** Mounts the content only while open, so each opening starts fresh — in particular Pin Pickup
 * Location re-acquires the user's current position every time it is opened. */
export default function PinLocationModal(props: PinLocationModalProps) {
  if (!props.visible) return null;
  return <PinLocationModalContent {...props} />;
}
