-- =========================================================
-- 지인 배포용 화이트리스트:
-- 운영자가 등록한 이메일만 가입 가능. 결제/구독 없음.
-- =========================================================

create table if not exists public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_allowed_emails_email on public.allowed_emails(lower(email));

-- 일반 사용자는 본인 이메일이 등록돼 있는지만 알 수 있고,
-- 누가 등록돼 있는지 전체 목록은 service role(관리자 라우트)만 볼 수 있다.
alter table public.allowed_emails enable row level security;
drop policy if exists "self_email_only" on public.allowed_emails;
create policy "self_email_only"
  on public.allowed_emails for select
  using (
    auth.uid() is not null
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
-- insert/update/delete 정책 미부여 → anon/authenticated에는 막힘. service role만 가능.

-- =========================================================
-- 가입 트리거 — 화이트리스트 검증 + 기존 시드(카테고리/결제수단)
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  email_lower text := lower(coalesce(new.email, ''));
  allowed boolean;
begin
  -- 1) 화이트리스트 검증
  select exists(
    select 1 from public.allowed_emails where lower(email) = email_lower
  ) into allowed;
  if not allowed then
    raise exception '초대 명단에 등록되지 않은 이메일입니다 (EMAIL_NOT_ALLOWED): %', email_lower
      using errcode = 'P0001',
            hint = '운영자에게 allowed_emails 등록을 요청하세요.';
  end if;

  -- 2) profile + 기본 시드
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

-- 트리거는 0001에서 이미 등록됨. 함수 교체로 충분.
