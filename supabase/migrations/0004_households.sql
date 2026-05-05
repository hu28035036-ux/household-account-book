-- =========================================================
-- 가족 공유: households + 멤버십 + 초대 + 공유 가능한 데이터에 household_id
-- 정책: select는 본인 또는 household 멤버, write(insert/update/delete)는 본인 소유 행만.
--        -> 다른 멤버가 만든 거래를 임의로 수정/삭제하지 못함(안전 우선).
-- =========================================================

-- 1) households
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_households_owner on public.households(owner_id);
create trigger trg_households_updated_at before update on public.households
for each row execute function public.set_updated_at();

-- 2) household_members
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index if not exists idx_hm_user on public.household_members(user_id);
create index if not exists idx_hm_household on public.household_members(household_id);

-- 3) household_invites (초대 코드)
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_invites_household on public.household_invites(household_id);

-- =========================================================
-- 공유 대상 테이블에 household_id 추가 (nullable)
-- =========================================================
alter table public.transactions               add column if not exists household_id uuid references public.households(id) on delete set null;
alter table public.transaction_candidates     add column if not exists household_id uuid references public.households(id) on delete set null;
alter table public.categories                 add column if not exists household_id uuid references public.households(id) on delete set null;
alter table public.payment_methods            add column if not exists household_id uuid references public.households(id) on delete set null;
alter table public.budgets                    add column if not exists household_id uuid references public.households(id) on delete set null;

create index if not exists idx_transactions_household on public.transactions(household_id) where household_id is not null;
create index if not exists idx_candidates_household on public.transaction_candidates(household_id) where household_id is not null;
create index if not exists idx_budgets_household on public.budgets(household_id) where household_id is not null;

-- =========================================================
-- RLS — households / members / invites
-- =========================================================
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- 멤버 본인 또는 owner만 households 조회/관리
drop policy if exists "households_select" on public.households;
drop policy if exists "households_insert" on public.households;
drop policy if exists "households_update" on public.households;
drop policy if exists "households_delete" on public.households;

create policy "households_select" on public.households for select
using (
  auth.uid() = owner_id
  or auth.uid() in (select user_id from public.household_members where household_id = households.id)
);
create policy "households_insert" on public.households for insert with check (auth.uid() = owner_id);
create policy "households_update" on public.households for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "households_delete" on public.households for delete using (auth.uid() = owner_id);

-- 멤버: 본인 행 + 같은 household 멤버는 누가 있는지 볼 수 있어야 함
drop policy if exists "members_select" on public.household_members;
drop policy if exists "members_insert" on public.household_members;
drop policy if exists "members_delete" on public.household_members;

create policy "members_select" on public.household_members for select
using (
  auth.uid() = user_id
  or auth.uid() in (
    select user_id from public.household_members hm where hm.household_id = household_members.household_id
  )
);
-- 본인이 자신을 멤버로 등록(가입)하거나, owner가 직접 추가
create policy "members_insert" on public.household_members for insert
with check (
  auth.uid() = user_id
  or auth.uid() in (select owner_id from public.households where id = household_members.household_id)
);
-- 본인 탈퇴 또는 owner의 강제 제거
create policy "members_delete" on public.household_members for delete
using (
  auth.uid() = user_id
  or auth.uid() in (select owner_id from public.households where id = household_members.household_id)
);

-- 초대: owner만 생성/관리, 본인은 코드로 조회
drop policy if exists "invites_select" on public.household_invites;
drop policy if exists "invites_insert" on public.household_invites;
drop policy if exists "invites_update" on public.household_invites;
drop policy if exists "invites_delete" on public.household_invites;

create policy "invites_select" on public.household_invites for select
using (
  auth.uid() in (select owner_id from public.households where id = household_invites.household_id)
  or auth.uid() in (select user_id from public.household_members where household_id = household_invites.household_id)
);
create policy "invites_insert" on public.household_invites for insert
with check (auth.uid() in (select owner_id from public.households where id = household_invites.household_id));
create policy "invites_update" on public.household_invites for update
using (auth.uid() in (select owner_id from public.households where id = household_invites.household_id));
create policy "invites_delete" on public.household_invites for delete
using (auth.uid() in (select owner_id from public.households where id = household_invites.household_id));

-- =========================================================
-- 공유 대상 테이블 RLS 정책 갱신
-- 기존 select_own → 본인 OR (household_id 있고 멤버)
-- write 정책은 본인 user_id 매칭만 (현 정책 유지)
-- =========================================================
do $$
declare
  t text;
  tables text[] := array[
    'transactions',
    'transaction_candidates',
    'categories',
    'payment_methods',
    'budgets'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "select_own" on public.%I', t);
    execute format(
      'create policy "select_own_or_household" on public.%I for select using (
         auth.uid() = user_id
         or (household_id is not null and auth.uid() in (
           select user_id from public.household_members where household_id = %I.household_id
         ))
       )', t, t);
  end loop;
end $$;
