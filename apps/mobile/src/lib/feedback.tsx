import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { prefs, PREF } from "./storage";

type FeedbackValue = {
  playSuccess: () => void;
  playDelete: () => void;
  playError: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

const Ctx = createContext<FeedbackValue | null>(null);

const SOURCES = {
  success: { asset: require("../../assets/sounds/stamp.wav"), volume: 0.6 },
  delete: { asset: require("../../assets/sounds/delete.wav"), volume: 0.5 },
  error: { asset: require("../../assets/sounds/error.wav"), volume: 0.5 },
} as const;

type Cue = keyof typeof SOURCES;

/**
 * The cues for moments the person caused: a paper stamp when something is saved,
 * a tear when it is deleted, a thud on an error. Sound follows the Settings switch
 * (on by default) and never interrupts other audio; the matching haptic always plays.
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(() => prefs.getBoolean(PREF.soundEnabled, true));
  const players = useRef<Partial<Record<Cue, AudioPlayer>>>({});

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
    const created = players.current;
    for (const [cue, { asset, volume }] of Object.entries(SOURCES) as [Cue, (typeof SOURCES)[Cue]][]) {
      const p = createAudioPlayer(asset);
      p.volume = volume;
      created[cue] = p;
    }
    return () => {
      for (const p of Object.values(created)) p?.remove();
    };
  }, []);

  const play = useCallback(
    (cue: Cue) => {
      if (cue === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else if (cue === "error") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (!enabled) return;
      const p = players.current[cue];
      if (!p) return;
      p.seekTo(0);
      p.play();
    },
    [enabled],
  );

  const setEnabled = useCallback((v: boolean) => {
    prefs.setBoolean(PREF.soundEnabled, v);
    setEnabledState(v);
  }, []);

  const value = useMemo<FeedbackValue>(
    () => ({
      playSuccess: () => play("success"),
      playDelete: () => play("delete"),
      playError: () => play("error"),
      enabled,
      setEnabled,
    }),
    [play, enabled, setEnabled],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
