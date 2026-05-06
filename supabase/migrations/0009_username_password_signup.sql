-- =========================================================
-- 회원가입 모드 전환:
-- 이메일 OTP 인증 제거 → 아이디(username) + 이름 + 생년월일 + 비밀번호 + 이메일 가입
-- 로그인은 아이디 + 비밀번호 (Supabase는 내부적으로 email/password 사용; 우리는 username으로 email을 lookup)
--
-- 사용자가 추가로 1회 해야 할 일:
--   Authentication → Sign In / Up → "Confirm email" 토글 OFF
--   Authentication → Settings → "Enable signups" ON
-- =========================================================

-- profiles에 username / full_name / birthdate 컬럼 추가
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists birthdate date;

-- username 대소문자 무시 unique (NULL 허용 — 외부 가입 경로 호환)
create unique index if not exists uniq_profiles_username_lower
  on public.profiles(lower(username))
  where username is not null;

-- =========================================================
-- 가입 트리거: signUp 시 raw_user_meta_data에 담긴 정보를 profiles에 적재
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  v_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_birth_raw text := nullif(trim(new.raw_user_meta_data ->> 'birthdate'), '');
  v_birthdate date;
begin
  if v_birth_raw is not null and v_birth_raw ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      v_birthdate := v_birth_raw::date;
    exception when others then
      v_birthdate := null;
    end;
  end if;

  insert into public.profiles(user_id, username, full_name, birthdate, display_name)
  values (
    new.id,
    v_username,
    v_full_name,
    v_birthdate,
    coalesce(v_full_name, v_username)
  )
  on conflict do nothing;

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
