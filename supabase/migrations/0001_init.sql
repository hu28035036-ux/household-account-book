-- =========================================================
-- AI 가계부 초기 스키마
-- 다중 사용자, 사용자별 RLS 격리, 가입 시 기본 시드 자동 생성
-- =========================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =========================================================
-- updated_at 자동 갱신 함수
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =========================================================
-- 1) profiles
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- =========================================================
-- 2) categories
-- =========================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense','common')),
  color text,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_categories_user on public.categories(user_id);
create trigger trg_categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();

-- =========================================================
-- 3) payment_methods
-- =========================================================
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('card','bank','cash','pay','other')),
  issuer_name text,
  masked_number text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_methods_user on public.payment_methods(user_id);
create trigger trg_payment_methods_updated_at before update on public.payment_methods
for each row execute function public.set_updated_at();

-- =========================================================
-- 4) uploaded_files
-- =========================================================
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_size bigint,
  storage_path text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded','ocr_processing','ocr_done','ai_processing','parsed','failed','approved','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_uploaded_files_user_status on public.uploaded_files(user_id, status, created_at desc);
create trigger trg_uploaded_files_updated_at before update on public.uploaded_files
for each row execute function public.set_updated_at();

-- =========================================================
-- 5) ocr_results
-- =========================================================
create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  raw_text text,
  masked_text text,
  confidence numeric(4,3),
  engine text not null check (engine in ('tesseract_js','manual','other')),
  raw_text_purged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ocr_results_user_file on public.ocr_results(user_id, uploaded_file_id);

-- =========================================================
-- 6) ai_extraction_jobs
-- =========================================================
create table if not exists public.ai_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  ocr_result_id uuid references public.ocr_results(id) on delete set null,
  model_name text not null,
  status text not null default 'pending'
    check (status in ('pending','running','success','failed')),
  input_text_masked text,
  extracted_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_jobs_user_file on public.ai_extraction_jobs(user_id, uploaded_file_id);
create trigger trg_ai_jobs_updated_at before update on public.ai_extraction_jobs
for each row execute function public.set_updated_at();

-- =========================================================
-- 7) transaction_candidates
-- =========================================================
create table if not exists public.transaction_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  transaction_date date,
  type text not null check (type in ('income','expense','transfer')),
  amount bigint,
  merchant_name text,
  description text default '',
  category_suggestion text,
  payment_method_suggestion text,
  confidence numeric(4,3) not null default 0,
  duplicate_status text not null default 'none' check (duplicate_status in ('none','suspected','duplicate')),
  raw_text_basis text,
  warnings jsonb not null default '[]'::jsonb,
  user_action text not null default 'pending' check (user_action in ('pending','approved','rejected','edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_candidates_user_action on public.transaction_candidates(user_id, user_action, created_at desc);
create trigger trg_candidates_updated_at before update on public.transaction_candidates
for each row execute function public.set_updated_at();

-- =========================================================
-- 8) transactions
-- =========================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null,
  type text not null check (type in ('income','expense','transfer')),
  amount bigint not null,
  merchant_name text,
  description text default '',
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  source_type text not null default 'manual'
    check (source_type in ('manual','receipt_image','card_capture','bank_capture','pdf','csv','excel')),
  source_file_id uuid references public.uploaded_files(id) on delete set null,
  is_ai_generated boolean not null default false,
  is_confirmed boolean not null default true,
  ai_confidence numeric(4,3),
  duplicate_group_id uuid,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index if not exists idx_transactions_user_cat_date on public.transactions(user_id, category_id, transaction_date);
create trigger trg_transactions_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

-- =========================================================
-- 9) user_learning_rules
-- =========================================================
create table if not exists public.user_learning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_type text not null check (rule_type in ('merchant','category','payment_method','recurring','keyword')),
  raw_pattern text,
  normalized_pattern text not null,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  confidence numeric(4,3) not null default 0.5,
  match_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_user_learning_user_type on public.user_learning_rules(user_id, rule_type);
create trigger trg_user_learning_updated_at before update on public.user_learning_rules
for each row execute function public.set_updated_at();

-- =========================================================
-- 10) global_learning_rules (PII 금지)
-- =========================================================
create table if not exists public.global_learning_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null check (rule_type in ('merchant','category','keyword')),
  normalized_pattern text not null,
  suggested_category_name text,
  confidence numeric(4,3) not null default 0.5,
  match_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_global_learning_pattern on public.global_learning_rules(rule_type, normalized_pattern);

-- =========================================================
-- 11) merchant_learning_rules
-- =========================================================
create table if not exists public.merchant_learning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_raw_name text not null,
  merchant_normalized_name text not null,
  default_category_id uuid references public.categories(id) on delete set null,
  default_payment_method_id uuid references public.payment_methods(id) on delete set null,
  match_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_merchant_learning_user_norm on public.merchant_learning_rules(user_id, merchant_normalized_name);
create trigger trg_merchant_learning_updated_at before update on public.merchant_learning_rules
for each row execute function public.set_updated_at();

-- =========================================================
-- 12) category_learning_rules
-- =========================================================
create table if not exists public.category_learning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  confidence numeric(4,3) not null default 0.5,
  match_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_category_learning_user_kw on public.category_learning_rules(user_id, keyword);

-- =========================================================
-- 13) payment_method_learning_rules
-- =========================================================
create table if not exists public.payment_method_learning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text_pattern text,
  masked_pattern text not null,
  payment_method_id uuid not null references public.payment_methods(id) on delete cascade,
  confidence numeric(4,3) not null default 0.5,
  match_count integer not null default 0
);
create index if not exists idx_pm_learning_user on public.payment_method_learning_rules(user_id);

-- =========================================================
-- 14) analysis_cache
-- =========================================================
create table if not exists public.analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_hash text not null,
  source_type text not null,
  cached_result_json jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (user_id, input_hash)
);
create index if not exists idx_analysis_cache_user_hash on public.analysis_cache(user_id, input_hash);

-- =========================================================
-- 15) user_correction_logs
-- =========================================================
create table if not exists public.user_correction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.transaction_candidates(id) on delete set null,
  field_name text not null,
  before_value_masked text,
  after_value_masked text,
  correction_type text not null check (correction_type in ('manual_edit','approve','reject','bulk_approve','bulk_reject')),
  created_at timestamptz not null default now()
);
create index if not exists idx_correction_logs_user on public.user_correction_logs(user_id, created_at desc);

-- =========================================================
-- RLS — 모든 사용자 소유 테이블
-- =========================================================
do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'categories',
    'payment_methods',
    'uploaded_files',
    'ocr_results',
    'ai_extraction_jobs',
    'transaction_candidates',
    'transactions',
    'user_learning_rules',
    'merchant_learning_rules',
    'category_learning_rules',
    'payment_method_learning_rules',
    'analysis_cache',
    'user_correction_logs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "select_own" on public.%I', t);
    execute format('drop policy if exists "insert_own" on public.%I', t);
    execute format('drop policy if exists "update_own" on public.%I', t);
    execute format('drop policy if exists "delete_own" on public.%I', t);
    execute format('create policy "select_own" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "insert_own" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "delete_own" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- global_learning_rules: 읽기 공개, 쓰기는 service role만
alter table public.global_learning_rules enable row level security;
drop policy if exists "global_select_all" on public.global_learning_rules;
create policy "global_select_all" on public.global_learning_rules for select using (true);
-- insert/update/delete 정책 미부여 → anon/authenticated에는 막힘. service role은 RLS 우회.

-- =========================================================
-- 가입 시 기본 카테고리/결제수단 자동 시드
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id) values (new.id) on conflict do nothing;

  insert into public.categories(user_id, name, type, color, icon, is_default) values
    (new.id, '식비',          'expense', '#F472B6', 'utensils',     true),
    (new.id, '카페/간식',     'expense', '#FBCFE8', 'coffee',       true),
    (new.id, '편의점/마트',   'expense', '#F9A8D4', 'shopping-cart',true),
    (new.id, '교통',          'expense', '#60A5FA', 'bus',          true),
    (new.id, '주거/관리비',   'expense', '#10B981', 'home',         true),
    (new.id, '통신비',        'expense', '#34D399', 'phone',        true),
    (new.id, '의료',          'expense', '#EF4444', 'heart-pulse',  true),
    (new.id, '쇼핑',          'expense', '#F59E0B', 'shopping-bag', true),
    (new.id, '구독',          'expense', '#8B5CF6', 'repeat',       true),
    (new.id, '보험',          'expense', '#6366F1', 'shield',       true),
    (new.id, '교육',          'expense', '#22D3EE', 'book-open',    true),
    (new.id, '여가',          'expense', '#EC4899', 'gamepad-2',    true),
    (new.id, '경조사',        'expense', '#F472B6', 'gift',         true),
    (new.id, '이체',          'common',  '#60A5FA', 'arrow-left-right', true),
    (new.id, '저축',          'income',  '#10B981', 'piggy-bank',   true),
    (new.id, '투자',          'common',  '#10B981', 'trending-up',  true),
    (new.id, '기타',          'common',  '#9CA3AF', 'circle',       true)
  on conflict do nothing;

  insert into public.payment_methods(user_id, name, type, is_default) values
    (new.id, '현금',         'cash', true),
    (new.id, '카드',         'card', true),
    (new.id, '계좌이체',     'bank', true),
    (new.id, '체크카드',     'card', true),
    (new.id, '신용카드',     'card', true),
    (new.id, '네이버페이',   'pay',  true),
    (new.id, '카카오페이',   'pay',  true),
    (new.id, '토스페이',     'pay',  true),
    (new.id, '기타',         'other',true)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
