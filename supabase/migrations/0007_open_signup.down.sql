-- 0007 down: open signup 도입(handle_new_user 함수 갱신) 되돌림.
-- 0006 시점 함수로 복구하려면 0001 의 trigger 만 남기는 것이 안전.
-- 실제 사용자 데이터 손실 가능 — prod 에서는 신중히.
drop function if exists public.handle_new_user() cascade;
-- 함수 재생성은 0001 init.sql 의 정의가 baseline. 개별 환경에서 0001 down 후
-- 재적용 권장. 이 파일은 0007 의 변경 자체만 되돌리는 minimal 버전.
