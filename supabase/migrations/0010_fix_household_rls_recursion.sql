-- =========================================================
-- household_members RLS 무한재귀 fix
-- 원인: household_members.select 정책 안에서 같은 테이블을 다시 select →
--       그 select에 또 같은 정책 적용 → 무한재귀 (Postgres 42P17).
-- 해결: SECURITY DEFINER 함수로 멤버십 검사 캡슐화. 함수 내부는 RLS 우회.
-- =========================================================

create or replace function public.is_household_member(p_household uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = p_user
  );
$$;

-- =========================================================
-- households 정책 재작성 (자기 테이블 무관, 가독성 위해 함수 사용)
-- =========================================================
drop policy if exists "households_select" on public.households;
create policy "households_select" on public.households for select
using (
  auth.uid() = owner_id
  or public.is_household_member(id, auth.uid())
);

-- =========================================================
-- household_members 정책 재작성 (재귀 제거)
-- =========================================================
drop policy if exists "members_select" on public.household_members;
create policy "members_select" on public.household_members for select
using (
  auth.uid() = user_id
  or public.is_household_member(household_id, auth.uid())
);

drop policy if exists "members_insert" on public.household_members;
create policy "members_insert" on public.household_members for insert
with check (
  auth.uid() = user_id
  or auth.uid() in (select owner_id from public.households where id = household_members.household_id)
);

drop policy if exists "members_delete" on public.household_members;
create policy "members_delete" on public.household_members for delete
using (
  auth.uid() = user_id
  or auth.uid() in (select owner_id from public.households where id = household_members.household_id)
);

-- =========================================================
-- household_invites 정책 재작성 (member 체크는 함수로)
-- =========================================================
drop policy if exists "invites_select" on public.household_invites;
create policy "invites_select" on public.household_invites for select
using (
  auth.uid() in (select owner_id from public.households where id = household_invites.household_id)
  or public.is_household_member(household_invites.household_id, auth.uid())
);

drop policy if exists "invites_insert" on public.household_invites;
create policy "invites_insert" on public.household_invites for insert
with check (auth.uid() in (select owner_id from public.households where id = household_invites.household_id));

drop policy if exists "invites_update" on public.household_invites;
create policy "invites_update" on public.household_invites for update
using (auth.uid() in (select owner_id from public.households where id = household_invites.household_id));

drop policy if exists "invites_delete" on public.household_invites;
create policy "invites_delete" on public.household_invites for delete
using (auth.uid() in (select owner_id from public.households where id = household_invites.household_id));

-- =========================================================
-- 공유 대상 5개 테이블의 select_own_or_household 재작성
-- (household_members 직접 select → is_household_member 함수 호출로)
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
    execute format('drop policy if exists "select_own_or_household" on public.%I', t);
    execute format(
      'create policy "select_own_or_household" on public.%I for select using (
         auth.uid() = user_id
         or (household_id is not null and public.is_household_member(household_id, auth.uid()))
       )', t);
  end loop;
end $$;
