import { StyleSheet, View } from "react-native";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarClock, ChevronDown, PieChart, Receipt, Sun } from "~/components/ui/icons";
import { SWATCHES } from "@cigua/core/palette";
import { ACCOUNT_TYPE_META } from "@cigua/core/accounts/meta";
import { barPct, meterArgs } from "@cigua/core/budgets/bar";
import { formatMoney, formatPercent } from "@cigua/core/format";
import { readableForeground } from "@cigua/core/color";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { BrandGlyph } from "~/components/brand/brand-glyph";
import { CardFace } from "~/components/papel/card-face";
import { LedgerBlock, LedgerRow, SectionLegend } from "~/components/papel/ledger";
import { Note } from "~/components/papel/note";
import { Perforation } from "~/components/papel/perforation";
import { ProofMark } from "~/components/papel/proof-mark";
import { RuleMeter } from "~/components/papel/rule-meter";
import { SpecimenFrame } from "~/components/papel/specimen-frame";
import { Stamp } from "~/components/papel/stamp";
import { MoneyDisplay } from "~/components/money/money-display";
import { QuincenaEdge } from "~/components/overview/quincena-edge";
import { BudgetStatusMark } from "~/components/budgets/budget-status-mark";
import { Mark } from "~/components/transactions/mark";
import { accountTypeIcon } from "~/components/accounts/type-icon";
import { makeStyles, useColors } from "~/theme/theme";

/**
 * The guide's specimens: stills of each screen, built from the same components
 * with fixed figures, and framed as specimens so they are never read as the
 * person's own numbers. Nothing here is interactive.
 */

const SPOTIFY = { hex: "#1ED760", path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" };

function MockLabel({ children }: { children: string }) {
  return (
    <Text legend tone="muted" style={{ fontSize: 11, marginBottom: 12 }}>
      {children}
    </Text>
  );
}

function Boxed({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  return <View style={s.boxed}>{children}</View>;
}

export function OnboardingMock({ label, account, subtitle }: { label: string; account: string; subtitle: string }) {
  const s = useStyles();
  return (
    <SpecimenFrame>
      <MockLabel>{label}</MockLabel>
      <View style={s.ruledY}>
        <LedgerRow
          rule={false}
          lead={<Stamp color={ACCOUNT_TYPE_META.checking.color} icon={accountTypeIcon("checking")} size="sm" />}
          title={account}
          subtitle={subtitle}
          amount={<MoneyDisplay amount={45000} currency="DOP" size="inline" />}
        />
      </View>
    </SpecimenFrame>
  );
}

export function OverviewMock(p: {
  availableLabel: string;
  availableIfCleared: string;
  liquidLabel: string;
  committedLabel: string;
  cardsLabel: string;
  cardsNote: string;
  loansLabel: string;
  subscriptionsLabel: string;
  netWorthLabel: string;
  thisPeriodLabel: string;
  incomeLabel: string;
  spentLabel: string;
  budgetUsedLabel: string;
  upcomingItem: string;
  upcomingSubtitle: string;
}) {
  const c = useColors();
  const s = useStyles();
  const ink = c.pesoInk;
  const line = (label: string, amount: number) => (
    <View style={s.noteRow}>
      <Text size="sm" color={ink} style={{ opacity: 0.9, flexShrink: 1 }}>
        {label}
      </Text>
      <MoneyDisplay amount={amount} currency="USD" size="inline" color={ink} />
    </View>
  );
  const glyph = { size: 16, color: c.mutedForeground };
  return (
    <SpecimenFrame>
      <View style={{ gap: 16 }}>
        <View>
          <Note tone="peso" label={p.availableLabel} serial="QNA 09 B">
            <MoneyDisplay amount={1840} currency="USD" size="hero" fontSize={30} width="expanded" weight={800} color={ink} />
            <Text size="sm" color={ink} style={{ marginTop: 4, opacity: 0.9 }}>
              {p.availableIfCleared}
            </Text>
            <View style={{ marginTop: 24, gap: 6 }}>
              {line(p.liquidLabel, 3200)}
              {line(p.committedLabel, -200)}
              {line(p.cardsLabel, -350)}
              <Text size="xs" color={ink} style={{ paddingLeft: 12, opacity: 0.9 }}>
                {p.cardsNote}
              </Text>
              {line(p.loansLabel, -180)}
              {line(p.subscriptionsLabel, -46)}
            </View>
            <View style={[s.noteRow, { marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.pesoLine, paddingTop: 16 }]}>
              <Text size="sm" color={ink} style={{ opacity: 0.9 }}>
                {p.netWorthLabel}
              </Text>
              <MoneyDisplay amount={18430.12} currency="USD" size="stat" color={ink} />
            </View>
            <QuincenaEdge start="2026-09-16" end="2026-09-30" today="2026-09-23" color={ink} />
          </Note>
          <View style={{ marginHorizontal: 8, borderTopWidth: 2, borderStyle: "dashed", borderColor: c.inkSoft }} />
          <Card flush style={{ borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <Text legend tone="muted" style={{ fontSize: 11, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
              {p.thisPeriodLabel}
            </Text>
            <LedgerRow lead={<ArrowDownLeft {...glyph} />} title={p.incomeLabel} amount={<MoneyDisplay amount={3120} currency="USD" size="inline" />} />
            <LedgerRow lead={<ArrowUpRight {...glyph} />} title={p.spentLabel} amount={<MoneyDisplay amount={2040} currency="USD" size="inline" />} />
            <LedgerRow
              rule={false}
              style={{ paddingBottom: 8 }}
              lead={<PieChart {...glyph} />}
              title={p.budgetUsedLabel}
              amount={<MoneyDisplay amount={2040} currency="USD" size="inline" />}
              meta="64%"
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <RuleMeter used={64} total={100} label={p.budgetUsedLabel} />
            </View>
          </Card>
        </View>
        <Card flush>
          <LedgerRow
            rule={false}
            lead={<CalendarClock {...glyph} />}
            title={p.upcomingItem}
            meta={p.upcomingSubtitle}
            amount={<MoneyDisplay amount={15.99} currency="USD" size="inline" />}
          />
        </Card>
      </View>
    </SpecimenFrame>
  );
}

export function AccountsMock(p: {
  attentionTitle: string;
  attentionOverdue: string;
  lineCurrent: string;
  lineCurrentUtil: string;
  lineOther: string;
  lineOtherUtil: string;
  loanOutstandingLabel: string;
  loanProgress: string;
}) {
  const c = useColors();
  // An illustrative card name, never a person's.
  const cardName = "BHD Visa Platino";
  return (
    <SpecimenFrame>
      <View style={{ gap: 20 }}>
        <View>
          <MockLabel>{p.attentionTitle}</MockLabel>
          <Boxed>
            <LedgerRow rule={false} lead={<Stamp color="#1B4B8F" name={cardName} size="sm" />} title={cardName} amount={<ProofMark tone="flag">{p.attentionOverdue}</ProofMark>} />
          </Boxed>
        </View>
        <View style={{ width: "100%", maxWidth: 240, alignSelf: "center" }}>
          <CardFace name={cardName} last4="4821" network="visa" accent="#1B4B8F" />
          <View style={{ marginTop: 16, borderTopWidth: 2, borderTopColor: c.rule }}>
            <LedgerRow title={p.lineCurrent} subtitle={p.lineCurrentUtil} amount={<MoneyDisplay amount={1120.4} currency="USD" size="inline" />} />
            <LedgerRow rule={false} title={p.lineOther} subtitle={p.lineOtherUtil} amount={<MoneyDisplay amount={35800} currency="DOP" size="inline" />} />
          </View>
        </View>
        <Card style={{ padding: 12 }}>
          <MoneyDisplay amount={82500} currency="DOP" size="stat" />
          <Text size="xs" tone="muted" style={{ marginTop: 4 }}>
            {p.loanOutstandingLabel}
          </Text>
          <Perforation total={12} paid={5} label={p.loanProgress} style={{ marginTop: 12 }} />
        </Card>
      </View>
    </SpecimenFrame>
  );
}

/** "🍔 Food" into its emoji and name, the way a category label is printed. */
const splitEmoji = (label: string) => {
  const m = label.match(/^(\P{L}+?)\s+(.+)$/u);
  return m ? { emoji: m[1], name: m[2] } : { emoji: null, name: label };
};

export function TriageMock(p: {
  summary: string;
  merchantOne: string;
  merchantOneCount: string;
  merchantTwo: string;
  merchantTwoCount: string;
  categoryOne: string;
  categoryTwo: string;
  categoryThree: string;
}) {
  const c = useColors();
  const rows = [
    { name: p.merchantOne, count: p.merchantOneCount, amount: 84.5, selected: 0 },
    { name: p.merchantTwo, count: p.merchantTwoCount, amount: 32.0, selected: 1 },
  ];
  const cats = [
    { ...splitEmoji(p.categoryOne), color: SWATCHES[1] },
    { ...splitEmoji(p.categoryTwo), color: SWATCHES[4] },
    { ...splitEmoji(p.categoryThree), color: SWATCHES[7] },
  ];
  return (
    <SpecimenFrame>
      <View style={{ gap: 12 }}>
        <Text size="sm" tone="muted">
          {p.summary}
        </Text>
        <Boxed>
          {rows.map((row, i) => (
            <View key={row.name} style={i < rows.length - 1 ? { borderBottomWidth: 2, borderBottomColor: c.rule } : null}>
              <LedgerRow
                rule={false}
                style={{ paddingTop: 12 }}
                title={row.name}
                subtitle={row.count}
                amount={
                  <Text size="sm" weight={600} figure>
                    {formatMoney(row.amount, "USD")}
                  </Text>
                }
              />
              <View style={{ flexDirection: "row", gap: 2, paddingHorizontal: 16, paddingBottom: 12 }}>
                {cats.map((cat, j) => {
                  const on = j === row.selected;
                  return (
                    <View key={cat.name} style={{ width: 52, alignItems: "center", gap: 4, paddingBottom: 4, borderBottomWidth: 3, borderBottomColor: on ? c.foreground : "transparent" }}>
                      <Stamp color={cat.color} emoji={cat.emoji} name={cat.name} size="sm" inked={on} />
                      <Text size="2xs" weight={600} tone={on ? "default" : "muted"} numberOfLines={1} style={{ fontSize: 10 }}>
                        {cat.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </Boxed>
      </View>
    </SpecimenFrame>
  );
}

export function LedgerMock(p: {
  dayLabel: string;
  groceries: string;
  groceriesAccount: string;
  groceriesBadge: string;
  paycheck: string;
  paycheckAccount: string;
  payment: string;
  paymentAccounts: string;
}) {
  const c = useColors();
  const rows = [
    { title: p.groceries, badge: p.groceriesBadge, subtitle: p.groceriesAccount, color: SWATCHES[1], emoji: "🛒", icon: ArrowUpRight, amount: 3850, sign: "−", income: false },
    { title: p.paycheck, badge: null, subtitle: p.paycheckAccount, color: null, emoji: null, icon: ArrowDownLeft, amount: 48000, sign: "+", income: true },
    { title: p.payment, badge: null, subtitle: p.paymentAccounts, color: null, emoji: null, icon: ArrowLeftRight, amount: 15000, sign: "", income: false },
  ];
  return (
    <SpecimenFrame>
      <Text legend tone="muted" style={{ fontSize: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.rule }}>
        {p.dayLabel}
      </Text>
      {rows.map((row, i) => (
        <LedgerRow
          key={i}
          rule={i < rows.length - 1}
          style={{ paddingHorizontal: 0, paddingVertical: 10 }}
          lead={<Stamp color={row.color} emoji={row.emoji} name={row.title} icon={row.icon} size="sm" />}
          title={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text size="sm" weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>
                {row.title}
              </Text>
              {row.badge ? <Mark>{row.badge}</Mark> : null}
            </View>
          }
          subtitle={row.subtitle}
          amount={
            <Text size="sm" weight={600} figure tone={row.income ? "teal" : "default"}>
              {row.sign}
              {formatMoney(row.amount, "DOP")}
            </Text>
          }
        />
      ))}
    </SpecimenFrame>
  );
}

type MockBudgetRow = { name: string; emoji: string; color: string; used: number; budget: number; status: "within" | "approaching" | "over" };

const plainName = (label: string) => splitEmoji(label).name;

function MockBudgetBlock({ row, nearLabel, overLabel, usedOf, rule }: { row: MockBudgetRow; nearLabel: string; overLabel: string; usedOf: (u: string, b: string) => string; rule: boolean }) {
  const { used, total } = meterArgs(row.used, row.budget);
  return (
    <LedgerBlock
      rule={rule}
      head={
        <LedgerRow
          rule={false}
          lead={<Stamp color={row.color} emoji={row.emoji} name={row.name} size="md" />}
          title={row.name}
          subtitle={usedOf(formatMoney(row.used, "DOP"), formatMoney(row.budget, "DOP"))}
          amount={<MoneyDisplay amount={row.used} currency="DOP" size="inline" />}
          meta={formatPercent(barPct(row.used, row.budget))}
        />
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <RuleMeter style={{ flex: 1 }} used={used} total={total} near={row.status === "approaching"} label={plainName(row.name)} overLabel={overLabel} />
        <BudgetStatusMark status={row.status} overLabel={overLabel} nearLabel={nearLabel} />
      </View>
    </LedgerBlock>
  );
}

export function BudgetsMock(p: {
  month: string;
  food: string;
  transport: string;
  entertainment: string;
  nearLabel: string;
  overLabel: string;
  usedOf: (used: string, budget: string) => string;
  usedLabel: string;
  remainingLabel: string;
}) {
  const c = useColors();
  const s = useStyles();
  const ink = c.pesoInk;
  const rows: MockBudgetRow[] = [
    { name: p.food, emoji: "🍽️", color: SWATCHES[1], used: 340, budget: 500, status: "within" },
    { name: p.transport, emoji: "🚗", color: SWATCHES[6], used: 210, budget: 250, status: "approaching" },
    { name: p.entertainment, emoji: "🎬", color: SWATCHES[4], used: 196, budget: 140, status: "over" },
  ];
  return (
    <SpecimenFrame>
      <View style={{ gap: 12 }}>
        <Note tone="peso" ornament={false} label={p.month} style={{ padding: 16 }}>
          <MoneyDisplay amount={890} currency="DOP" size="stat" color={ink} />
          <View style={{ marginTop: 12, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.pesoLine, paddingTop: 12 }}>
            <View style={s.noteRow}>
              <Text size="sm" color={ink} style={{ opacity: 0.9 }}>
                {p.usedLabel}
              </Text>
              <MoneyDisplay amount={746} currency="DOP" size="inline" color={ink} />
            </View>
            <View style={s.noteRow}>
              <Text size="sm" weight={600} color={ink}>
                {p.remainingLabel}
              </Text>
              <MoneyDisplay amount={144} currency="DOP" size="inline" color={ink} />
            </View>
          </View>
        </Note>
        <Boxed>
          {rows.map((row, i) => (
            <MockBudgetBlock key={row.name} row={row} rule={i < rows.length - 1} nearLabel={p.nearLabel} overLabel={p.overLabel} usedOf={p.usedOf} />
          ))}
        </Boxed>
      </View>
    </SpecimenFrame>
  );
}

export function BudgetGroupsMock(p: {
  heading: string;
  essentials: string;
  lifestyle: string;
  future: string;
  nearLabel: string;
  overLabel: string;
  usedOf: (used: string, budget: string) => string;
}) {
  const rows: MockBudgetRow[] = [
    { name: p.essentials, emoji: "🏠", color: SWATCHES[2], used: 1180, budget: 1400, status: "approaching" },
    { name: p.lifestyle, emoji: "🎈", color: SWATCHES[4], used: 520, budget: 600, status: "approaching" },
    { name: p.future, emoji: "🌱", color: SWATCHES[7], used: 300, budget: 500, status: "within" },
  ];
  return (
    <SpecimenFrame>
      <View style={{ gap: 8 }}>
        <SectionLegend>{p.heading}</SectionLegend>
        <Boxed>
          {rows.map((row, i) => (
            <MockBudgetBlock key={row.name} row={row} rule={i < rows.length - 1} nearLabel={p.nearLabel} overLabel={p.overLabel} usedOf={p.usedOf} />
          ))}
        </Boxed>
      </View>
    </SpecimenFrame>
  );
}

export function SubscriptionsMock(p: {
  heading: string;
  streaming: string;
  streamingCycle: string;
  streamingNext: string;
  transfer: string;
  transferCycle: string;
  transferNext: string;
  addCharge: string;
}) {
  const c = useColors();
  const splitNext = (x: string) => {
    const i = x.indexOf(" · ");
    return i < 0 ? { next: x, account: null } : { next: x.slice(0, i), account: x.slice(i + 3) };
  };
  const spotifyInk = readableForeground(SPOTIFY.hex);
  const rows = [
    { name: p.streaming, cycle: p.streamingCycle, ...splitNext(p.streamingNext), amt: 15.99, active: true, bg: SPOTIFY.hex, fg: spotifyInk, logo: true },
    { name: p.transfer, cycle: p.transferCycle, ...splitNext(p.transferNext), amt: 250, active: false, bg: c.accent, fg: c.accentForeground, logo: false },
  ];
  return (
    <SpecimenFrame>
      <View style={{ gap: 8 }}>
        <SectionLegend>{p.heading}</SectionLegend>
        <Boxed>
          {rows.map((row, i) => (
            <View key={row.name} style={row.active ? null : { opacity: 0.6 }}>
              <LedgerBlock
                rule={i < rows.length - 1}
                head={
                  <LedgerRow
                    rule={false}
                    lead={
                      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: row.bg }}>
                        {row.logo ? (
                          <BrandGlyph path={SPOTIFY.path} size={22} color={row.fg} />
                        ) : (
                          <Text size="sm" weight={600} color={row.fg}>
                            {row.name[0]?.toUpperCase()}
                          </Text>
                        )}
                      </View>
                    }
                    title={row.name}
                    subtitle={row.cycle}
                    amount={<MoneyDisplay amount={row.amt} currency="USD" size="inline" />}
                    meta={row.next}
                  />
                }
              >
                {row.account ? (
                  <Text size="xs" tone="muted" numberOfLines={1}>
                    {row.account}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }} pointerEvents="none">
                  <Switch checked={row.active} onCheckedChange={() => {}} />
                  <Button size="sm" variant="secondary" icon={Receipt}>
                    {p.addCharge}
                  </Button>
                </View>
              </LedgerBlock>
            </View>
          ))}
        </Boxed>
      </View>
    </SpecimenFrame>
  );
}

export function InsightsMock(p: { label: string; thisMonth: string; essentials: string; discretionary: string; subscriptions: string; other: string }) {
  const c = useColors();
  const legend = [
    { name: p.essentials, color: c.chart[0], pct: 38 },
    { name: p.discretionary, color: c.chart[1], pct: 23 },
    { name: p.subscriptions, color: c.chart[5], pct: 15 },
    { name: p.other, color: c.mutedForeground, pct: 24 },
  ];
  return (
    <SpecimenFrame>
      <MockLabel>{p.label}</MockLabel>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <Text legend tone="muted" style={{ fontSize: 10 }}>
          {p.thisMonth}
        </Text>
        <MoneyDisplay amount={2050} currency="USD" size="stat" fontSize={16} />
      </View>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.paperLine }}>
        {legend.map(({ name, color, pct }, i) => (
          <View key={name} style={[{ paddingVertical: 6 }, i < legend.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine } : null]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                <Stamp color={color} name={name} size="sm" style={{ transform: [{ scale: 0.7 }], margin: -5 }} />
                <Text size="xs" numberOfLines={1}>
                  {name}
                </Text>
              </View>
              <Text size="xs" tone="muted" figure>
                {pct}%
              </Text>
            </View>
            <RuleMeter style={{ marginTop: 6 }} used={pct} total={38} label={`${name} ${pct}%`} />
          </View>
        ))}
      </View>
    </SpecimenFrame>
  );
}

export function AskMock(p: { you: string; question: string; narration: string; answer: string }) {
  const c = useColors();
  return (
    <SpecimenFrame>
      <View style={{ gap: 12 }}>
        <View style={{ alignSelf: "flex-end", maxWidth: 320, borderWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine, backgroundColor: c.muted, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text legend tone="muted" style={{ fontSize: 10 }}>
            {p.you}
          </Text>
          <Text size="sm">{p.question}</Text>
        </View>
        <Text size="xs" tone="muted">
          {p.narration}
        </Text>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine, paddingVertical: 12 }}>
          <Text size="sm">{p.answer}</Text>
        </View>
      </View>
    </SpecimenFrame>
  );
}

export function SettingsMock(p: { currencyLabel: string; currencyValue: string; themeLabel: string; soundLabel: string }) {
  const c = useColors();
  const s = useStyles();
  return (
    <SpecimenFrame>
      <View style={{ borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.rule }} pointerEvents="none">
        <View style={[s.settingsRow, s.settingsRule]}>
          <Text size="sm" weight={500}>
            {p.currencyLabel}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.input, borderRadius: 4, paddingLeft: 10, paddingRight: 8, height: 32 }}>
            <Text size="sm">{p.currencyValue}</Text>
            <ChevronDown size={16} color={c.mutedForeground} />
          </View>
        </View>
        <View style={[s.settingsRow, s.settingsRule]}>
          <Text size="sm" weight={500}>
            {p.themeLabel}
          </Text>
          <Sun size={20} color={c.foreground} />
        </View>
        <View style={s.settingsRow}>
          <Text size="sm" weight={500}>
            {p.soundLabel}
          </Text>
          <Switch checked onCheckedChange={() => {}} />
        </View>
      </View>
    </SpecimenFrame>
  );
}

const useStyles = makeStyles((c) => ({
  boxed: { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine },
  ruledY: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine },
  noteRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  settingsRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
}));
