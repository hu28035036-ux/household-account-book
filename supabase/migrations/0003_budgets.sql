-- =========================================================
-- 예산: 카테고리별 또는 전체 월 예산
-- =========================================================

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  -- 해당 월의 1일 (KST 기준)
  month_start date not null,
  amount bigint not null check (amount >= 0),
  alert_threshold numeric(3,2) not null default 0.8 check (alert_threshold >= 0 and alert_threshold <= 1),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 카테고리별 + 월 → 1건. NULL은 전체 예산이라 별도 partial unique.
create unique index if not exists uniq_budgets_cat
  on public.budgets(user_id, category_id, month_start)
  where category_id is not null;
create unique index if not exists uniq_budgets_total
  on public.budgets(user_id, month_start)
  where category_id is null;

create index if not exists idx_budgets_user_month
  on public.budgets(user_id, month_start desc);

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at before update on public.budgets
for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
drop policy if exists "select_own" on public.budgets;
drop policy if exists "insert_own" on public.budgets;
drop policy if exists "update_own" on public.budgets;
drop policy if exists "delete_own" on public.budgets;
create policy "select_own" on public.budgets for select using (auth.uid() = user_id);
create policy "insert_own" on public.budgets for insert with check (auth.uid() = user_id);
create policy "update_own" on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on public.budgets for delete using (auth.uid() = user_id);
