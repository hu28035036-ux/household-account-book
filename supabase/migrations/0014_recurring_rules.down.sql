-- 0014 down: recurring_rules 테이블 + 관련 컬럼 제거.
-- 데이터 손실 — prod 에서는 신중히.
drop policy if exists "select_own_or_household" on public.recurring_rules;
drop policy if exists "insert_own" on public.recurring_rules;
drop policy if exists "update_own" on public.recurring_rules;
drop policy if exists "delete_own" on public.recurring_rules;
drop trigger if exists trg_recurring_rules_updated_at on public.recurring_rules;
drop index if exists public.idx_recurring_rules_user_active;
drop index if exists public.idx_recurring_rules_next_run;
drop index if exists public.idx_recurring_rules_household;
drop table if exists public.recurring_rules cascade;

-- transactions / transaction_candidates 의 추적 컬럼 제거
drop index if exists public.idx_transactions_recurring;
alter table public.transactions drop column if exists recurring_rule_id;
alter table public.transaction_candidates drop column if exists recurring_rule_id;

-- notifications type 체크 제약 복원 (0001/0005 baseline)
alter table public.notifications drop constraint if exists notifications_type_check;
