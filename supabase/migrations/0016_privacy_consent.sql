-- =========================================================
-- 0016: 개인정보처리방침 동의 추적
-- - privacy_consent_at: 동의 시각. NULL 이면 미동의.
-- - privacy_consent_version: 동의한 방침 버전 (방침이 크게 바뀌면 재동의 받기 위함).
-- 기존 사용자는 NULL 로 시작 → AI 기능 진입 시 모달 노출 흐름.
-- =========================================================

alter table public.profiles
  add column if not exists privacy_consent_at timestamptz;

alter table public.profiles
  add column if not exists privacy_consent_version text;

-- index 는 굳이 필요 없음 (단일 사용자 조회시 user_id 인덱스로 충분)

comment on column public.profiles.privacy_consent_at is
  '개인정보처리방침 동의 시각. NULL 이면 미동의 — AI 기능 등 추가 동의 필요 작업 차단.';

comment on column public.profiles.privacy_consent_version is
  '동의한 방침의 버전 식별자. 방침이 크게 바뀌면 새 버전으로 갱신 후 재동의 요구.';

-- PostgREST 스키마 캐시 reload — 새 컬럼이 즉시 REST API 응답에 반영되도록.
-- (없으면 ext SELECT 가 컬럼은 받지만 값이 silent null 로 나옴)
notify pgrst, 'reload schema';
