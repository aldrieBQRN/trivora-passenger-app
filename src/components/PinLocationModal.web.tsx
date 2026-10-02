import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocationPoint } from '../types';
import { usePinLocation } from '../hooks/usePinLocation';
import PinLocationSheet from './PinLocationSheet';
import PinLocationPending from './PinLocationPending';
import { PICKUP_ICON_HTML, DROPOFF_ICON_HTML } from './TrivoraMap.web';
import { OPENFREEMAP_BRIGHT_STYLE, TOP_DOWN_PITCH, boundsOf } from '../constants/openFreeMap';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
  } = usePinLocation(currentPickup, initialLocation, mode);

  const isFallbackRoute = routeSource === 'fallback';

  const initialCenter = useRef(
    pinnedLocation || (currentPickup ? currentPickup : { lat: 14.0718, lng: 120.6325 })
  ).current;

  // Markers refs
  const pinnedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const otherMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Sync route layer helper
  const syncRouteLayer = useCallback(
    (map: maplibregl.Map, coords: { lat: number; lng: number }[], fallback: boolean) => {
      if (!map.isStyleLoaded()) return;
      const lineCoords = coords.map((c) => [c.lng, c.lat]);
      const data: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: lineCoords },
      };

      const source = map.getSource('pin-route') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else if (lineCoords.length > 0) {
        map.addSource('pin-route', { type: 'geojson', data });
        map.addLayer({
          id: 'pin-route-line',
          type: 'line',
          source: 'pin-route',
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

  // Recenter handler
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || awaitingLocation) return;

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
      const b = boundsOf(points);
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        {
          padding: { top: 110, right: 32, bottom: 220, left: 32 },
          pitch: TOP_DOWN_PITCH,
          duration: 500,
        }
      );
    } else if (pinnedLocation) {
      map.easeTo({ center: [pinnedLocation.lng, pinnedLocation.lat], zoom: 16, pitch: TOP_DOWN_PITCH, duration: 600 });
    } else if (currentPickup) {
      map.easeTo({ center: [currentPickup.lng, currentPickup.lat], zoom: 16, pitch: TOP_DOWN_PITCH, duration: 600 });
    }
  }, [awaitingLocation, currentPickup, pinnedLocation, routeCoordinates]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const centerPoint = initialCenter;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_BRIGHT_STYLE,
      center: [centerPoint.lng, centerPoint.lat],
      zoom: 16,
      pitch: TOP_DOWN_PITCH,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      setMapReady(true);
      syncRouteLayer(map, routeCoordinates || [], isFallbackRoute);
    });

    map.on('styleimagemissing', (e: { id: string }) => {
      const id = e?.id;
      if (id && !map.hasImage(id)) {
        map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      pickPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;

    return () => {
      pinnedMarkerRef.current?.remove();
      otherMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync route coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncRouteLayer(map, routeCoordinates || [], isFallbackRoute);
  }, [routeCoordinates, isFallbackRoute, mapReady, syncRouteLayer]);

  // Other endpoint pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (currentPickup) {
      const isPickupMode = mode === 'pickup';
      const iconHtml = isPickupMode ? DROPOFF_ICON_HTML : PICKUP_ICON_HTML;

      if (!otherMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'trivora-marker-icon';
        el.innerHTML = iconHtml;
        otherMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([currentPickup.lng, currentPickup.lat])
          .addTo(map);
      } else {
        otherMarkerRef.current.setLngLat([currentPickup.lng, currentPickup.lat]);
        const el = otherMarkerRef.current.getElement();
        if (el) el.innerHTML = iconHtml;
      }
    } else if (otherMarkerRef.current) {
      otherMarkerRef.current.remove();
      otherMarkerRef.current = null;
    }
  }, [currentPickup?.lat, currentPickup?.lng, mode]);

  // Pinned location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!awaitingLocation && pinnedLocation) {
      const isPickupMode = mode === 'pickup';
      const iconHtml = isPickupMode ? PICKUP_ICON_HTML : DROPOFF_ICON_HTML;

      if (!pinnedMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'trivora-marker-icon';
        el.innerHTML = iconHtml;
        el.onclick = () => handleRecenter();

        pinnedMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pinnedLocation.lng, pinnedLocation.lat])
          .addTo(map);
      } else {
        pinnedMarkerRef.current.setLngLat([pinnedLocation.lng, pinnedLocation.lat]);
        const el = pinnedMarkerRef.current.getElement();
        if (el) el.innerHTML = iconHtml;
      }
    } else if (pinnedMarkerRef.current) {
      pinnedMarkerRef.current.remove();
      pinnedMarkerRef.current = null;
    }
  }, [awaitingLocation, pinnedLocation?.lat, pinnedLocation?.lng, mode, handleRecenter]);

  // When first real location lands, ease to it
  const wasAwaitingRef = useRef(awaitingLocation);
  useEffect(() => {
    if (wasAwaitingRef.current && !awaitingLocation && pinnedLocation) {
      wasAwaitingRef.current = false;
      mapRef.current?.easeTo({
        center: [pinnedLocation.lng, pinnedLocation.lat],
        zoom: 16,
        pitch: TOP_DOWN_PITCH,
        duration: 600,
      });
    }
  }, [awaitingLocation, pinnedLocation]);

  if (awaitingLocation && locationError && !isLocating) {
    return <PinLocationPending isLocating={isLocating} error={locationError} onRetry={retryLocation} onClose={onClose} />;
  }

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
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
    </PinLocationSheet>
  );
}

export default function PinLocationModal(props: PinLocationModalProps) {
  if (!props.visible) return null;
  return <PinLocationModalContent {...props} />;
}
