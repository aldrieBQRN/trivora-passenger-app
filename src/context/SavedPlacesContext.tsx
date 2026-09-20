import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { SavedPlace } from '../types';
import { passengerApi, mapSavedPlaceRecordToSavedPlace } from '../services/api';
import { useAuth } from './AuthContext';

interface SavedPlacesContextType {
  savedPlaces: SavedPlace[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addSavedPlace: (place: { label: string; address: string; lat: number; lng: number }) => Promise<SavedPlace>;
  editSavedPlace: (
    id: number,
    place: { label: string; address: string; lat: number; lng: number }
  ) => Promise<SavedPlace>;
  removeSavedPlace: (id: number) => Promise<void>;
}

const SavedPlacesContext = createContext<SavedPlacesContextType | null>(null);

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await passengerApi.getSavedPlaces();
      const raw = res?.saved_places || [];
      setSavedPlaces(raw.map(mapSavedPlaceRecordToSavedPlace));
    } catch {
      // Leave whatever was already loaded in place — a transient fetch failure shouldn't
      // wipe out saved places the passenger already saw this session.
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load once the passenger is authenticated; clear on logout so a next login doesn't
  // briefly flash the previous account's saved places.
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setSavedPlaces([]);
    }
  }, [isAuthenticated, refresh]);

  const addSavedPlace = async (place: { label: string; address: string; lat: number; lng: number }) => {
    const res: any = await passengerApi.createSavedPlace({
      label: place.label,
      address: place.address,
      latitude: place.lat,
      longitude: place.lng,
    });
    const created = mapSavedPlaceRecordToSavedPlace(res.saved_place);
    setSavedPlaces((prev) => [created, ...prev]);
    return created;
  };

  const editSavedPlace = async (
    id: number,
    place: { label: string; address: string; lat: number; lng: number }
  ) => {
    const res: any = await passengerApi.updateSavedPlace(id, {
      label: place.label,
      address: place.address,
      latitude: place.lat,
      longitude: place.lng,
    });
    const updated = mapSavedPlaceRecordToSavedPlace(res.saved_place);
    setSavedPlaces((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const removeSavedPlace = async (id: number) => {
    await passengerApi.deleteSavedPlace(id);
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <SavedPlacesContext.Provider
      value={{ savedPlaces, isLoading, refresh, addSavedPlace, editSavedPlace, removeSavedPlace }}
    >
      {children}
    </SavedPlacesContext.Provider>
  );
}

export function useSavedPlaces(): SavedPlacesContextType {
  const context = useContext(SavedPlacesContext);
  if (!context) {
    throw new Error('useSavedPlaces must be used within a SavedPlacesProvider');
  }
  return context;
}
