import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { AuthClient, processLock } from "@supabase/auth-js";
import { ENV } from "./env";

/**
 * The session, in the device keychain.
 *
 * A Supabase session (tokens plus the user record) can run past the size some
 * keychains accept for one item, so it is split into chunks under numbered keys
 * and reassembled on read. Only this app can read it, and it never leaves the
 * device except as the bearer token on API calls.
 */
const CHUNK = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function safeKey(key: string): string {
  // SecureStore keys allow [A-Za-z0-9._-]; Supabase's key contains other characters.
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${k}.n`, OPTIONS));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, OPTIONS);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    const previous = Number(await SecureStore.getItemAsync(`${k}.n`, OPTIONS)) || 0;
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), OPTIONS);
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count), OPTIONS);
    for (let i = count; i < previous; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, OPTIONS);
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${k}.n`, OPTIONS)) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, OPTIONS);
    await SecureStore.deleteItemAsync(`${k}.n`, OPTIONS);
  },
};

/**
 * Supabase Auth, and only Auth: sign-in, token refresh, sign-out. Every read and
 * write goes through the API, which runs as this session under row-level
 * security, so the database, storage and realtime clients are never shipped.
 */
export const auth = new AuthClient({
  url: `${ENV.supabaseUrl}/auth/v1`,
  headers: { Authorization: `Bearer ${ENV.supabaseKey}`, apikey: ENV.supabaseKey },
  // The key supabase-js would use, so a session is found wherever it was saved.
  storageKey: `sb-${hostPrefix(ENV.supabaseUrl)}-auth-token`,
  storage: chunkedSecureStore,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
  flowType: "pkce",
  lock: processLock,
});

function hostPrefix(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "local";
  }
}

/** Refresh tokens only while the app is in the foreground, as the platform expects. */
AppState.addEventListener("change", (state) => {
  if (state === "active") void auth.startAutoRefresh();
  else void auth.stopAutoRefresh();
});
