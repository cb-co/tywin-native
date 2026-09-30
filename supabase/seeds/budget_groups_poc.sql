-- PoC data for the budget-group dimension, for one user.
--
-- Idempotent and purely additive. It creates groups, points existing categories
-- at them, sets a monthly budget per group, and adds a handful of demo
-- transactions of its own. It never edits or deletes a row that was already
-- there — in particular it does not touch `exclude_from_budget` on the user's
-- existing transactions, which is why it brings its own spend to measure.
--
-- Re-running it changes nothing. Every insert is guarded by a conflict target
-- or a not-exists, and the demo transactions are keyed by a marker in `notes`.
--
-- Scoped to one id. Change it and nothing else to point this at another account.

do $$
declare
  v_user   uuid := '4b6e8639-43c7-446c-b2de-6db62eddb6f1';
  v_month  date := date_trunc('month', now())::date;
  v_acct   uuid;
  v_essentials uuid;
  v_lifestyle  uuid;
  v_future     uuid;
  v_misc       uuid;
  v_transport  uuid;
begin
  if not exists (select 1 from auth.users where id = v_user) then
    raise exception 'user % does not exist here', v_user;
  end if;

  -- The planning dimension: four buckets, which is the whole point. A person
  -- plans against a number they can hold in their head, not against twelve.
  insert into public.budget_groups (user_id, name, emoji, color, sort_order)
  values
    (v_user, 'Essentials', '🏠', '#3B82F6', 1),
    (v_user, 'Lifestyle',  '🎉', '#F59E0B', 2),
    (v_user, 'Future',     '🌱', '#10B981', 3),
    (v_user, 'Misc',       '📦', '#6B7280', 4)
  on conflict (user_id, name) do nothing;

  select id into v_essentials from public.budget_groups where user_id = v_user and name = 'Essentials';
  select id into v_lifestyle  from public.budget_groups where user_id = v_user and name = 'Lifestyle';
  select id into v_future     from public.budget_groups where user_id = v_user and name = 'Future';
  select id into v_misc       from public.budget_groups where user_id = v_user and name = 'Misc';

  -- The rollup. Note that it is many-to-one and that the two vocabularies are
  -- deliberately unalike: nothing here is named after a group, and no group is
  -- named after a category. That is the tell that they are separate dimensions
  -- rather than one dimension written twice.
  update public.categories set budget_group_id = v_essentials
    where user_id = v_user and name in ('Groceries', 'Utilities', 'Housing', 'Health', 'Transport');
  update public.categories set budget_group_id = v_lifestyle
    where user_id = v_user and name in ('Dining', 'Entertainment', 'Shopping');
  update public.categories set budget_group_id = v_future
    where user_id = v_user and name in ('Savings');
  update public.categories set budget_group_id = v_misc
    where user_id = v_user and name in ('Other');

  insert into public.budget_group_budgets (user_id, budget_group_id, month, amount)
  values
    (v_user, v_essentials, v_month, 45000),
    (v_user, v_lifestyle,  v_month, 18000),
    (v_user, v_future,     v_month, 20000),
    (v_user, v_misc,       v_month,  5000)
  on conflict (budget_group_id, month) do nothing;

  select id into v_acct from public.accounts
    where user_id = v_user and not is_archived and type in ('checking', 'cash')
    order by created_at limit 1;
  if v_acct is null then
    select id into v_acct from public.accounts where user_id = v_user order by created_at limit 1;
  end if;
  if v_acct is null then
    raise notice 'no account for %, skipping demo transactions', v_user;
    return;
  end if;

  select id into v_transport from public.categories where user_id = v_user and name = 'Transport';

  -- Demo spend, so the groups have something to measure. Marked in `notes` so
  -- it is identifiable, removable, and never inserted twice.
  if not exists (select 1 from public.transactions where user_id = v_user and notes = '[poc:budget-groups]') then
    insert into public.transactions
      (user_id, account_id, category_id, occurred_at, type, description, notes,
       currency, exchange_rate, amount, total_amount, base_amount, base_total_amount,
       exclude_from_budget, budget_group_id)
    select
      v_user, v_acct, c.id, v_month + (d || ' days')::interval, 'expense', descr, '[poc:budget-groups]',
      'DOP', 1, amt, amt, amt, amt,
      false, override
    from (values
      ('Groceries',     'Supermercado Nacional',  4820.00, 2,  null::text),
      ('Groceries',     'Jumbo',                  3110.50, 9,  null),
      ('Utilities',     'EDESUR',                 2740.00, 5,  null),
      ('Dining',        'Adrian Tropical',        1650.00, 6,  null),
      ('Entertainment', 'Caribbean Cinemas',       900.00, 12, null),
      ('Shopping',      'Ikea',                   7300.00, 14, null),
      ('Transport',     'Uber — night out',       780.00,  13, 'lifestyle')
    ) as v(cat, descr, amt, d, tag)
    join public.categories c on c.user_id = v_user and c.name = v.cat
    cross join lateral (
      -- The cross-cutting case, and the reason `transactions.budget_group_id`
      -- exists at all. This row stays Transport for every report that asks what
      -- it WAS, and counts under Lifestyle for the budget that asks what it was
      -- FOR. A strict category-to-group tree cannot express that.
      select case when v.tag = 'lifestyle' then v_lifestyle else null end as override
    ) o;
  end if;
end $$;
