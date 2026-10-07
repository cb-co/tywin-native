import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "use-intl";
import { authedFetch } from "~/lib/api";
import { ENV } from "~/lib/env";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useReduceMotion } from "~/components/papel/guilloche";
import { face } from "~/theme/fonts";
import { makeStyles, useColors } from "~/theme/theme";
import { AskAnswer } from "./ask-answer";

/**
 * One transport for the app's life: the conversation streams from the API with
 * the session's token (refreshed once on a 401, like every other call).
 */
const ASK_TRANSPORT = new DefaultChatTransport({
  api: `${ENV.apiUrl}/v1/ask`,
  fetch: ((_url: RequestInfo | URL, init?: RequestInit) => authedFetch("/v1/ask", init)) as typeof fetch,
});

/** The narration line breathes while the model works, unless motion is reduced. */
function Pulse({ children }: { children: string }) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, opacity]);
  return (
    <Animated.Text style={{ opacity }} accessibilityLiveRegion="polite">
      <Text size="sm" tone="muted">
        {children}
      </Text>
    </Animated.Text>
  );
}

export function AskChat({ initialQuestion }: { initialQuestion: string | null }) {
  const t = useTranslations("Ask");
  const c = useColors();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  // `status` updates a render late, so two fast sends both read idle; the ref closes that window.
  const sending = useRef(false);
  const asked = useRef(false);
  const { messages, sendMessage, status, error } = useChat({ transport: ASK_TRANSPORT });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) sending.current = false;
  }, [busy]);

  // A question typed on Overview is asked on arrival, once.
  useEffect(() => {
    if (!initialQuestion || asked.current) return;
    asked.current = true;
    void sendMessage({ text: initialQuestion });
  }, [initialQuestion, sendMessage]);

  /* The narration: the purpose of the latest tool call, which the model writes
     in the person's language; a generic line until the first one arrives. */
  const narration = (() => {
    const last = messages.at(-1);
    if (!busy || last?.role !== "assistant") return busy ? t("thinking") : null;
    const calls = last.parts.filter((p) => p.type === "tool-askQuery");
    const latest = calls.at(-1) as { input?: { purpose?: string } } | undefined;
    return latest?.input?.purpose ?? t("thinking");
  })();

  function submit() {
    if (!input.trim() || busy || sending.current) return;
    sending.current = true;
    void sendMessage({ text: input });
    setInput("");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 16, gap: 16, width: "100%", maxWidth: 960, alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <Text size="sm" tone="muted">
          {t("description")}
        </Text>

        {messages.length === 0 ? (
          <View style={s.empty}>
            <Text size="base" weight={500} align="center">
              {t("emptyTitle")}
            </Text>
            <Text size="sm" tone="muted" align="center" style={{ marginTop: 4 }}>
              {t("emptyHint")}
            </Text>
          </View>
        ) : null}

        {messages.map((m) => {
          const text = m.parts.filter((p) => p.type === "text");
          const wordless = m.role === "assistant" && text.length === 0;
          // Joined, not part by part: a list split across two parts would lose its numbering.
          const body = text.map((p) => ("text" in p ? p.text : "")).join("\n\n");
          // Still querying: nothing to show yet, and the narration covers the moment.
          if (wordless && busy) return null;
          // Ended wordless: the loop ran out of steps. Say so.
          const silent = wordless && !busy;
          return m.role === "user" ? (
            <View key={m.id} style={s.question}>
              <Text legend tone="muted" style={{ fontSize: 10 }}>
                {t("you")}
              </Text>
              {/* Their own words, as typed: never markdown. */}
              <Text size="sm">{body}</Text>
            </View>
          ) : (
            <View key={m.id} style={s.answer}>
              {silent ? (
                <Text size="sm" tone="muted">
                  {t("noAnswer")}
                </Text>
              ) : (
                <AskAnswer text={body} />
              )}
            </View>
          );
        })}

        {narration ? <Pulse>{narration}</Pulse> : null}

        {error ? (
          <Text size="sm" tone="destructive" accessibilityRole="alert">
            {/* A non-2xx answer arrives as its body text: ASK_QUOTA is the plan's daily questions running out. */}
            {error.message.includes("ASK_QUOTA") ? t("quota") : error.message.includes("ASK_TIMEOUT") ? t("timeout") : t("error")}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("placeholder")}
            placeholderTextColor={c.mutedForeground}
            accessibilityLabel={t("inputLabel")}
            multiline
            maxLength={2000}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={submit}
            selectionColor={c.ring}
            style={[s.input, { fontFamily: face(400) }]}
          />
          <Button onPress={submit} disabled={busy || !input.trim()}>
            {t("send")}
          </Button>
        </View>
        <Text legend tone="muted" style={{ fontSize: 10 }}>
          {t("readOnly")}
        </Text>
        <Text size="xs" tone="muted">
          {t("disclaimer")}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  empty: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.paperLine,
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  question: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.paperLine,
    backgroundColor: c.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  answer: {
    width: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.paperLine,
    paddingVertical: 12,
  },
  composer: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 16,
    color: c.foreground,
    borderBottomWidth: 1,
    borderBottomColor: c.input,
    paddingVertical: 8,
  },
}));
