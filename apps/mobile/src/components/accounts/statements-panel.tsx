import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ChevronDown, ChevronRight, Trash2, Upload } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import type { CardStatementRow } from "@cigua/worker/api";
import { formatDate, formatMoney } from "@cigua/core/format";
import { callAction, type ActionResult } from "~/lib/api";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Dialog } from "~/components/ui/overlay";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { LedgerRow } from "~/components/papel/ledger";
import { ProofMark } from "~/components/papel/proof-mark";
import { StatementImportSheet } from "~/components/statements/statement-import-sheet";
import { makeStyles, useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

type LineDetail = ActionResult<"statements", "getStatementLineDetail">[number];

/** This card's statements, newest first: triage state, due date and minimum, and every line on demand. */
export function StatementsPanel({
  accountId,
  currency,
  statements,
  triageCounts,
}: {
  accountId: string;
  currency: string;
  statements: CardStatementRow[];
  triageCounts: Record<string, { importId: string; count: number }>;
}) {
  const t = useTranslations("Statements");
  const tc = useTranslations("Common");
  const tTxn = useTranslations("Transactions");
  const locale = useLocale();
  const s = useStyles();
  const c = useColors();
  const { playSuccess, playError } = useFeedback();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, LineDetail[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onToggleLines(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (lines[id]) return;
    setBusyId(id);
    try {
      const detail = await callAction("statements", "getStatementLineDetail", id);
      setLines((prev) => ({ ...prev, [id]: detail }));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      const result = await act("statements", "deleteCardStatement", id, accountId);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("statementDeleted"));
      playSuccess();
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  const latest = statements[0];

  return (
    <Card style={{ padding: 24 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text size="lg" weight={500} accessibilityRole="header">
            {t("title")}
          </Text>
          <Text size="sm" tone="muted">
            {t("description")}
          </Text>
        </View>
        <Button variant="outline" icon={Upload} onPress={() => setImportOpen(true)}>
          {t("importButton")}
        </Button>
      </View>

      <View style={s.separator} />

      {latest?.cost_of_carry != null && latest.interest_rate_annual != null ? (
        <Text size="sm" tone="muted" style={{ marginBottom: 16 }}>
          {t("costOfCarryStat", { amount: formatMoney(Number(latest.cost_of_carry), currency), rate: Number(latest.interest_rate_annual) })}
        </Text>
      ) : null}

      {statements.length === 0 ? (
        <Text size="sm" tone="muted">
          {t("historyEmpty")}
        </Text>
      ) : (
        <View style={s.list}>
          {statements.map((st, i) => {
            const triage = triageCounts[st.id];
            const last = i === statements.length - 1;
            return (
              <View key={st.id} style={last ? null : s.rule}>
                {/* Title and figure share a line, the due date and minimum share theirs with
                    the actions, and the triage link gets its own: side by side they overran
                    each other on a phone. */}
                <LedgerRow
                  rule={false}
                  lead={
                    <View accessibilityLabel={triage ? undefined : tc("done")}>
                      <ProofMark tone={triage ? "flag" : "ok"}>{""}</ProofMark>
                    </View>
                  }
                  title={
                    <View style={{ gap: 2 }}>
                      <View style={s.line}>
                        <View style={[s.line, s.grow, { gap: 8 }]}>
                          <Text size="sm" weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>
                            {formatDate(st.period_end, locale)}
                          </Text>
                          <View style={s.badge}>
                            <Text size="2xs" tone="muted" tracking={0.05} numberOfLines={1} style={{ fontSize: 10, textTransform: "uppercase" }}>
                              {st.source === "import" ? t("sourceImport") : t("sourceManual")}
                            </Text>
                          </View>
                        </View>
                        <Text size="sm" figure numberOfLines={1} style={{ flexShrink: 0 }}>
                          {formatMoney(Number(st.total_balance), currency)}
                        </Text>
                      </View>
                      <View style={s.line}>
                        <Text size="xs" tone="muted" style={s.grow}>
                          {[
                            st.due_date ? t("dueLabel", { date: formatDate(st.due_date, locale) }) : null,
                            st.minimum_payment != null ? t("minimumLabel", { amount: formatMoney(Number(st.minimum_payment), currency) }) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                        <View style={s.actions}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            icon={expanded === st.id ? ChevronDown : ChevronRight}
                            isLoading={busyId === st.id}
                            hitSlop={HIT}
                            accessibilityLabel={expanded === st.id ? t("hideLinesAria") : t("viewLinesAria")}
                            onPress={() => void onToggleLines(st.id)}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            icon={Trash2}
                            disabled={busyId !== null}
                            hitSlop={HIT}
                            onPress={() => setDeleteTarget(st.id)}
                            accessibilityLabel={tc("delete")}
                          />
                        </View>
                      </View>
                      {triage ? (
                        <Pressable
                          accessibilityRole="link"
                          hitSlop={8}
                          onPress={() => router.push({ pathname: "/imports/[id]", params: { id: triage.importId } })}
                          style={{ alignSelf: "flex-start", paddingTop: 4 }}
                        >
                          <Text size="xs" weight={600} tone="red" style={{ textDecorationLine: "underline" }}>
                            {t("categorizeCount", { count: triage.count })}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  }
                />
                {expanded === st.id ? (
                  <View style={s.lines}>
                    {lines[st.id] === undefined ? (
                      <Text size="xs" tone="muted">
                        {t("linesLoading")}
                      </Text>
                    ) : lines[st.id].length === 0 ? (
                      <Text size="xs" tone="muted">
                        {t("linesEmpty")}
                      </Text>
                    ) : (
                      lines[st.id].map((l) => (
                        <View key={l.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <Text size="xs" numberOfLines={1} style={{ flex: 1 }}>
                            <Text size="xs" tone="muted">
                              {formatDate(l.madeOn, locale)}{" "}
                            </Text>
                            {l.description}
                            {l.kind === "payment"
                              ? `  ${t("linePaymentBadge").toUpperCase()}`
                              : l.kind === "adjustment"
                                ? `  ${t("lineAdjustmentBadge").toUpperCase()}`
                                : l.amount < 0
                                  ? `  ${(l.creditKind === "cashback" ? tTxn("cashbackBadge") : tTxn("refundBadge")).toUpperCase()}`
                                  : ""}
                          </Text>
                          <Text size="xs" figure color={l.amount < 0 ? c.success : c.foreground}>
                            {formatMoney(l.amount, currency, { signed: true })}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <StatementImportSheet open={importOpen} onClose={() => setImportOpen(false)} accountId={accountId} />
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirm")}
        footer={
          <>
            <Button variant="outline" onPress={() => setDeleteTarget(null)} disabled={busyId !== null}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onPress={() => deleteTarget && void onDelete(deleteTarget)} disabled={busyId !== null} isLoading={busyId !== null}>
              {tc("delete")}
            </Button>
          </>
        }
      />
    </Card>
  );
}

/** 32dp buttons reach 48dp tall and meet in the 8dp between them. */
const HIT = { top: 8, bottom: 8, left: 4, right: 4 };

const useStyles = makeStyles((c) => ({
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 24 },
  list: { borderRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  line: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  // The buttons overhang the text line and their icons' right edge meets the figure's.
  actions: { flexDirection: "row", gap: 8, flexShrink: 0, marginVertical: -6, marginRight: -8 },
  badge: { flexShrink: 0, borderRadius: 3, backgroundColor: c.muted, paddingHorizontal: 6, paddingVertical: 2 },
  lines: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.paperLine },
}));
