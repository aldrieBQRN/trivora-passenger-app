import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationPoint } from '../types';
import { usePinLocation } from '../hooks/usePinLocation';
import PinLocationSheet from './PinLocationSheet';
import { TODA_ZONES } from '../constants/todaRoutes';
import { makeDivIcon, PICKUP_ICON_HTML, DROPOFF_ICON_HTML } from './TrivoraMap.web';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3qo7_1_ac41fdc9883213d666d06544';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

interface PinLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmPin: (location: LocationPoint) => void;
  currentPickup?: LocationPoint;
  initialLocation?: LocationPoint;
  mode?: 'pickup' | 'destination';
  confirmLabel?: string;
}

function ClickHandler({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapController({ target, recenterSignal }: { target: { lat: number; lng: number }; recenterSignal: number }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (recenterSignal > 0) map.flyTo([target.lat, target.lng], 16, { duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  return null;
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
  const [recenterSignal, setRecenterSignal] = useState(0);
  const { pinnedLocation, routeCoordinates, routeSource, isResolving, pickPoint, pickToda, todaList } = usePinLocation(
    currentPickup,
    initialLocation
  );

  // currentPickup is really just "the other, unchanged endpoint" — in pickup mode that's
  // actually the destination, so its color must follow what it represents, not its prop name.
  // The pin being dropped is colored by what it's ABOUT TO BECOME, not a fixed
  // "pinning = destination" assumption — this is the part that was backwards before.
  const referenceIcon = useMemo(
    () => makeDivIcon(mode === 'pickup' ? DROPOFF_ICON_HTML : PICKUP_ICON_HTML, mode === 'pickup' ? 30 : 22, true),
    [mode]
  );
  const pinIcon = useMemo(
    () => makeDivIcon(mode === 'pickup' ? PICKUP_ICON_HTML : DROPOFF_ICON_HTML, mode === 'pickup' ? 22 : 30, true),
    [mode]
  );
  const todaMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'toda-pin-marker',
        html: `
          <div style="cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center;">
            <div style="
              background: #1D2542;
              width: 26px;
              height: 26px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid #FFFFFF;
            ">
              <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
            </div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      }),
    []
  );

  const polylinePositions = useMemo<[number, number][]>(
    () => routeCoordinates.map((c) => [c.lat, c.lng]),
    [routeCoordinates]
  );

  if (!visible) return null;

  return (
    <PinLocationSheet
      pinnedLocation={pinnedLocation}
      isResolving={isResolving}
      onClose={onClose}
      onRecenter={() => setRecenterSignal((n) => n + 1)}
      onConfirm={() => {
        onConfirmPin(pinnedLocation);
        onClose();
      }}
      mode={mode}
      confirmLabel={confirmLabel}
    >
      <MapContainer
        center={[pinnedLocation.lat, pinnedLocation.lng]}
        zoom={16}
        zoomControl={false}
        style={styles.mapContainer as any}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ClickHandler onPick={pickPoint} />
        <MapController target={pinnedLocation} recenterSignal={recenterSignal} />

        {/* TODA Terminal Markers */}
        {(todaList || TODA_ZONES).map((zone) => (
          <Marker
            key={zone.code}
            position={[zone.centerLat, zone.centerLng]}
            icon={todaMarkerIcon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                pickToda(zone);
                setRecenterSignal((n) => n + 1);
              },
            }}
          />
        ))}

        {currentPickup && <Marker position={[currentPickup.lat, currentPickup.lng]} icon={referenceIcon} />}
        <Marker
          position={[pinnedLocation.lat, pinnedLocation.lng]}
          icon={pinIcon}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              setRecenterSignal((n) => n + 1);
            },
          }}
        />

        {polylinePositions.length > 0 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: routeSource === 'fallback' ? '#94A3B8' : '#2563EB',
              weight: routeSource === 'fallback' ? 4 : 5,
              dashArray: routeSource === 'fallback' ? '8,6' : undefined,
            }}
          />
        )}
      </MapContainer>
    </PinLocationSheet>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: '100%',
    width: '100%',
  },
});
