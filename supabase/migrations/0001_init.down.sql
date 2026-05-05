-- 롤백 (개발 단계 전용)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.user_correction_logs cascade;
drop table if exists public.analysis_cache cascade;
drop table if exists public.payment_method_learning_rules cascade;
drop table if exists public.category_learning_rules cascade;
drop table if exists public.merchant_learning_rules cascade;
drop table if exists public.global_learning_rules cascade;
drop table if exists public.user_learning_rules cascade;
drop table if exists public.transactions cascade;
drop table if exists public.transaction_candidates cascade;
drop table if exists public.ai_extraction_jobs cascade;
drop table if exists public.ocr_results cascade;
drop table if exists public.uploaded_files cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

drop function if exists public.set_updated_at();
