import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowRight } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { MAX_INITIAL_QUESTION } from "@cigua/core/ask/initial-question";
import { face } from "~/theme/fonts";
import { useColors } from "~/theme/theme";

/**
 * The way onto Ask from the screen someone is already looking at. Typing the
 * question here and having it answered there is one gesture.
 */
export function AskEntry() {
  const t = useTranslations("Overview");
  const c = useColors();
  const [question, setQuestion] = useState("");
  const submit = () => {
    const q = question.trim();
    // Empty is not a failure: it means they want the page, not an answer to nothing.
    router.push(q ? { pathname: "/ask", params: { q } } : "/ask");
    setQuestion("");
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 2, borderBottomColor: c.rule, paddingBottom: 8 }}>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder={t("askPlaceholder")}
        placeholderTextColor={c.mutedForeground}
        accessibilityLabel={t("askLabel")}
        maxLength={MAX_INITIAL_QUESTION}
        autoCorrect
        returnKeyType="send"
        onSubmitEditing={submit}
        selectionColor={c.ring}
        style={{ flex: 1, minWidth: 0, fontFamily: face(400), fontSize: 16, color: c.foreground, paddingVertical: 6 }}
      />
      <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel={t("askSubmit")} hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
        <ArrowRight size={20} color={c.foreground} />
      </Pressable>
    </View>
  );
}
