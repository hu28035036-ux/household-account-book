-- 0012 down: ai_stats_analyses 테이블 폐기 (회고 기록 손실)
drop index if exists public.idx_ai_stats_analyses_user_created;
drop index if exists public.idx_ai_stats_analyses_household_created;
drop table if exists public.ai_stats_analyses cascade;
