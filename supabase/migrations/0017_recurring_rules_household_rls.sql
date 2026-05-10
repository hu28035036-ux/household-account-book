-- 0017: recurring_rules 의 UPDATE/DELETE RLS 를 모임 멤버에게도 허용.
--
-- 기존 (0014_recurring_rules.sql):
--   SELECT — auth.uid()=user_id OR is_household_member(household_id, auth.uid())
--   UPDATE/DELETE — auth.uid()=user_id 만 (모임 멤버는 SELECT 만 가능)
--
-- 비대칭이 의도였는지 명확치 않은데, 가족 모임의 고정거래(월세·통신비 등)는
-- 멤버 누구든 수정·삭제할 수 있어야 운영 가능. household_id 가 셋된 룰만 멤버
-- 권한 추가, 개인 룰(household_id IS NULL)은 그대로 owner 만.

drop policy if exists "update_own" on public.recurring_rules;
drop policy if exists "delete_own" on public.recurring_rules;
drop policy if exists "update_own_or_household" on public.recurring_rules;
drop policy if exists "delete_own_or_household" on public.recurring_rules;

create policy "update_own_or_household" on public.recurring_rules for update
using (
  auth.uid() = user_id
  or (household_id is not null and public.is_household_member(household_id, auth.uid()))
)
with check (
  auth.uid() = user_id
  or (household_id is not null and public.is_household_member(household_id, auth.uid()))
);

create policy "delete_own_or_household" on public.recurring_rules for delete
using (
  auth.uid() = user_id
  or (household_id is not null and public.is_household_member(household_id, auth.uid()))
);
