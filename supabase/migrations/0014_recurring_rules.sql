-- =========================================================
-- 0014: 고정 거래 규칙(recurring_rules) — 매일/매주/매월/매년 반복.
-- 사용자 결정:
--   1) 자동/수동 둘 다 가능, 새 규칙은 수동(default)
--   2) auto_post 일 때 N일 전 사전 알림 (notify_days_before)
--   3) 자동 등록된 거래는 그 달만 수정 가능 (룰은 보존)
--   4) 활성 컨텍스트(개인/모임)별 분리
-- =========================================================

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,

  -- 거래 템플릿
  type text not null check (type in ('income','expense','transfer')),
  amount bigint not null check (amount >= 0),
  merchant_name text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,

  -- 반복 규칙
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12),

  -- 운영
  start_date date not null,
  end_date date,
  next_run_date date,
  last_run_date date,
  active boolean not null default true,

  -- 자동/수동 + 사전 알림
  auto_post boolean not null default false,
  notify_days_before integer not null default 0 check (notify_days_before between 0 and 30),
  last_notified_for date,

  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_rules_user_active
  on public.recurring_rules(user_id, active);
create index if not exists idx_recurring_rules_next_run
  on public.recurring_rules(next_run_date) where active = true;
create index if not exists idx_recurring_rules_household
  on public.recurring_rules(household_id) where household_id is not null;

drop trigger if exists trg_recurring_rules_updated_at on public.recurring_rules;
create trigger trg_recurring_rules_updated_at before update on public.recurring_rules
for each row execute function public.set_updated_at();

alter table public.recurring_rules enable row level security;

drop policy if exists "select_own" on public.recurring_rules;
drop policy if exists "select_own_or_household" on public.recurring_rules;
drop policy if exists "insert_own" on public.recurring_rules;
drop policy if exists "update_own" on public.recurring_rules;
drop policy if exists "delete_own" on public.recurring_rules;
create policy "select_own_or_household" on public.recurring_rules for select
using (
  auth.uid() = user_id
  or (household_id is not null and public.is_household_member(household_id, auth.uid()))
);
create policy "insert_own" on public.recurring_rules for insert
with check (auth.uid() = user_id);
create policy "update_own" on public.recurring_rules for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on public.recurring_rules for delete
using (auth.uid() = user_id);

-- 자동/수동 모두 등록된 거래에 룰 추적용 FK 컬럼.
alter table public.transactions
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;
create index if not exists idx_transactions_recurring
  on public.transactions(recurring_rule_id) where recurring_rule_id is not null;

alter table public.transaction_candidates
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

-- 사전 알림용 type 추가 (기존 notifications.type CHECK 확장)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'budget_caution',
      'budget_over',
      'duplicate_warning',
      'extraction_failed',
      'general',
      'recurring_due_soon'
    )
  );
