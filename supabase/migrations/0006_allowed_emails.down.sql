-- 화이트리스트 제거 + 트리거를 0001 버전으로 되돌리기
-- (운영 환경에서 down 적용 시 0001을 다시 적용하거나 함수 본문을 원복해야 함)
drop table if exists public.allowed_emails cascade;
