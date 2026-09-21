import React, { useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, MapPressEvent } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import { LocationPoint } from '../types';
import { usePinLocation } from '../hooks/usePinLocation';
import { TODA_ZONES } from '../constants/todaRoutes';
import PinLocationSheet from './PinLocationSheet';

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

export default function PinLocationModal({
  visible,
  onClose,
  onConfirmPin,
  currentPickup,
  initialLocation,
  mode = 'destination',
  confirmLabel,
}: PinLocationModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const { pinnedLocation, routeCoordinates, routeSource, isResolving, pickPoint, pickToda, todaList } = usePinLocation(
    currentPickup,
    initialLocation
  );

  if (!visible) return null;

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

        {/* TODA Terminal Markers */}
        {(todaList || TODA_ZONES).map((zone) => (
          <Marker
            key={zone.code}
            coordinate={{ latitude: zone.centerLat, longitude: zone.centerLng }}
            onPress={(e) => {
              e.stopPropagation();
              pickToda(zone);
              mapRef.current?.animateToRegion(
                {
                  latitude: zone.centerLat,
                  longitude: zone.centerLng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                500
              );
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.todaPinContainer}>
              <View style={styles.todaPinDrop}>
                <View style={styles.todaPinIconInner}>
                  <MapPin size={12} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </View>
            </View>
          </Marker>
        ))}

        {/* currentPickup is really just "the other, unchanged endpoint" — in pickup mode that's
            actually the destination, so its color must follow what it represents, not its prop
            name. The pin being dropped is colored by what it's ABOUT TO BECOME, not a fixed
            "pinning = destination" assumption — this is the part that was backwards before. */}
        {currentPickup && (
          <Marker coordinate={{ latitude: currentPickup.lat, longitude: currentPickup.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={mode === 'pickup' ? styles.referenceDotRed : styles.referenceDotGreen} />
          </Marker>
        )}

        <Marker
          coordinate={{ latitude: pinnedLocation.lat, longitude: pinnedLocation.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={(e) => {
            e.stopPropagation();
            handleRecenter();
          }}
        >
          <View style={mode === 'pickup' ? styles.pinBubbleGreen : styles.pinBubbleRed} />
        </Marker>

        {routeCoordinates.length > 0 && (
          <Polyline
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

const styles = StyleSheet.create({
  referenceDotGreen: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#059669',
  },
  referenceDotRed: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  pinBubbleGreen: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinBubbleRed: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  todaPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaPinDrop: {
    width: 26,
    height: 26,
    backgroundColor: '#1D2542',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 13,
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
});
