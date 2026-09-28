# The data you can query

You may query these five views and nothing else. They are already scoped to one
person — never filter by `user_id`, and never mention it.

## Two different questions: what it WAS, and what it was FOR

Spending is described along two dimensions, and confusing them is the single
easiest way to give a wrong answer here.

`category` is the **qualifier** — what a transaction actually was. Groceries,
Utilities, Dining. There are many of them and they are specific.

`budget_group` is the **plan** — the handful of buckets the person budgets
against. Essentials, Lifestyle, Future. There are few of them and they are
coarse.

They are not two names for the same thing and they do not line up one-to-one. A
category rolls up to at most one group, and a single transaction may override
that: a taxi is `category = Transport` but may be `budget_group = Lifestyle`
because it was a night out. Both are true of the same row at the same time.

So:

- "What did I spend on **groceries**?" is a `category` question — q_transactions.
- "How am I doing on **Essentials**?" is a `budget_group` question —
  q_budget_groups.
- Never answer one with the other, and never sum categories to reach a group
  total. Read `budget_group` off the row instead; the rollup and the overrides
  are already applied there.

A row may have a `category` and no `budget_group`, or the reverse. Neither is an
error — it means that part has not been set up.

## Dates and types

Money columns are `numeric`. Ids are `uuid`. Everything else is `text` unless
said otherwise below.

Only one date column is a timestamp: `occurred_at` on q_transactions. Compare it
half-open, never with BETWEEN:

    occurred_at >= date '2026-07-01' and occurred_at < date '2026-08-01'

`between '2026-07-01' and '2026-07-31'` reads the second bound as midnight and
silently drops everything that happened during the last day — a wrong total that
looks right. Bucketing by month is `date_trunc('month', occurred_at)::date`,
which buckets in UTC.

Every other date column is a plain `date`, so `=` works on it: `month` on
q_budgets (always the first of the month), `period_start`, `period_end` and
`due_date` on q_card_statements, and `start_date` on q_accounts.

## q_transactions

One row per transaction.

| column | meaning |
| --- | --- |
| `id`, `occurred_at`, `type` | `type` is `expense`, `income`, or `payment`. |
| `description`, `notes` | Free text. Merchant names live in `description`. |
| `account_id`, `account`, `account_type`, `account_brand`, `account_last4`, `bank` | The account the money moved from. `account_type` is `checking`, `savings`, `cash`, `investment`, `asset`, `credit_card`, or `loan`. |
| `to_account_id`, `to_account`, `to_account_type` | Set when this moved money to another of their own accounts. |
| `category_id`, `category`, `subscription_id`, `subscription` | `category` is null when the transaction has not been categorised yet. |
| `currency`, `amount`, `total_amount` | As charged. `total_amount` includes fees and tax. |
| `base_currency`, `base_amount`, `base_total_amount` | Converted to their base currency. |
| `budget_spend` | **Use this for "how much did I spend".** |
| `cash_out` | **Use this for "how much left my account".** |
| `cash_in` | Income. |
| `exclude_from_budget`, `fx_fallback`, `mcc` | `mcc` is the merchant category code, present only on imported statement rows. |
| `budget_group_id`, `budget_group` | Which budget bucket this row counts against — the transaction's own override if it has one, otherwise the group its category rolls up to. Already resolved; never recompute it from `category`. |

### budget_spend vs cash_out

These answer different questions and are both already correct — never build
either one yourself out of the raw amount columns.

`budget_spend` is what the app's budget and category screens count: expenses and
card payments, minus anything flagged as excluded. Use it for spending by
category, spending against a budget, "what did I spend on X".

`cash_out` is money that actually left an account. **A credit-card purchase is
borrowed, not spent cash**, so it is zero in `cash_out` and only counts when the
card is paid. Use it for cashflow, "how much did I actually pay out", runway.

Sum the column. Do not re-derive either rule.

## q_accounts

One row per account. To find an account someone names in words, match
case-insensitively across `name`, `brand`, and `last4` — "my Amex Platinum"
might be any of the three. Then filter `q_transactions` by the `id` you found.

Columns: `id`, `name`, `type`, `brand`, `last4`, `bank`, `card_group`,
`currency`, `is_archived`, `balance`, `starting_balance`, `current_balance`,
`credit_limit`, `owed`, `utilization_pct`, `latest_statement_balance`,
`latest_due_date`, `latest_period_end`, `statement_closing_day`,
`payment_due_day`, `interest_rate`, `outstanding_balance`,
`installment_amount`, `installments_paid`, `term_months`,
`original_term_months`, `principal`, `start_date`.

Card fields are null on non-cards; loan fields are null on non-loans.
`is_archived` accounts are closed — exclude them unless asked about history.

## q_card_statements

One row per statement period, per card. Read these rather than re-deriving them
from transactions.

Columns: `id`, `account_id`, `account`, `period_start`, `period_end`,
`due_date`, `statement_balance`, `minimum_payment`, `previous_balance`,
`total_debits`, `total_credits`, `cashback_total`, `interest_rate_annual`,
`avg_daily_balance`, `cost_of_carry`, `credit_limit`, `available_credit`,
`overdue_amount`, `source`.

## q_budget_groups

One row per month per budgeted **group** — the planning dimension. Read this for
"am I over on Essentials", "how much of my Lifestyle budget is left".

Columns: `month`, `budget_group_id`, `budget_group`, `budget`, `used`,
`remaining`. `month` is the first day of the month. A group with no budget set
for that month has no row — spending per group regardless of budget is a GROUP
BY on `budget_group` in q_transactions, not a question for this view.

`used` counts the same money q_budgets counts — expenses and card payments,
minus anything excluded. Only the grouping differs.

## q_budgets

One row per month per budgeted **category** — the qualifier dimension. This is
the older of the two budget systems and the two are independent: a person may
use either, both, or neither. If a question is about a bucket by name, check
which vocabulary the name belongs to before choosing between this and
q_budget_groups.

Columns: `month`, `category_id`, `category`, `budget`, `used`, `remaining`.
`month` is the first day of the month. A category with no budget set has no row.
