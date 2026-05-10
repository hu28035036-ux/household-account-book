-- 0017 down: 0014 의 owner-only 정책으로 되돌림
drop policy if exists "update_own_or_household" on public.recurring_rules;
drop policy if exists "delete_own_or_household" on public.recurring_rules;

create policy "update_own" on public.recurring_rules for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete_own" on public.recurring_rules for delete
using (auth.uid() = user_id);
