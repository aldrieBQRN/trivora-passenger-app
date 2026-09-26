import React, { useRef } from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, MapPressEvent } from 'react-native-maps';
import { PICKUP_PIN_IMAGE, DESTINATION_PIN_IMAGE } from '../constants/mapPins';
import { LocationPoint } from '../types';
import { usePinLocation } from '../hooks/usePinLocation';
import PinLocationSheet from './PinLocationSheet';
import PinLocationPending from './PinLocationPending';

const CARTO_URL_TEMPLATE =
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3qo7_1_ac41fdc9883213d666d06544';

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
  const mapRef = useRef<MapView | null>(null);
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

  if (awaitingLocation) {
    return <PinLocationPending isLocating={isLocating} error={locationError} onRetry={retryLocation} onClose={onClose} />;
  }

  const handlePress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    pickPoint({ lat: latitude, lng: longitude });
  };

  const handleRecenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: pinnedLocation.lat,
        longitude: pinnedLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  };

  return (
    <PinLocationSheet
      pinnedLocation={pinnedLocation}
      isResolving={isResolving}
      onClose={onClose}
      onRecenter={handleRecenter}
      onConfirm={() => {
        onConfirmPin(pinnedLocation);
        onClose();
      }}
      mode={mode}
      confirmLabel={confirmLabel}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: pinnedLocation.lat,
          longitude: pinnedLocation.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        onPress={handlePress}
      >
        <UrlTile
          urlTemplate={CARTO_URL_TEMPLATE}
          maximumZ={19}
          flipY={false}
          tileSize={256}
          shouldReplaceMapContent={true}
          zIndex={1}
        />

        {/* Same static pins as the booking map (constants/mapPins) — tip anchored (0.5, 1).
            currentPickup is really "the other, unchanged endpoint": in pickup mode that's the
            destination (red), in destination mode the pickup (green); the pin being dropped is
            colored by what it's ABOUT TO BECOME. */}
        {currentPickup && (
          <Marker
            zIndex={10}
            coordinate={{ latitude: currentPickup.lat, longitude: currentPickup.lng }}
            image={mode === 'pickup' ? DESTINATION_PIN_IMAGE : PICKUP_PIN_IMAGE}
            anchor={{ x: 0.5, y: 1 }}
          />
        )}

        <Marker
          zIndex={11}
          coordinate={{ latitude: pinnedLocation.lat, longitude: pinnedLocation.lng }}
          image={mode === 'pickup' ? PICKUP_PIN_IMAGE : DESTINATION_PIN_IMAGE}
          anchor={{ x: 0.5, y: 1 }}
          onPress={(e) => {
            e.stopPropagation();
            handleRecenter();
          }}
        />

        {routeCoordinates.length > 0 && (
          <Polyline
            // Above the basemap UrlTile (zIndex 1), below the pins (10+) — at the default 0 the
            // route is drawn under the opaque tile overlay and never shows.
            zIndex={2}
            coordinates={routeCoordinates.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
            strokeColor={routeSource === 'fallback' ? '#94A3B8' : '#2563EB'}
            strokeWidth={routeSource === 'fallback' ? 4 : 5}
            lineDashPattern={routeSource === 'fallback' ? [8, 6] : undefined}
          />
        )}
      </MapView>
    </PinLocationSheet>
  );
}

/** Mounts the content only while open, so each opening starts fresh — in particular Pin Pickup
 * Location re-acquires the user's current position every time it is opened. */
export default function PinLocationModal(props: PinLocationModalProps) {
  if (!props.visible) return null;
  return <PinLocationModalContent {...props} />;
}
