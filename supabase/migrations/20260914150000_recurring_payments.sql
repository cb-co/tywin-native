-- Subscriptions become recurring payments: a saved transaction template that is
-- recorded again each cycle. The table keeps its name — nothing a person sees
-- says "subscriptions" any more, and renaming it would ripple through the ask
-- views, the budget-group view and every generated type for no visible gain.
--
--   kind            expense (what every existing row is) or payment. Income is
--                   out: pay cycles already cover it.
--   to_account_id   a payment's destination — a card, a loan, or an account of
--                   your own. Checked in the app rather than here, because
--                   `on delete set null` would otherwise make deleting that
--                   account fail on the template instead of just emptying it.
--   anchor_date     biweekly's anchor. "Every other Friday" needs to know which
--                   Friday, so a day number cannot express it.
--   include_tax,
--   include_commission
--                   the transfer tax and commission to record with, honoured
--                   only when the source is checking or savings (see
--                   lib/subscriptions/template.ts). A card charge stays fee-free.
--
-- `brand` goes: brand inference has only ever read the name, and nothing else
-- reads the column.

alter type public.billing_cycle add value if not exists 'biweekly' after 'weekly';

alter table public.subscriptions
  add column kind public.transaction_type not null default 'expense',
  add column to_account_id uuid references public.accounts (id) on delete set null,
  add column anchor_date date,
  add column include_tax boolean not null default false,
  add column include_commission boolean not null default false,
  add constraint subscriptions_kind_not_income check (kind <> 'income'),
  drop column brand;

create index subscriptions_to_account_idx on public.subscriptions (to_account_id);
