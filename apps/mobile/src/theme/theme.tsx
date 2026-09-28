import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";
import { dark, light, type Palette } from "./tokens";
import { prefs, PREF } from "~/lib/storage";

export type Scheme = "light" | "dark";
export type ThemePreference = "system" | Scheme;

type ThemeValue = {
  colors: Palette;
  scheme: Scheme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Light/dark on one tap: the header toggle. Leaves "system" for good once used. */
  toggle: () => void;
};

const Ctx = createContext<ThemeValue | null>(null);

function readPreference(): ThemePreference {
  const v = prefs.get(PREF.theme);
  return v === "light" || v === "dark" ? v : "system";
}

/**
 * Light is the default (paper by day) and dark is first-class. A first launch
 * follows the OS; the header toggle and Settings pin one. The choice is applied
 * to the native appearance too, so alerts, keyboards and pickers match.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const scheme: Scheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  useEffect(() => {
    Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    prefs.set(PREF.theme, p);
    setPreferenceState(p);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      colors: scheme === "dark" ? dark : light,
      scheme,
      preference,
      setPreference,
      toggle: () => setPreference(scheme === "dark" ? "light" : "dark"),
    }),
    [scheme, preference, setPreference],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function useColors(): Palette {
  return useTheme().colors;
}

/**
 * Themed StyleSheets, built once per palette and reused by every instance.
 *
 *   const useStyles = makeStyles((c) => ({ row: { borderColor: c.paperLine } }));
 *   const s = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const colors = useColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}
