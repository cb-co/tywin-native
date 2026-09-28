import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Trash2 } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import type { QuickAddCategory } from "@cigua/core/transactions/types";
import { act, useScreen } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/field";
import { EmptyState, PageHeader, PageHeaderSkeleton, Screen, ScreenError, Skeleton, SkeletonPage, SkeletonText, useSettled } from "~/components/ui/screen";
import { Select } from "~/components/ui/select";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { Mark } from "~/components/transactions/mark";
import { makeStyles, useColors } from "~/theme/theme";

type Rule = ScreenData<"rules">["rules"][number];
type Draft = { pattern: string; categoryId: string };

export default function RulesScreen() {
  const t = useTranslations("Rules");
  const rules = useScreen("rules");
  const quickAdd = useScreen("quickAdd");
  const settled = useSettled();
  if (!rules.data || !quickAdd.data || !settled) {
    return (!rules.data && rules.isError) || (!quickAdd.data && quickAdd.isError) ? (
      <ScreenError onRetry={() => void Promise.all([rules.refetch(), quickAdd.refetch()])} />
    ) : (
      <RulesSkeleton />
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t("pageTitle") }} />
      <Screen onRefresh={rules.refetch}>
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
        <Text size="sm" tone="muted">
          {t("retroNote")}
        </Text>
        <RulesList rules={rules.data.rules} categories={quickAdd.data.categories} />
      </Screen>
    </>
  );
}

/**
 * Every merchant rule, editable in place. A merchant pattern can be shortened by
 * hand to cover every branch; an MCC pattern is a numeric code matched exactly,
 * so it stays read-only rather than invite a typo that silently stops matching.
 */
function RulesList({ rules, categories }: { rules: Rule[]; categories: QuickAddCategory[] }) {
  const t = useTranslations("Rules");
  const s = useStyles();
  const c = useColors();
  const { playSuccess, playDelete, playError } = useFeedback();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const busy = savingId !== null || deletingId !== null;
  const options = categories.map((x) => ({ value: x.id, label: `${x.emoji ? `${x.emoji} ` : ""}${x.name}` }));

  const draftFor = (rule: Rule): Draft => drafts[rule.id] ?? { pattern: rule.pattern, categoryId: rule.categoryId };
  const setDraft = (rule: Rule, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [rule.id]: { ...draftFor(rule), ...patch } }));

  async function save(rule: Rule) {
    setSavingId(rule.id);
    try {
      const result = await act("rules", "updateRule", rule.id, draftFor(rule));
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      setDrafts(({ [rule.id]: _, ...rest }) => rest);
      toast.success(t("saved"));
      playSuccess();
    } finally {
      setSavingId(null);
    }
  }

  async function remove(rule: Rule) {
    setDeletingId(rule.id);
    try {
      const result = await act("rules", "deleteRule", rule.id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("deleted"));
      playDelete();
    } finally {
      setDeletingId(null);
    }
  }

  if (rules.length === 0) return <EmptyState title={t("empty")} description={t("emptyBody")} />;

  return (
    <View style={s.list}>
      {rules.map((rule, i) => {
        const draft = draftFor(rule);
        const dirty = draft.pattern !== rule.pattern || draft.categoryId !== rule.categoryId;
        const isMcc = rule.ruleType === "mcc";
        return (
          <View key={rule.id} style={[{ paddingVertical: 16, gap: 12 }, i < rules.length - 1 ? s.rule : null]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {isMcc ? <Mark>{t("mccBadge")}</Mark> : null}
              <Input
                value={draft.pattern}
                onChangeText={(v) => setDraft(rule, { pattern: v })}
                editable={!busy && !isMcc}
                accessibilityLabel={isMcc ? t("mccPatternAria") : t("patternAria")}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ flex: 1 }}
              />
              <Button
                variant="ghost"
                size="icon"
                icon={Trash2}
                textColor={c.mutedForeground}
                disabled={busy}
                isLoading={deletingId === rule.id}
                accessibilityLabel={t("deleteAria")}
                onPress={() => void remove(rule)}
              />
            </View>
            <Select
              value={draft.categoryId}
              onValueChange={(id) => setDraft(rule, { categoryId: id })}
              disabled={busy}
              title={t("categoryAria")}
              accessibilityLabel={t("categoryAria")}
              options={options}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              {/* A rule matching 40 lines is load-bearing; one matching 0 is a typo. */}
              <Text size="xs" tone="muted">
                {t("matchCount", { count: rule.matches })}
              </Text>
              <Button size="sm" disabled={busy || !dirty} isLoading={savingId === rule.id} onPress={() => void save(rule)}>
                {t("save")}
              </Button>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** The header, the note, then the ruled list: each rule a pattern, its category, its save row. */
function RulesSkeleton() {
  const s = useStyles();
  const rows = 3;
  return (
    <SkeletonPage>
      <PageHeaderSkeleton title="45%" />
      <SkeletonText size="sm" width="85%" />
      <View style={s.list}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={[{ paddingVertical: 16, gap: 12 }, i < rows - 1 ? s.rule : null]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Skeleton height={40} />
              </View>
              <Skeleton height={40} width={40} />
            </View>
            <Skeleton height={40} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              <Skeleton height={10} width={72} />
              <Skeleton height={32} width={64} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPage>
  );
}

const useStyles = makeStyles((c) => ({
  list: { borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.rule },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
}));
