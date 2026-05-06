-- =========================================================
-- OTP 전송 throttle용 로그 테이블 (서버 측 3초 cooldown)
-- =========================================================
create table if not exists public.otp_send_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  sent_at timestamptz not null default now()
);
create index if not exists idx_otp_send_log_email_time
  on public.otp_send_log(email, sent_at desc);

-- service role만 사용 (anon 차단)
alter table public.otp_send_log enable row level security;
-- 정책 부여 X → service role 외에는 select/insert 모두 차단
