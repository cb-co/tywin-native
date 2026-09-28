import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import type { QuickAddCategory } from "@cigua/core/transactions/types";
import { orderCategories } from "@cigua/core/transactions/defaults";
import { formatDate, formatMoney } from "@cigua/core/format";
import { act, keys, queryClient } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { OptionSheet } from "~/components/ui/select";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { LedgerRow } from "~/components/papel/ledger";
import { CategoryRail } from "~/components/transactions/category-rail";
import { makeStyles } from "~/theme/theme";
import { DoneStamp } from "./done-stamp";

type Triage = NonNullable<ScreenData<"importTriage">>;
type Group = Triage["groups"][number];

/**
 * The merchant groups still waiting for a category, each with the rail of
 * most-used categories and the full list one tap away. A tap files every line in
 * the group and teaches the rule; the group leaves the list at once.
 */
export function TriageList({
  triage,
  categories,
  categoryOrder,
  fresh,
}: {
  triage: Triage;
  categories: QuickAddCategory[];
  categoryOrder: string[];
  /** True only straight out of an import: see `frozen`. */
  fresh: boolean;
}) {
  const t = useTranslations("Imports");
  const tCategory = useTranslations("TransactionForm");
  const locale = useLocale();
  const s = useStyles();
  const { playSuccess, playError } = useFeedback();
  const { importId, groups, accountId } = triage;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [moreFor, setMoreFor] = useState<Group | null>(null);

  const railCategories = orderCategories(categories, categoryOrder);
  const options = categories.map((c) => ({ value: c.id, label: `${c.emoji ? `${c.emoji} ` : ""}${c.name}` }));

  /* "Automatically" is only true on arrival from the import: nothing records
     whether a category came from a rule or a person, so the two numbers are
     frozen at mount and the sentence never credits the rules with a tap. */
  const [frozen] = useState({ done: triage.categorizedLines, total: triage.totalLines });
  const remaining = triage.totalLines - triage.categorizedLines;
  const summary = fresh ? t("autoSummary", frozen) : t("remaining", { count: remaining });

  // Finishing is detected in render, on the transition to zero, so arriving at a
  // finished triage shows the mark still.
  const [prevCount, setPrevCount] = useState(groups.length);
  const [justFinished, setJustFinished] = useState(false);
  if (groups.length !== prevCount) {
    setPrevCount(groups.length);
    if (prevCount > 0 && groups.length === 0) setJustFinished(true);
  }

  async function assign(group: Group, categoryId: string) {
    if (busyKey) return;
    setBusyKey(group.key);
    try {
      const result = await act("imports", "categorizeTriageGroup", importId, group.key, categoryId);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      // Off the list now; the refetch the action triggers confirms it.
      queryClient.setQueryData<Triage>(keys.screen("importTriage", { id: importId }), (prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.filter((g) => g.key !== group.key),
              categorizedLines: prev.categorizedLines + group.count,
            }
          : prev,
      );
      const category = categories.find((c) => c.id === categoryId);
      toast.success(t("assigned", { merchant: group.description, category: category?.name ?? "" }));
      playSuccess();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <Text size="sm" tone="muted">
        {summary}
      </Text>

      {groups.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 16, padding: 32 }}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <DoneStamp label={t("allDone")} animate={justFinished} />
          </View>
          <Text size="sm" tone="muted" align="center" accessibilityLabel={`${t("allDone")}. ${t("allDoneBody")}`}>
            {t("allDoneBody")}
          </Text>
          {accountId ? (
            <Button variant="outline" size="sm" onPress={() => router.dismissTo({ pathname: "/accounts/[id]", params: { id: accountId } })}>
              {t("backToAccount")}
            </Button>
          ) : null}
        </Card>
      ) : (
        <Card flush>
          {groups.map((group, i) => (
            <View key={group.key} style={[i < groups.length - 1 ? s.rule : null, busyKey === group.key ? { opacity: 0.6 } : null]}>
              <LedgerRow
                rule={false}
                style={{ paddingHorizontal: 16, paddingTop: 12 }}
                title={group.description}
                subtitle={`${t("groupLines", { count: group.count })} · ${t("groupDates", {
                  from: formatDate(group.firstDate, locale),
                  to: formatDate(group.lastDate, locale),
                })}`}
                amount={
                  <Text size="sm" weight={600} figure>
                    {formatMoney(group.total, group.currency)}
                  </Text>
                }
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <CategoryRail categories={railCategories} value="" onChange={(id) => void assign(group, id)} onMore={() => setMoreFor(group)} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <OptionSheet
        open={moreFor !== null}
        onClose={() => setMoreFor(null)}
        title={tCategory("categoryLabel")}
        options={options}
        onChoose={(id) => {
          const group = moreFor;
          if (group) void assign(group, id);
        }}
      />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  rule: { borderBottomWidth: 2, borderBottomColor: c.rule },
}));
