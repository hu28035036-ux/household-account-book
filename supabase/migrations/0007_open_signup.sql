-- =========================================================
-- 자유 가입 모드 (Open Signup)
-- 정책 변경: 누구나 매직링크/OTP 인증으로 가입 가능. 화이트리스트 없음.
-- 운영자는 /admin에서 사후 차단/삭제 가능.
-- (allowed_emails 테이블은 남겨두되 트리거에서 더 이상 검증 안 함)
-- =========================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 화이트리스트 검증 제거 — 누구든 가입 허용.
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
