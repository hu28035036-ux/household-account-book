-- 0013 down: profiles.nickname 컬럼 + 정책 변경 되돌림.
drop policy if exists "select_own_or_household_member" on public.profiles;
alter table public.profiles drop column if exists nickname;

-- 0001/0009 시점의 self-only select 정책 복원
create policy "select_own" on public.profiles for select
  using (auth.uid() = user_id);
