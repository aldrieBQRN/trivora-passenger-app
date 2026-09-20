import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';
import { setAuthToken, passengerApi, mapAuthResponseToUserProfile } from '../services/api';

const SESSION_STORAGE_KEY = '@trivora_passenger_session';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  /** True while a persisted session is still being restored on app start — callers should hold
   * off rendering the logged-out (onboarding/auth) screens until this settles, otherwise a
   * returning user flashes through the login flow every time the app cold-starts. */
  isRestoring: boolean;
  login: (userData: UserProfile, token?: string | null) => void;
  logout: () => void;
  updateProfile: (fields: Partial<UserProfile>) => void;
  /** Silently refetches the passenger's own profile from the backend (the authoritative source
   * for rating/totalRides/emergencyContact) and replaces `user` with the fresh result — no
   * loading flag, since callers use this to update numbers behind an already-visible screen, not
   * to gate a spinner. A no-op while logged out. Swallows network errors: this is a background
   * refresh, not a user-initiated action that should surface a failure. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);
  // Mirrors the token currently held by api.ts's module-level authToken (which has no getter) so
  // updateProfile — called from screens with no token of its own — can still keep the persisted
  // session's cached profile in sync without re-threading the token through every call site.
  const tokenRef = useRef<string | null>(null);

  const persistSession = async (userData: UserProfile, token: string | null) => {
    if (!token) return;
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token, user: userData }));
    } catch {
      // Persistence is a convenience (staying logged in across a restart) — a failed write just
      // means this session won't survive one, not something to surface to the passenger.
    }
  };

  const login = (userData: UserProfile, token: string | null = null) => {
    setUser(userData);
    setIsAuthenticated(true);
    if (token) {
      tokenRef.current = token;
      setAuthToken(token);
      persistSession(userData, token);
    }
  };

  const logout = () => {
    passengerApi.logout().catch(() => {});
    setUser(null);
    setIsAuthenticated(false);
    tokenRef.current = null;
    setAuthToken(null);
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
  };

  const updateProfile = (fields: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = prev ? { ...prev, ...fields } : null;
      if (next) persistSession(next, tokenRef.current).catch(() => {});
      return next;
    });
  };

  const refreshProfile = async () => {
    if (!isAuthenticated) return;
    try {
      const res: any = await passengerApi.me();
      setUser((prev) => {
        const fresh = mapAuthResponseToUserProfile(res, prev?.email);
        persistSession(fresh, tokenRef.current).catch(() => {});
        return fresh;
      });
    } catch {
      // Background refresh — a transient failure just leaves the screen showing what it had.
    }
  };

  // Restores a session left behind by a previous run (app relaunch after being killed by the OS
  // while backgrounded, or a web tab reloaded after being reclaimed) — simply minimizing the app
  // or switching away from it does NOT tear down this in-memory state on its own, so this only
  // matters for that harder cold-start case, not routine backgrounding.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { token: string; user: UserProfile };
        if (!saved?.token) return;

        tokenRef.current = saved.token;
        setAuthToken(saved.token);
        try {
          const res: any = await passengerApi.me();
          const freshUser = mapAuthResponseToUserProfile(res, saved.user?.email);
          setUser(freshUser);
          setIsAuthenticated(true);
          persistSession(freshUser, saved.token);
        } catch (err: any) {
          if (err?.status === 401) {
            // Token actually revoked/expired server-side — the only case where restoring a
            // session should fall back to logged-out instead of trusting the cached copy.
            tokenRef.current = null;
            setAuthToken(null);
            await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          } else {
            // Backend unreachable or a transient error — trust the cached profile rather than
            // forcing the passenger to log in again over a connectivity hiccup.
            setUser(saved.user);
            setIsAuthenticated(true);
          }
        }
      } catch {
        // Corrupt/unreadable storage — proceed logged-out, same as a first-ever launch.
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isRestoring,
        login,
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
