import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { keepPreviousData, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { ArrowLeftRight, Search } from "~/components/ui/icons";
import { useFormatter, useTranslations } from "use-intl";
import type { TransactionPage, TransactionWithRefs, TxnCursor, TxnFilters } from "@cigua/worker/api";
import { TRANSACTION_TYPES } from "@cigua/core/transactions/schema";
import { groupLedger } from "@cigua/core/transactions/display";
import { callAction } from "~/lib/api";
import { act, keys, queryClient, useScreen } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import {
  PageHeader,
  PageHeaderSkeleton,
  EmptyState,
  RowsSkeleton,
  Skeleton,
  SkeletonPage,
  TAB_CLEARANCE,
  useSettled,
} from "~/components/ui/screen";
import { Select } from "~/components/ui/select";
import { DateField } from "~/components/ui/date-field";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { TransactionRow } from "~/components/transactions/transaction-row";
import { TransactionSheet } from "~/components/transactions/transaction-sheet";
import { DateRule, MonthLegend } from "~/components/transactions/date-rule";
import { useAccountOptions } from "~/components/transactions/account-options";
import { face } from "~/theme/fonts";
import { useColors } from "~/theme/theme";

/** Long enough that typing a merchant name is one query, not eight. */
const SEARCH_DEBOUNCE_MS = 300;

type Item =
  | { kind: "month"; key: string; label: string }
  | { kind: "day"; key: string; label: string }
  | { kind: "row"; key: string; txn: TransactionWithRefs; last: boolean };

export default function TransactionsScreen() {
  const t = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const f = useFormatter();
  const c = useColors();
  const { playDelete, playError } = useFeedback();
  const { data: quickAdd } = useScreen("quickAdd");
  const accountOptions = useAccountOptions();
  const settled = useSettled();

  const [type, setType] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<TransactionWithRefs | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo<TxnFilters>(
    () => ({
      type: type === "all" ? undefined : type,
      accountId: accountId === "all" ? undefined : accountId,
      categoryId: categoryId === "all" ? undefined : categoryId,
      search: debouncedSearch || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [type, accountId, categoryId, debouncedSearch, fromDate, toDate],
  );
  const hasFilters = Object.values(filters).some(Boolean);

  // Filtering happens in Postgres, page by page (keyset), so the ledger is never
  // limited to whatever the first page held. The previous result stays on screen,
  // dimmed, while a new filter loads.
  const query = useInfiniteQuery({
    queryKey: keys.transactions(filters),
    queryFn: ({ pageParam }) => callAction("transactions", "loadTransactions", filters, pageParam),
    initialPageParam: null as TxnCursor | null,
    getNextPageParam: (last: TransactionPage) => last.nextCursor,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);

  /* occurred_at is a calendar date stored as UTC midnight: format it in UTC so the day never drifts. */
  const items = useMemo<Item[]>(() => {
    const grouped = groupLedger(rows, (y, m) => f.dateTime(new Date(y, m - 1, 1), { month: "long", year: "numeric" }));
    const out: Item[] = [];
    for (const month of grouped) {
      out.push({ kind: "month", key: `m-${month.monthKey}`, label: month.label });
      for (const day of month.days) {
        out.push({
          kind: "day",
          key: `d-${day.day}`,
          label: f.dateTime(new Date(day.day), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
        });
        day.rows.forEach((txn, i) => out.push({ kind: "row", key: txn.id, txn, last: i === day.rows.length - 1 }));
      }
    }
    return out;
  }, [rows, f]);
  const sticky = useMemo(() => items.flatMap((it, i) => (it.kind === "day" ? [i] : [])), [items]);

  const onDelete = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        const result = await act("transactions", "deleteTransaction", id);
        if (result.error) {
          toast.error(result.error);
          playError();
          return;
        }
        toast.success(t("transactionDeleted"));
        playDelete();
        // Drop it from the pages already on screen too.
        queryClient.setQueryData<InfiniteData<TransactionPage>>(keys.transactions(filters), (data) =>
          data ? { ...data, pages: data.pages.map((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== id) })) } : data,
        );
      } finally {
        setDeleting(null);
      }
    },
    [filters, t, playDelete, playError],
  );

  const accounts = quickAdd?.accounts ?? [];
  const categories = quickAdd?.categories ?? [];

  const header = (
    <View style={{ gap: 24, paddingBottom: 16 }}>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 1, borderBottomColor: c.input }}>
            <Search size={16} color={c.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={c.mutedForeground}
              returnKeyType="search"
              autoCorrect={false}
              selectionColor={c.ring}
              style={{ flex: 1, minHeight: 36, fontFamily: face(400), fontSize: 16, color: c.foreground }}
            />
          </View>
          <Select
            value={type}
            onValueChange={setType}
            style={{ flex: 1 }}
            options={[{ value: "all", label: t("allTypes") }, ...TRANSACTION_TYPES.map((tt) => ({ value: tt, label: tType(tt) }))]}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Select
            value={accountId}
            onValueChange={setAccountId}
            style={{ flex: 1 }}
            options={[{ value: "all", label: t("allAccounts") }, ...accountOptions(accounts)]}
          />
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            style={{ flex: 1 }}
            options={[{ value: "all", label: t("allCategories") }, ...categories.map((cat) => ({ value: cat.id, label: cat.name }))]}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ flex: 1 }}>
            <DateField value={fromDate} onChange={setFromDate} clearable accessibilityLabel={t("dateFromAria")} placeholder={t("dateFromAria")} />
          </View>
          <Text size="sm" tone="muted">
            –
          </Text>
          <View style={{ flex: 1 }}>
            <DateField value={toDate} onChange={setToDate} clearable accessibilityLabel={t("dateToAria")} placeholder={t("dateToAria")} />
          </View>
        </View>
      </View>
    </View>
  );

  const footer =
    rows.length > 0 ? (
      <View style={{ paddingTop: 16, alignItems: "center" }}>
        {query.hasNextPage ? (
          <Button variant="ghost" onPress={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} isLoading={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? t("loadingMore") : t("loadMore")}
          </Button>
        ) : (
          <Text size="xs" tone="muted">
            {t("endOfLedger", { count: rows.length })}
          </Text>
        )}
      </View>
    ) : null;

  const empty = query.isPending ? (
    <LedgerSkeleton />
  ) : (
    <EmptyState
      icon={<ArrowLeftRight size={24} color={c.accentForeground} />}
      title={hasFilters ? t("emptyTitleFiltered") : t("emptyTitleNone")}
      description={hasFilters ? t("emptyDescriptionFiltered") : t("emptyDescriptionNone")}
    />
  );

  if (!settled) return <TransactionsSkeleton />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlashList
        data={items}
        keyExtractor={(it) => it.key}
        getItemType={(it) => it.kind}
        stickyHeaderIndices={sticky}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={{ padding: 16, paddingBottom: TAB_CLEARANCE }}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={1.5}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={c.mutedForeground} />}
        style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}
        renderItem={({ item }) =>
          item.kind === "month" ? (
            <View style={{ paddingTop: 20, paddingBottom: 12 }}>
              <MonthLegend label={item.label} />
            </View>
          ) : item.kind === "day" ? (
            <DateRule label={item.label} />
          ) : (
            <TransactionRow txn={item.txn} rule={!item.last} onEdit={setEditing} onDelete={onDelete} pending={deleting === item.txn.id} />
          )
        }
      />
      <TransactionSheet open={!!editing} onClose={() => setEditing(null)} mode="edit" transaction={editing ?? undefined} />
    </View>
  );
}

/** Two months of ledger, unprinted: each month's legend over its rule, a day, its rows. */
function LedgerSkeleton() {
  const c = useColors();
  return (
    <View>
      {[0, 1].map((month) => (
        <View key={month}>
          <View style={{ paddingTop: 20, paddingBottom: 12 }}>
            <View style={{ borderBottomWidth: 2, borderBottomColor: c.paperLine, paddingBottom: 6 }}>
              <Skeleton height={10} width={112} />
            </View>
          </View>
          <View style={{ borderBottomWidth: 1, borderBottomColor: c.paperLine, paddingVertical: 8 }}>
            <Skeleton height={8} width={72} />
          </View>
          <RowsSkeleton rows={4} card={false} />
        </View>
      ))}
    </View>
  );
}

/** The page above, unprinted: the header, the three rows of filters, the ledger. */
function TransactionsSkeleton() {
  const field = (flex: number, height = 40) => (
    <View style={{ flex }}>
      <Skeleton height={height} />
    </View>
  );
  return (
    <SkeletonPage tab gap={0}>
      <View style={{ gap: 24, paddingBottom: 16 }}>
        <PageHeaderSkeleton title="45%" />
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {field(2)}
            {field(1)}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {field(1)}
            {field(1)}
          </View>
          <View style={{ flexDirection: "row", gap: 20 }}>
            {field(1, 36)}
            {field(1, 36)}
          </View>
        </View>
      </View>
      <LedgerSkeleton />
    </SkeletonPage>
  );
}
