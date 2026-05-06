-- =========================================================
-- 0013: profiles 에 별명(nickname) + 같은 모임 멤버끼리 profile select 허용
-- =========================================================

alter table public.profiles add column if not exists nickname text;

-- 같은 모임에 속한 사용자끼리 서로의 프로필(별명/이름)을 볼 수 있어야
-- 멤버 목록에 이름이 표시 가능. SECURITY DEFINER 함수로 RLS 재귀 회피.
create or replace function public.is_in_same_household(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm1
    join public.household_members hm2 on hm1.household_id = hm2.household_id
    where hm1.user_id = auth.uid()
      and hm2.user_id = p_other
  );
$$;

drop policy if exists "select_own" on public.profiles;
drop policy if exists "select_own_or_household_member" on public.profiles;
create policy "select_own_or_household_member" on public.profiles for select
using (
  auth.uid() = user_id
  or public.is_in_same_household(user_id)
);
