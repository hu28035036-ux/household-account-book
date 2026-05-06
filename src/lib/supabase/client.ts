'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저 Supabase 클라이언트.
 *
 * 세션 정책: **영구 유지**
 *  - persistSession: true       — 토큰을 localStorage에 보관, 탭/창을 닫고 다시 열어도 유지
 *  - autoRefreshToken: true     — access token 만료 직전에 refresh token으로 자동 갱신
 *  - detectSessionInUrl: true   — /auth/callback 같은 URL 해시도 자동 처리(매직링크 fallback)
 *
 * 결과: 한 번 OTP로 인증한 브라우저는 명시적 로그아웃 / storage 삭제 / 관리자 차단 전까지 자동 로그인.
 * (기본값과 같지만 의도를 명시화 — 향후 라이브러리 기본값이 바뀌어도 영구 정책 유지)
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
