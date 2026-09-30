alter table public.accounts
  add column welcome_bonus_goal_amount   numeric(18,4),
  add column welcome_bonus_goal_currency text check (char_length(welcome_bonus_goal_currency) = 3),
  add column welcome_bonus_due_date      date;
