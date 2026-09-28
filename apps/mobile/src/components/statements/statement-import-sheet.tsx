import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Upload } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import type { StatementPreviewResult } from "@cigua/worker/api";
import type { ImportTarget } from "@cigua/core/statements/import-targets";
import { collapseImportTargets } from "@cigua/core/statements/import-targets";
import { sheetRows } from "@cigua/core/statements/sheet-rows";
import { isInstallmentSection, suggestLineName } from "@cigua/core/statements/line-name";
import { NAME_MAX_LENGTH } from "@cigua/core/accounts/schema";
import { MAX_STATEMENT_BYTES } from "@cigua/core/statements/limits";
import { formatDate, formatMoney } from "@cigua/core/format";
import { callAction, confirmStatement, parseStatement, type PickedFile } from "~/lib/api";
import { act, invalidateAfterImport } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input, Label } from "~/components/ui/field";
import { Sheet } from "~/components/ui/overlay";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { ImportCardStubStep } from "./import-card-stub-step";
import { ReadingSheet, StatementSheet } from "./statement-sheet";
import { makeStyles } from "~/theme/theme";

type Preview = NonNullable<StatementPreviewResult["preview"]>;

/**
 * Statement import: which card, then the PDF, then a preview of every section as
 * the bank printed it, each mapped to one of the card's lines. The one place the
 * app's numbers come from, so it is reachable from Overview, Accounts, a card and
 * onboarding alike.
 */
export function StatementImportSheet({
  open,
  onClose,
  accountId,
  forceStub,
  onImported,
  openTriage = true,
}: {
  open: boolean;
  onClose: () => void;
  /** Pins the target card. Omitted, the sheet resolves one: the only card, a choice of several, or a new one. */
  accountId?: string;
  /** Always starts on creating a new card; the target list is never fetched. */
  forceStub?: boolean;
  onImported?: () => void;
  /** Goes on to triage when lines are left uncategorised. Off during onboarding, where the app is not open yet. */
  openTriage?: boolean;
}) {
  const t = useTranslations("Statements");
  const locale = useLocale();
  const s = useStyles();
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordIncorrect, setPasswordIncorrect] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [excludeFromBudget, setExcludeFromBudget] = useState(true);
  const [parsedStatement, setParsedStatement] = useState<string | null>(null);

  const [pickedId, setPickedId] = useState<string | null>(null);
  const targetId = accountId ?? pickedId;
  const [targets, setTargets] = useState<ImportTarget[] | null>(null);
  const [targetsFailed, setTargetsFailed] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || accountId || forceStub || targets !== null || targetsFailed) return;
    let cancelled = false;
    void callAction("statements", "listImportTargets")
      .then((list) => {
        if (cancelled) return;
        setTargets(list);
        // One physical card is not a choice worth asking about.
        const rows = collapseImportTargets(list);
        if (rows.length === 1) setPickedId(rows[0].accountId);
      })
      .catch(() => !cancelled && setTargetsFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, accountId, forceStub, targets, targetsFailed]);

  function resetForm() {
    setPreview(null);
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setPasswordIncorrect(false);
    setParsedStatement(null);
    setMappings({});
    setExcludeFromBudget(true);
    setPickedId(null);
    setTargets(null);
    setTargetsFailed(false);
    setAddingKey(null);
  }

  const onParse = useCallback(
    async (f: PickedFile, pw: string) => {
      if (!targetId) return;
      setParsedStatement(null);
      setPending(true);
      try {
        const result = await parseStatement({ file: f, accountId: targetId, password: pw || undefined });
        if (result.needsPassword) {
          setNeedsPassword(true);
          setPasswordIncorrect(!!result.passwordIncorrect);
          if (result.passwordIncorrect) setPassword("");
          return;
        }
        if (result.error || !result.preview) {
          toast.error(result.error ?? t("parseFailed"));
          playError();
          return;
        }
        setNeedsPassword(false);
        setPasswordIncorrect(false);
        setPreview(result.preview);
        setParsedStatement(result.parsedStatement ?? null);
        setMappings(
          Object.fromEntries(
            result.preview.sections
              .map((sec) => [sec.sectionKey, sec.mappedAccountId ?? sec.suggestedAccountId ?? ""])
              .filter(([, v]) => v),
          ),
        );
      } catch {
        toast.error(t("parseFailed"));
        playError();
      } finally {
        setPending(false);
      }
    },
    [targetId, t, playError],
  );

  const pickFile = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.size && asset.size > MAX_STATEMENT_BYTES) {
      toast.error(t("fileTooLarge", { limit: MAX_STATEMENT_BYTES / (1024 * 1024) }));
      playError();
      return;
    }
    const picked = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType };
    setFile(picked);
    setPassword("");
    setNeedsPassword(false);
    setPasswordIncorrect(false);
    setPreview(null);
    setParsedStatement(null);
    void onParse(picked, "");
  }, [onParse, t, playError]);

  // The sheet is only useful with a file in hand, so it reaches for the picker as
  // soon as it knows the card — once per opening, and never under `forceStub`,
  // whose promise is a fast card, not a mandatory upload.
  const pickerOpened = useRef(false);
  useEffect(() => {
    if (!open) {
      pickerOpened.current = false;
      return;
    }
    if (!targetId || forceStub || pickerOpened.current || file || preview) return;
    pickerOpened.current = true;
    // After the sheet has finished presenting, or iOS refuses to stack the picker on it.
    const timer = setTimeout(() => void pickFile(), 450);
    return () => clearTimeout(timer);
  }, [open, file, preview, targetId, forceStub, pickFile]);

  async function onConfirm() {
    if (!preview || !parsedStatement) return;
    setPending(true);
    try {
      const fields: Record<string, string> = {
        file_name: preview.fileName,
        parsed_statement: parsedStatement,
        mappings: JSON.stringify(mappings),
        exclude_from_budget: String(excludeFromBudget),
      };
      if (targetId) fields.account_id = targetId;
      const result = await confirmStatement(fields);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("imported"));
      playSuccess();
      resetForm();
      void invalidateAfterImport();
      onImported?.();
      onClose();
      // Only land on triage when there is something to triage.
      if (openTriage && result.importId && (result.uncategorized ?? 0) > 0) {
        router.push({ pathname: "/imports/[id]", params: { id: result.importId, fresh: "1" } });
      }
    } catch {
      toast.error(t("parseFailed"));
      playError();
    } finally {
      setPending(false);
    }
  }

  const allMapped = preview?.sections.every((sec) => mappings[sec.sectionKey]) ?? false;

  /** Same currency, and not already claimed by a different section. Both the select and "stuck" read this. */
  function availableOptions(sectionKey: string, currency: string) {
    return (preview?.accountOptions ?? []).filter(
      (a) =>
        a.currency === currency &&
        (mappings[sectionKey] === a.id || !Object.entries(mappings).some(([key, v]) => key !== sectionKey && v === a.id)),
    );
  }

  const target = targets?.find((c) => c.id === targetId);
  const cardName = (target?.groupName ?? target?.name ?? preview?.accountOptions[0]?.name ?? "").replace(/\s·\s[A-Z]{3}$/, "");

  function suggestedLineName(sectionKey: string, currency: string) {
    return suggestLineName({
      cardName,
      currency,
      sectionKey,
      takenNames: (preview?.accountOptions ?? []).map((a) => a.name),
      maxLength: NAME_MAX_LENGTH,
      format: (form, card, cur) =>
        form === "plain"
          ? t("lineNameSuggestion", { card, currency: cur })
          : form === "installments"
            ? t("lineNameInstallments", { card })
            : t("lineNameInstallmentsCurrency", { card, currency: cur }),
    });
  }

  /** The way out of a section no line of this card can take: add one, locally, without re-parsing. */
  async function onAddLine(sectionKey: string, currency: string) {
    if (!targetId) return;
    const lineName = suggestedLineName(sectionKey, currency);
    setAddingKey(sectionKey);
    try {
      const result = await act("accounts", "addCardLine", targetId, { name: lineName, currency });
      const newId = result.id;
      if (!newId) {
        if (result.error) toast.error(result.error);
        playError();
        return;
      }
      setPreview((p) => (p ? { ...p, accountOptions: [...p.accountOptions, { id: newId, name: lineName, currency }] } : p));
      setMappings((m) => ({ ...m, [sectionKey]: newId }));
      toast.success(t("lineAdded"));
      playSuccess();
    } finally {
      setAddingKey(null);
    }
  }

  function close() {
    resetForm();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        <Text legend size="sm" accessibilityRole="header">
          {t("title")}
        </Text>
      }
      description={t("description")}
      footer={
        preview ? (
          <>
            <Button variant="ghost" disabled={pending} onPress={close}>
              {t("cancelButton")}
            </Button>
            <Button disabled={pending || addingKey !== null || !allMapped} isLoading={pending} onPress={onConfirm}>
              {t("confirmButton")}
            </Button>
          </>
        ) : undefined
      }
    >
      {!targetId && forceStub ? (
        <ImportCardStubStep onCreated={setPickedId} submitLabel={t("stubSubmit")} defaultCurrency="" />
      ) : null}

      {!targetId && !forceStub && targetsFailed ? (
        <View style={{ gap: 8 }}>
          <Text size="sm" tone="destructive">
            {t("targetsFailed")}
          </Text>
          <Button variant="outline" onPress={() => setTargetsFailed(false)}>
            {t("retryLoadButton")}
          </Button>
        </View>
      ) : null}

      {!targetId && !forceStub && !targetsFailed && targets === null ? (
        <View style={{ gap: 12 }} accessibilityLabel={t("pickCardLoading")}>
          <View style={{ gap: 4 }}>
            <Text size="sm" weight={500}>
              {t("pickCardHeading")}
            </Text>
            <Text size="xs" tone="muted">
              {t("pickCardHint")}
            </Text>
          </View>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={48} />
          ))}
        </View>
      ) : null}

      {!targetId && !forceStub && !targetsFailed && targets !== null ? (
        targets.length === 0 ? (
          <ImportCardStubStep onCreated={setPickedId} submitLabel={t("stubSubmit")} defaultCurrency="" />
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text size="sm" weight={500}>
                {t("pickCardHeading")}
              </Text>
              <Text size="xs" tone="muted">
                {t("pickCardHint")}
              </Text>
            </View>
            {/* One row per physical card: a grouped card's lines are one card. */}
            {collapseImportTargets(targets).map((row) => (
              <Pressable
                key={row.accountId}
                accessibilityRole="button"
                onPress={() => setPickedId(row.accountId)}
                style={({ pressed }) => [s.cardRow, pressed ? s.pressed : null]}
              >
                <Text size="sm" weight={500} numberOfLines={1} style={{ flex: 1 }}>
                  {row.label}
                </Text>
                <Text size="xs" tone="muted">
                  {row.last4 ? `•••• ${row.last4}` : ""}
                  {row.last4 && row.currency ? " · " : ""}
                  {row.currency}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {targetId && forceStub && !preview && !needsPassword ? (
        <Text size="sm" tone="muted">
          {t("stubCreatedHint")}
        </Text>
      ) : null}
      {targetId && !preview && !needsPassword ? (
        <Button variant="outline" icon={Upload} disabled={pending} isLoading={pending} onPress={pickFile}>
          {t("importButton")}
        </Button>
      ) : null}

      {pending && file && !preview && !needsPassword ? <ReadingSheet fileName={file.name} /> : null}

      {needsPassword && file ? (
        <View style={{ gap: 8 }}>
          <Label>{t("passwordLabel")}</Label>
          <Text size="xs" tone={passwordIncorrect ? "destructive" : "muted"}>
            {passwordIncorrect ? t("passwordIncorrect") : t("passwordHint")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <Input
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => password && void onParse(file, password)}
              style={{ flex: 1 }}
            />
            <Button variant="outline" disabled={pending || !password} isLoading={pending} onPress={() => void onParse(file, password)}>
              {t("retryButton")}
            </Button>
          </View>
        </View>
      ) : null}

      {preview ? (
        <View style={{ gap: 16 }}>
          {preview.sections.map((sec) => {
            const available = availableOptions(sec.sectionKey, sec.currency);
            const unmatched = available.length === 0;
            return (
              <View key={sec.sectionKey} style={s.section}>
                <View style={s.sectionHead}>
                  <View style={{ flexShrink: 1 }}>
                    <Text legend style={{ fontSize: 11 }}>
                      {sec.sectionKey} · {sec.currency}
                    </Text>
                    <Text size="xs" tone="muted">
                      {formatDate(sec.periodStart, locale)} → {formatDate(sec.periodEnd, locale)}
                    </Text>
                  </View>
                  <Text size="sm" figure>
                    {formatMoney(Number(sec.closingBalance), sec.currency)}
                  </Text>
                </View>
                <StatementSheet {...sheetRows(parsedStatement, sec.sectionKey, 8)} currency={sec.currency} />
                <Text size="xs" tone="muted">
                  {t("sectionSummary", { lines: sec.lineCount, skipped: sec.skippedCount })}
                </Text>
                <Field label={t("mapSectionLabel", { section: sec.sectionKey })}>
                  <Select
                    value={mappings[sec.sectionKey] || "none"}
                    title={t("mapSectionLabel", { section: sec.sectionKey })}
                    onValueChange={(v) => setMappings((m) => ({ ...m, [sec.sectionKey]: v === "none" ? "" : v }))}
                    options={[
                      // Clearing frees this section's claim so lines can be swapped without a deadlock.
                      { value: "none", label: t("mapSectionNone") },
                      ...available.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` })),
                    ]}
                  />
                </Field>
                {unmatched ? (
                  <View style={{ gap: 8 }}>
                    <Text size="xs" tone="muted">
                      {isInstallmentSection(sec.sectionKey)
                        ? t("unmatchedInstallments")
                        : t("unmatchedSection", { currency: sec.currency })}
                    </Text>
                    <Button
                      variant="outline"
                      disabled={pending || addingKey !== null}
                      isLoading={addingKey === sec.sectionKey}
                      onPress={() => void onAddLine(sec.sectionKey, sec.currency)}
                    >
                      {isInstallmentSection(sec.sectionKey)
                        ? t("addLineInstallmentsButton")
                        : t("addLineButton", { currency: sec.currency })}
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={s.exclude}>
            <View style={{ flex: 1 }}>
              <Text size="sm" tone="muted">
                {t("excludeFromBudgetLabel")}
              </Text>
              <Text size="xs" tone="muted">
                {t("excludeFromBudgetHint")}
              </Text>
            </View>
            <Switch checked={excludeFromBudget} onCheckedChange={setExcludeFromBudget} accessibilityLabel={t("excludeFromBudgetLabel")} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.paperLine,
    paddingHorizontal: 4,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: c.muted },
  section: { gap: 8, borderTopWidth: 2, borderTopColor: c.rule, paddingTop: 12 },
  sectionHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  exclude: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.paperLine,
    paddingVertical: 12,
  },
}));
