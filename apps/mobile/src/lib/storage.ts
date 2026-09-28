import Storage from "expo-sqlite/kv-store";

/**
 * Small, synchronous, on-device preferences (theme, language, figure mask, sound)
 * and the saved screen cache. Synchronous so a preference is known on the first
 * render and the app never flashes the wrong theme or language.
 *
 * Nothing secret goes here: the session lives in the keychain (lib/supabase.ts).
 */
export const prefs = {
  get(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      Storage.setItemSync(key, value);
    } catch {
      // A preference that fails to save is re-asked next launch; never worth a crash.
    }
  },
  remove(key: string): void {
    try {
      Storage.removeItemSync(key);
    } catch {}
  },
  getBoolean(key: string, fallback: boolean): boolean {
    const v = prefs.get(key);
    return v === null ? fallback : v === "1";
  },
  setBoolean(key: string, value: boolean): void {
    prefs.set(key, value ? "1" : "0");
  },
};

export const PREF = {
  theme: "cigua:theme",
  locale: "cigua:locale",
  figuresMasked: "cigua:figures-masked",
  soundEnabled: "cigua:sound-enabled",
} as const;
