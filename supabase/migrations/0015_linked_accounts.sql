-- =========================================================
-- 0015: 은행 계좌 연동 (linked_accounts + linked_account_syncs)
-- 아키텍처: 브라우저 → Next.js API → 외부 Aggregator(Codef 등) → DB
--   - 브라우저는 자격증명을 직접 다루지 않음 (Next.js 서버에서만)
--   - credentials_encrypted 는 BANKING_ENCRYPTION_KEY (AES-256-GCM) 로 서버에서만 복호화
--   - 동기화 결과는 transaction_candidates 로 적재 → 사용자 검토 → 거래 승인
-- =========================================================

create table if not exists public.linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,

  -- provider 메타
  provider text not null check (provider in ('mock', 'codef', 'plaid')),
  provider_account_id text not null,

  -- 은행/계좌 메타 (표시용)
  bank_code text not null,                -- KFTC code: '004' KB, '088' 신한, '090' 카카오뱅크 등
  bank_name text not null,
  account_type text not null default 'checking'
    check (account_type in ('checking', 'savings', 'card', 'loan', 'other')),
  account_number_masked text not null,    -- e.g., '****-**-12345-67'
  holder_name text,
  nickname text,                          -- 사용자 지정 별명

  -- 동기화 상태
  last_sync_at timestamptz,
  last_sync_status text not null default 'never'
    check (last_sync_status in ('never', 'pending', 'ok', 'failed')),
  last_sync_error text,
  balance bigint,                         -- 최근 잔액 (있으면)

  -- 자격증명 (서버 전용) — refresh token 또는 provider session blob
  credentials_encrypted text,             -- base64 of AES-256-GCM ciphertext
  credentials_iv text,                    -- base64 of 12-byte IV
  credentials_tag text,                   -- base64 of 16-byte auth tag

  -- 운영
  active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, provider_account_id, user_id)
);

create index if not exists idx_linked_accounts_user
  on public.linked_accounts(user_id, active);
create index if not exists idx_linked_accounts_household
  on public.linked_accounts(household_id) where household_id is not null;

drop trigger if exists trg_linked_accounts_updated_at on public.linked_accounts;
create trigger trg_linked_accounts_updated_at before update on public.linked_accounts
for each row execute function public.set_updated_at();

alter table public.linked_accounts enable row level security;

drop policy if exists "linked_accounts_select_own" on public.linked_accounts;
create policy "linked_accounts_select_own"
  on public.linked_accounts for select
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id, auth.uid()))
  );

drop policy if exists "linked_accounts_insert_own" on public.linked_accounts;
create policy "linked_accounts_insert_own"
  on public.linked_accounts for insert
  with check (user_id = auth.uid());

drop policy if exists "linked_accounts_update_own" on public.linked_accounts;
create policy "linked_accounts_update_own"
  on public.linked_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "linked_accounts_delete_own" on public.linked_accounts;
create policy "linked_accounts_delete_own"
  on public.linked_accounts for delete
  using (user_id = auth.uid());


-- =========================================================
-- 동기화 audit log
-- =========================================================
create table if not exists public.linked_account_syncs (
  id uuid primary key default gen_random_uuid(),
  linked_account_id uuid not null references public.linked_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'ok', 'failed')),
  transactions_fetched integer not null default 0,
  candidates_created integer not null default 0,
  date_from date,
  date_to date,
  error text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_linked_syncs_account
  on public.linked_account_syncs(linked_account_id, started_at desc);

alter table public.linked_account_syncs enable row level security;

drop policy if exists "linked_syncs_select_own" on public.linked_account_syncs;
create policy "linked_syncs_select_own"
  on public.linked_account_syncs for select
  using (user_id = auth.uid());

drop policy if exists "linked_syncs_insert_own" on public.linked_account_syncs;
create policy "linked_syncs_insert_own"
  on public.linked_account_syncs for insert
  with check (user_id = auth.uid());

drop policy if exists "linked_syncs_update_own" on public.linked_account_syncs;
create policy "linked_syncs_update_own"
  on public.linked_account_syncs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- =========================================================
-- transaction_candidates 에 linked_account_id 추가 (출처 추적)
-- =========================================================
alter table public.transaction_candidates
  add column if not exists linked_account_id uuid
  references public.linked_accounts(id) on delete set null;

create index if not exists idx_candidates_linked_account
  on public.transaction_candidates(linked_account_id)
  where linked_account_id is not null;

-- 동일 계좌 내 동일 날짜+금액+가맹점 거래는 한 번만 후보화 (중복 sync 방지)
create unique index if not exists uq_candidates_linked_dedup
  on public.transaction_candidates(
    linked_account_id, transaction_date, amount, coalesce(merchant_name, '')
  )
  where linked_account_id is not null;
