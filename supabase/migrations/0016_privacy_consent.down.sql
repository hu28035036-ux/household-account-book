-- 0016 down: profiles 의 privacy_consent 컬럼 제거.
alter table public.profiles drop column if exists privacy_consent_at;
alter table public.profiles drop column if exists privacy_consent_version;
