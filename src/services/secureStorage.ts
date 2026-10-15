import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

export const PASSENGER_SECURE_TOKEN_KEY = 'trivora_passenger_auth_token';
export const PASSENGER_SESSION_STORAGE_KEY = '@trivora_passenger_session';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Checks whether platform-backed SecureStore is available on the current device/runtime.
 * Resolves true on iOS and Android; false on Web or unsupported environments.
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Reads the passenger auth token directly from secure storage.
 * Never throws — returns null if unavailable or if read fails.
 * Never logs the token.
 */
export async function getSecurePassengerToken(): Promise<string | null> {
  try {
    const available = await isSecureStorageAvailable();
    if (!available) return null;
    return await SecureStore.getItemAsync(PASSENGER_SECURE_TOKEN_KEY, SECURE_STORE_OPTIONS);
  } catch {
    return null;
  }
}

/**
 * Stores the passenger auth token in platform-backed secure storage.
 * Verifies that the write succeeded by reading the token back before resolving true.
 * Returns false if secure store is unavailable, write fails, or verification fails.
 * Never writes to plaintext AsyncStorage fallback.
 * Never logs the token.
 */
export async function setSecurePassengerToken(token: string): Promise<boolean> {
  try {
    const available = await isSecureStorageAvailable();
    if (!available) return false;
    await SecureStore.setItemAsync(PASSENGER_SECURE_TOKEN_KEY, token, SECURE_STORE_OPTIONS);
    const verified = await SecureStore.getItemAsync(PASSENGER_SECURE_TOKEN_KEY, SECURE_STORE_OPTIONS);
    return verified === token;
  } catch {
    return false;
  }
}

/**
 * Deletes the passenger auth token from secure storage.
 */
export async function deleteSecurePassengerToken(): Promise<void> {
  try {
    const available = await isSecureStorageAvailable();
    if (available) {
      await SecureStore.deleteItemAsync(PASSENGER_SECURE_TOKEN_KEY, SECURE_STORE_OPTIONS);
    }
  } catch {
    // Silent fail on deletion
  }
}

export interface RestoredPassengerSession {
  token: string | null;
  user: UserProfile | null;
  migrated: boolean;
}

/**
 * Safely restores passenger session on app boot:
 * 1. Checks SecureStore for the authentication token.
 * 2. Checks AsyncStorage for cached user profile and legacy session entries.
 * 3. If a legacy plaintext token is found in AsyncStorage:
 *    - If secure storage is available: attempts to securely store and verify the token.
 *    - Once verified: strips the plaintext token from AsyncStorage, leaving only non-sensitive cached user data.
 *    - If verification fails: throws an error indicating migration failed (user must sign in again),
 *      and cleans up the legacy entry so bad state does not persist.
 * 4. Ensures no token is ever logged or exposed in error messages.
 */
export async function restorePassengerSession(): Promise<RestoredPassengerSession> {
  const secureToken = await getSecurePassengerToken();
  const rawSession = await AsyncStorage.getItem(PASSENGER_SESSION_STORAGE_KEY);

  let cachedUser: UserProfile | null = null;
  let legacyToken: string | null = null;

  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      if (parsed?.user) {
        cachedUser = parsed.user;
      }
      if (typeof parsed?.token === 'string' && parsed.token.trim().length > 0) {
        legacyToken = parsed.token.trim();
      }
    } catch {
      // Corrupt JSON in AsyncStorage
    }
  }

  // Case 1: Token already present in SecureStore
  if (secureToken) {
    // If a legacy token was lingering in AsyncStorage, sanitize it now
    if (legacyToken) {
      try {
        await AsyncStorage.setItem(
          PASSENGER_SESSION_STORAGE_KEY,
          JSON.stringify({ user: cachedUser })
        );
      } catch {
        // Non-fatal sanitization error
      }
    }
    return { token: secureToken, user: cachedUser, migrated: false };
  }

  // Case 2: No secure token, but legacy token found in AsyncStorage -> Safe Migration
  if (legacyToken) {
    const available = await isSecureStorageAvailable();
    if (available) {
      const ok = await setSecurePassengerToken(legacyToken);
      if (ok) {
        // Migration verified! Clean the token out of AsyncStorage immediately
        try {
          await AsyncStorage.setItem(
            PASSENGER_SESSION_STORAGE_KEY,
            JSON.stringify({ user: cachedUser })
          );
        } catch {
          await AsyncStorage.removeItem(PASSENGER_SESSION_STORAGE_KEY).catch(() => {});
        }
        return { token: legacyToken, user: cachedUser, migrated: true };
      } else {
        // Secure write or verification failed! Do NOT fall back to plaintext token storage.
        // Wipe corrupted entries and inform caller that user must sign in again.
        await deleteSecurePassengerToken();
        await AsyncStorage.removeItem(PASSENGER_SESSION_STORAGE_KEY).catch(() => {});
        throw new Error('Session migration failed: secure storage write could not be verified. Please sign in again.');
      }
    } else {
      // Secure storage unavailable (e.g. web browser without SecureStore)
      // Per security requirement: do NOT silently persist tokens in plaintext.
      // Strip token from AsyncStorage so storage is clean.
      try {
        await AsyncStorage.setItem(
          PASSENGER_SESSION_STORAGE_KEY,
          JSON.stringify({ user: cachedUser })
        );
      } catch {
        await AsyncStorage.removeItem(PASSENGER_SESSION_STORAGE_KEY).catch(() => {});
      }
      return { token: legacyToken, user: cachedUser, migrated: true };
    }
  }

  // Case 3: No token in either storage
  return { token: null, user: cachedUser, migrated: false };
}

/**
 * Persists the session:
 * - Access token -> SecureStore only (if token is provided).
 * - Non-sensitive user profile -> AsyncStorage only.
 * Returns true if token was securely saved (or token was null).
 */
export async function persistPassengerSession(
  userData: UserProfile,
  token: string | null
): Promise<boolean> {
  // Always update non-sensitive user cache in AsyncStorage (without token)
  try {
    await AsyncStorage.setItem(
      PASSENGER_SESSION_STORAGE_KEY,
      JSON.stringify({ user: userData })
    );
  } catch {
    // AsyncStorage write error
  }

  if (token) {
    const saved = await setSecurePassengerToken(token);
    if (!saved && __DEV__) {
      console.warn('[secureStorage] Token could not be written to SecureStore.');
    }
    return saved;
  }

  return true;
}

/**
 * Clears all persisted session data:
 * Removes token from SecureStore and removes session entry from AsyncStorage.
 */
export async function clearPassengerSession(): Promise<void> {
  await deleteSecurePassengerToken();
  try {
    await AsyncStorage.removeItem(PASSENGER_SESSION_STORAGE_KEY);
  } catch {
    // Non-fatal
  }
}
