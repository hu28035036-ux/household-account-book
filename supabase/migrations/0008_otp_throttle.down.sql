-- 0008 down: otp_send_log 테이블 폐기
drop index if exists public.idx_otp_send_log_email_time;
drop table if exists public.otp_send_log cascade;
