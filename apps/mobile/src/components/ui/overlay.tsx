import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { Button } from "./button";
import { Text } from "./text";
import { Perforated } from "~/components/papel/perforated";
import { makeStyles, useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/**
 * A form, as a native page sheet: swipe down (iOS) or Back (Android) to close.
 * The body scrolls and keeps clear of the keyboard; `footer` stays pinned.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  scroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Common");
  const ios = Platform.OS === "ios";
  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle={ios ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={ios ? "padding" : undefined}
        style={[s.page, { paddingTop: ios ? 0 : insets.top }]}
      >
        <View style={s.header}>
          <View style={{ flex: 1, gap: 4 }}>
            {typeof title === "string" ? (
              <Text size="base" weight={500} accessibilityRole="header">
                {title}
              </Text>
            ) : (
              title
            )}
            {description ? (
              typeof description === "string" ? (
                <Text size="sm" tone="muted">
                  {description}
                </Text>
              ) : (
                description
              )
            ) : null}
          </View>
          <Button variant="ghost" size="icon-sm" icon={X} onPress={onClose} accessibilityLabel={t("close")} />
        </View>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.body, { paddingBottom: footer ? 16 : insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
        {footer ? <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Animates a scrim in and a slip up from the bottom edge (or centre). */
function useEntrance(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [open, mounted, progress]);
  return { mounted, progress };
}

/** A short chooser anchored to the bottom edge: a paper slip with a perforated top. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  style,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const s = useStyles();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mounted, progress } = useEntrance(open);
  if (!mounted) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.4, 0] });
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[s.bottomWrap, { transform: [{ translateY }] }]} pointerEvents="box-none">
        <Perforated holeColor="transparent">
          <View
            style={[
              s.bottom,
              { maxHeight: height * 0.85, paddingBottom: insets.bottom + 16 },
              style,
            ]}
          >
            {title ? (
              <Text size="base" weight={500} style={{ paddingHorizontal: 4, paddingBottom: 8 }} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </Perforated>
      </Animated.View>
    </Modal>
  );
}

/** A small centred slip for a confirmation or a single short input. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const s = useStyles();
  const c = useColors();
  const t = useTranslations("Common");
  const { mounted, progress } = useEntrance(open);
  if (!mounted) return null;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.center}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
        </Animated.View>
        <Animated.View style={[s.dialogWrap, { opacity: progress, transform: [{ scale }] }]}>
          <Perforated holeColor={c.scrim}>
            <View style={s.dialog} accessibilityViewIsModal>
              <View style={{ gap: 8, paddingRight: 32 }}>
                <Text size="base" weight={500} accessibilityRole="header">
                  {title}
                </Text>
                {description ? (
                  typeof description === "string" ? (
                    <Text size="sm" tone="muted">
                      {description}
                    </Text>
                  ) : (
                    description
                  )
                ) : null}
              </View>
              {children}
              {footer ? <View style={s.dialogFooter}>{footer}</View> : null}
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                onPress={onClose}
                accessibilityLabel={t("close")}
                style={{ position: "absolute", top: 8, right: 8 }}
              />
            </View>
          </Perforated>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  page: { flex: 1, backgroundColor: c.popover },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.paperLine,
  },
  body: { padding: 16, gap: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.paperLine,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  bottomWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bottom: {
    backgroundColor: c.popover,
    borderTopWidth: 1,
    borderTopColor: c.rule,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  dialogWrap: { width: "100%", maxWidth: 384 },
  dialog: {
    backgroundColor: c.popover,
    borderColor: c.paperLine,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sheet,
    padding: 16,
    paddingTop: 24,
    gap: 16,
  },
  dialogFooter: {
    marginHorizontal: -16,
    marginBottom: -16,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.paperLine,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
}));
