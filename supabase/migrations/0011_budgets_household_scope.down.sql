-- 0011 down: budgets 의 household scope 추가 되돌림.
drop index if exists public.uniq_budgets_cat_household;
drop index if exists public.uniq_budgets_total_household;
alter table public.budgets drop column if exists household_id;

-- 0001 의 unique 인덱스 복원
create unique index if not exists uniq_budgets_cat
  on public.budgets (user_id, category_id, period_start);
create unique index if not exists uniq_budgets_total
  on public.budgets (user_id, period_start)
  where category_id is null;
