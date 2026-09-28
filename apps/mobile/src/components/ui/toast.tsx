import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, OctagonX } from "~/components/ui/icons";
import { Text } from "./text";
import { Perforated } from "~/components/papel/perforated";
import { makeStyles, useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

type Toast = { id: number; kind: "success" | "error"; message: string };

let nextId = 1;
let listeners: ((t: Toast) => void)[] = [];

/**
 * A slip torn from the pad: success and error notices, one line of copy each.
 * Callable from anywhere (`toast.success(msg)`), like the web's.
 */
export const toast = {
  success(message: string) {
    emit({ id: nextId++, kind: "success", message });
  },
  error(message: string) {
    emit({ id: nextId++, kind: "error", message });
  },
};

function emit(t: Toast) {
  AccessibilityInfo.announceForAccessibility(t.message);
  for (const l of listeners) l(t);
}

const DURATION = 4000;

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const onToast = (t: Toast) => setItems((prev) => [...prev.slice(-2), t]);
    listeners.push(onToast);
    return () => {
      listeners = listeners.filter((l) => l !== onToast);
    };
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]}>
      {items.map((t) => (
        <ToastSlip key={t.id} toast={t} onDone={() => dismiss(t.id)} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  outer: { marginHorizontal: 16, marginBottom: 8 },
  slip: {
    backgroundColor: c.popover,
    borderColor: c.paperLine,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sheet,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
}));

function ToastSlip({ toast: t, onDone }: { toast: Toast; onDone: () => void }) {
  const s = useStyles();
  const c = useColors();
  const y = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(onDone);
    }, DURATION);
    return () => clearTimeout(timer);
  }, [y, opacity, onDone]);

  const Icon = t.kind === "success" ? CircleCheck : OctagonX;
  const tint = t.kind === "success" ? c.teal : c.red;

  return (
    <Animated.View style={[s.outer, { transform: [{ translateY: y }], opacity }]}>
      <Pressable onPress={onDone} accessibilityRole="alert">
        <Perforated holeColor={c.background}>
          <View style={s.slip}>
            <Icon size={16} color={tint} />
            <Text size="sm" weight={500} style={{ flex: 1 }}>
              {t.message}
            </Text>
          </View>
        </Perforated>
      </Pressable>
    </Animated.View>
  );
}
