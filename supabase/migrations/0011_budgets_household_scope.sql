-- =========================================================
-- 0011: budgets — household 단위로 unique 제약을 분리.
--
-- 변경 전: (user_id, [category_id], month_start) 1쌍이 unique.
--          → 같은 사용자가 본인 + 가족모임 + 회사모임 같은 달에
--            "전체 예산"을 따로 매기려 해도 unique 충돌.
-- 변경 후: household_id IS NULL 인 row 와 NOT NULL 인 row 가
--          서로 충돌하지 않게 4 개의 partial unique 로 재구성.
-- =========================================================

-- 기존 인덱스 제거
drop index if exists public.uniq_budgets_cat;
drop index if exists public.uniq_budgets_total;

-- 개인 (household_id IS NULL)
create unique index if not exists uniq_budgets_personal_cat
  on public.budgets(user_id, category_id, month_start)
  where household_id is null and category_id is not null;

create unique index if not exists uniq_budgets_personal_total
  on public.budgets(user_id, month_start)
  where household_id is null and category_id is null;

-- 모임 (household_id IS NOT NULL) — 누가 만들었든 모임 단위로 1행
create unique index if not exists uniq_budgets_household_cat
  on public.budgets(household_id, category_id, month_start)
  where household_id is not null and category_id is not null;

create unique index if not exists uniq_budgets_household_total
  on public.budgets(household_id, month_start)
  where household_id is not null and category_id is null;
