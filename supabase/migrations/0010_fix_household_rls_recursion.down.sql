-- 0010 down: household RLS 재귀 fix 되돌림.
-- 0004 시점 정책은 재귀 발생 가능 (의도적으로 적용한 fix 라 down 이 위험).
-- 이 파일은 fix 정책만 drop 하고, 0004 의 원본 정책 재생성은 0004 init 재적용으로 처리.
drop policy if exists "households_select" on public.households;
drop policy if exists "members_select" on public.household_members;
drop policy if exists "members_insert" on public.household_members;
drop policy if exists "members_delete" on public.household_members;
drop policy if exists "invites_select" on public.household_invites;
drop policy if exists "invites_insert" on public.household_invites;
drop policy if exists "invites_update" on public.household_invites;
drop policy if exists "invites_delete" on public.household_invites;
drop function if exists public.is_household_member(uuid, uuid);
