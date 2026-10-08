import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_KINDS, MAX_SCHEDULED, planReminders, REMINDER_KINDS, type ReminderData, type ReminderKind } from "./plan";

const empty: ReminderData = {
  today: "2026-10-07",
  cards: [],
  loans: [],
  recurring: [],
  statements: [],
  bonuses: [],
  payCycle: { cycle: "monthly", anchorDay: null },
};

const allOn = Object.fromEntries(REMINDER_KINDS.map((k) => [k, true])) as Record<ReminderKind, boolean>;
const opts = { kinds: { ...allOn, payday: false }, hour: 9, today: "2026-10-07", hourNow: 8 };
const withPayday = { ...opts, kinds: allOn };

const card = (over: Partial<ReminderData["cards"][number]> = {}) => ({
  accountId: "dop",
  groupId: "bhd",
  name: "BHD Visa",
  currency: "DOP",
  dueDate: "2026-10-15",
  minimumLeft: 2350,
  statementLeft: 45000,
  ...over,
});

describe("planReminders · cards", () => {
  it("reminds three days before, on the day, and the day after", () => {
    const plan = planReminders({ ...empty, cards: [card()] }, opts);
    expect(plan.map((r) => [r.kind, r.date])).toEqual([
      ["card-due", "2026-10-12"],
      ["card-due", "2026-10-15"],
      ["card-missed", "2026-10-16"],
    ]);
  });

  it("leads with the minimum and carries the cutoff balance", () => {
    const [first] = planReminders({ ...empty, cards: [card()] }, opts);
    expect(first).toMatchObject({
      toPay: [{ currency: "DOP", amount: 2350 }],
      statement: [{ currency: "DOP", amount: 45000 }],
      hasMinimum: true,
    });
  });

  it("folds a card's currency lines into one reminder, summing lines in the same currency", () => {
    const plan = planReminders(
      {
        ...empty,
        cards: [
          card(),
          card({ accountId: "usd", currency: "USD", minimumLeft: 40, statementLeft: 300 }),
          card({ accountId: "cuotas", minimumLeft: 1000, statementLeft: 1000 }),
        ],
      },
      opts,
    );
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({
      toPay: [
        { currency: "DOP", amount: 3350 },
        { currency: "USD", amount: 40 },
      ],
    });
  });

  it("asks for the cutoff balance when the bank printed no minimum", () => {
    const [first] = planReminders({ ...empty, cards: [card({ minimumLeft: null })] }, opts);
    expect(first).toMatchObject({ toPay: [{ currency: "DOP", amount: 45000 }], hasMinimum: false });
  });

  it("keeps only the missed-payment note for a due date already gone", () => {
    const plan = planReminders({ ...empty, cards: [card({ dueDate: "2026-10-07" })] }, { ...opts, hourNow: 10 });
    expect(plan.map((r) => [r.kind, r.date])).toEqual([["card-missed", "2026-10-08"]]);
  });
});

describe("planReminders · the rest", () => {
  it("reminds about a loan two days before each installment", () => {
    const plan = planReminders(
      {
        ...empty,
        loans: [
          {
            accountId: "car",
            name: "Car loan",
            currency: "DOP",
            due: [
              { date: "2026-11-05", amount: 18500 },
              { date: "2026-12-05", amount: 18500 },
            ],
          },
        ],
      },
      opts,
    );
    expect(plan.map((r) => r.date)).toEqual(["2026-11-03", "2026-12-03"]);
  });

  it("reminds about a recurring charge on its day, carrying whether one tap can record it", () => {
    const [r] = planReminders(
      {
        ...empty,
        recurring: [{ id: "nf", name: "Netflix", currency: "USD", cycle: "monthly", lastRecorded: null, recordable: false, due: [{ date: "2026-10-10", amount: 15.99 }] }],
      },
      opts,
    );
    expect(r).toMatchObject({ kind: "recurring", date: "2026-10-10", subscriptionId: "nf", recordable: false });
  });

  it("asks for a statement three days after the cutoff", () => {
    const [r] = planReminders({ ...empty, statements: [{ accountId: "dop", name: "BHD Visa", closings: ["2026-10-20"] }] }, opts);
    expect(r).toMatchObject({ kind: "statement", date: "2026-10-23" });
  });

  it("warns about a welcome bonus two weeks and three days out", () => {
    const plan = planReminders(
      { ...empty, bonuses: [{ accountId: "dop", name: "BHD Visa", currency: "DOP", dueDate: "2026-11-30", left: 20000 }] },
      opts,
    );
    expect(plan.map((r) => r.date)).toEqual(["2026-11-16", "2026-11-27"]);
  });

  it("marks the next two paydays with the end of the period they open", () => {
    const plan = planReminders({ ...empty, payCycle: { cycle: "semimonthly", anchorDay: null } }, withPayday);
    expect(plan.map((r) => [r.date, r.kind === "payday" && r.periodEnd])).toEqual([
      ["2026-10-16", "2026-10-31"],
      ["2026-11-01", "2026-11-15"],
    ]);
  });

  it("counts today as a payday when the period starts today and the hour is still ahead", () => {
    const plan = planReminders({ ...empty, payCycle: { cycle: "monthly", anchorDay: null } }, { ...withPayday, today: "2026-10-01" });
    expect(plan[0]).toMatchObject({ kind: "payday", date: "2026-10-01" });
  });
});

describe("planReminders · settings", () => {
  it("skips the kinds switched off, and leaves payday off by default", () => {
    const data: ReminderData = {
      ...empty,
      cards: [card()],
      loans: [{ accountId: "car", name: "Car", currency: "DOP", due: [{ date: "2026-11-05", amount: 1 }] }],
    };
    expect(planReminders(data, { ...opts, kinds: { ...opts.kinds, cards: false } }).map((r) => r.kind)).toEqual(["loan"]);
    expect(planReminders(empty, { ...opts, kinds: DEFAULT_REMINDER_KINDS })).toEqual([]);
  });

  it("drops a reminder due today once the hour has passed", () => {
    const data: ReminderData = {
      ...empty,
      recurring: [{ id: "nf", name: "Netflix", currency: "DOP", cycle: "monthly", lastRecorded: null, recordable: true, due: [{ date: "2026-10-07", amount: 1 }] }],
    };
    expect(planReminders(data, { ...opts, hourNow: 8 })).toHaveLength(1);
    expect(planReminders(data, { ...opts, hourNow: 9 })).toHaveLength(0);
  });

  it("keeps the soonest under the phone's limit", () => {
    const recurring = Array.from({ length: 80 }, (_, i) => ({
      id: `s${String(i).padStart(2, "0")}`,
      name: "x",
      currency: "DOP",
      cycle: "monthly" as const,
      lastRecorded: null,
      recordable: true,
      due: [{ date: "2026-10-10", amount: 1 }],
    }));
    const plan = planReminders({ ...empty, recurring, cards: [card({ dueDate: "2026-10-09" })] }, opts);
    expect(plan).toHaveLength(MAX_SCHEDULED);
    expect(plan[0]).toMatchObject({ kind: "card-due", date: "2026-10-09" });
  });
});
