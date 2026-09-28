import { useLocalSearchParams } from "expo-router";
import { initialQuestion } from "@cigua/core/ask/initial-question";
import { AskChat } from "~/components/ask/ask-chat";

/** `q` arrives from the Overview entry, bounded here before it goes anywhere near a model. */
export default function AskScreen() {
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  return <AskChat initialQuestion={initialQuestion(Array.isArray(q) ? null : q)} />;
}
