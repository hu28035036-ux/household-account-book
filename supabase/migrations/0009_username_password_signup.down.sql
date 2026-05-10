-- 0009 down: profiles 에 추가된 username/full_name/birthdate 컬럼 제거.
-- 데이터 손실 — prod 에서는 신중히.
drop index if exists public.uniq_profiles_username_lower;
alter table public.profiles drop column if exists username;
alter table public.profiles drop column if exists full_name;
alter table public.profiles drop column if exists birthdate;
alter table public.profiles drop column if exists display_name;
