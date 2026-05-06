-- =========================================================
-- 인앱 알림 (예산 임계 도달 등)
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'budget_caution',
    'budget_over',
    'duplicate_warning',
    'extraction_failed',
    'general'
  )),
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  -- 같은 사건이 반복되지 않도록 dedup 키 (예: 'budget_over:CAT_ID:2026-05')
  dedup_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc) where read_at is null;
create index if not exists idx_notifications_user_all
  on public.notifications(user_id, created_at desc);
-- dedup: 사용자별 + dedup_key가 NULL이 아닐 때만 unique
create unique index if not exists uniq_notifications_dedup
  on public.notifications(user_id, dedup_key) where dedup_key is not null;

alter table public.notifications enable row level security;
drop policy if exists "select_own" on public.notifications;
drop policy if exists "insert_own" on public.notifications;
drop policy if exists "update_own" on public.notifications;
drop policy if exists "delete_own" on public.notifications;
create policy "select_own" on public.notifications for select using (auth.uid() = user_id);
-- 사용자가 자기 알림을 직접 만들 수도 있음(시스템도 user_id 일치 시 가능)
create policy "insert_own" on public.notifications for insert with check (auth.uid() = user_id);
create policy "update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on public.notifications for delete using (auth.uid() = user_id);
