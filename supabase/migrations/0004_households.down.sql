-- 롤백 (개발 단계 전용)
-- 1) 정책 복원: select_own (단일 사용자)
do $$
declare
  t text;
  tables text[] := array['transactions','transaction_candidates','categories','payment_methods','budgets'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "select_own_or_household" on public.%I', t);
    execute format('create policy "select_own" on public.%I for select using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- 2) household_id 컬럼 제거
alter table public.transactions               drop column if exists household_id;
alter table public.transaction_candidates     drop column if exists household_id;
alter table public.categories                 drop column if exists household_id;
alter table public.payment_methods            drop column if exists household_id;
alter table public.budgets                    drop column if exists household_id;

-- 3) 테이블 제거
drop table if exists public.household_invites cascade;
drop table if exists public.household_members cascade;
drop table if exists public.households cascade;
