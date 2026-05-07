import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// 새 보호 라우트 추가 시 다음 4곳을 모두 갱신: middleware / Sidebar / (해당 시) BottomNav / e2e smoke
// PITFALLS §1.3 참고
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/transactions',
  '/upload',
  '/candidates',
  '/stats',
  '/budgets',
  '/categories',
  '/payment-methods',
  '/households',
  '/notifications',
  '/settings',
  '/files',
  '/ai-history',
  '/recurring',
  '/banking',
  '/guide',
  // /privacy 는 의도적으로 공개 (가입 전 검토용) — PROTECTED_PREFIXES 에 넣지 않음
  '/admin',
];
const PUBLIC_ONLY = ['/login', '/signup'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Supabase 일시 장애 / 손상된 토큰으로 getUser()가 throw하면
  // 미들웨어 전체가 죽어 MIDDLEWARE_INVOCATION_FAILED(500) 가 사용자에게 노출된다.
  // 이를 막기 위해 호출을 감싸고, 실패 시 미인증 사용자처럼 흐름을 이어간다.
  // 보호 라우트는 어차피 page 단에서 한 번 더 검증되므로 보안 영향 없음.
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (e) {
    console.warn('[middleware] supabase.auth.getUser failed', e);
    user = null;
  }
  const path = req.nextUrl.pathname;

  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  if (user && PUBLIC_ONLY.some((p) => path === p || path.startsWith(p + '/'))) {
    // /login/mfa 는 비번 통과(aal1) 후 OTP 챌린지를 받기 위한 페이지이므로
    // user 가 있어도 그대로 통과시켜야 함.
    if (path === '/login/mfa' || path.startsWith('/login/mfa/')) return res;
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)'],
};
