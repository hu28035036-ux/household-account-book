-- =========================================================
-- 0012: AI 통계 분석 이력 — 페이지 이동해도 결과가 살아있도록 저장.
-- 모임 컨텍스트 분석은 모임 멤버 전체가 select 가능 (RLS).
-- =========================================================

create table if not exists public.ai_stats_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  range_from date not null,
  range_to date not null,
  totals jsonb not null,
  transaction_count integer not null default 0,
  summary text not null default '',
  tips jsonb not null default '[]'::jsonb,
  model text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  cost_krw numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_stats_analyses_user_created
  on public.ai_stats_analyses(user_id, created_at desc);
create index if not exists idx_ai_stats_analyses_household_created
  on public.ai_stats_analyses(household_id, created_at desc)
  where household_id is not null;

alter table public.ai_stats_analyses enable row level security;

drop policy if exists "select_own" on public.ai_stats_analyses;
drop policy if exists "select_own_or_household" on public.ai_stats_analyses;
drop policy if exists "insert_own" on public.ai_stats_analyses;
drop policy if exists "delete_own" on public.ai_stats_analyses;

create policy "select_own_or_household" on public.ai_stats_analyses for select
using (
  auth.uid() = user_id
  or (household_id is not null and public.is_household_member(household_id, auth.uid()))
);
create policy "insert_own" on public.ai_stats_analyses for insert
with check (auth.uid() = user_id);
create policy "delete_own" on public.ai_stats_analyses for delete
using (auth.uid() = user_id);
