import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  // dev 에서는 SW 끄기 (HMR 충돌 방지)
  disable: process.env.NODE_ENV === 'development',
  register: true,
  // 사용자가 새 빌드를 받자마자 활성화
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    // 새 SW 발견 즉시 활성화 — 사용자가 토스트 무시해도 다음 진입 시 자동 갱신.
    // (SwUpdatePrompt 토스트는 보조: 현재 열린 탭에서 즉시 적용 원할 때 사용)
    skipWaiting: true,
    clientsClaim: true,
    // SSR/auth-aware 페이지는 캐시 X — 항상 네트워크 우선
    runtimeCaching: [
      // /api/* — 절대 캐시 X
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
      // /auth/* (로그인 콜백) — 캐시 X
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/auth/'),
        handler: 'NetworkOnly',
      },
      // 인증 진입 페이지 — 항상 최신. stale 폼은 OAuth 토큰 깨짐 위험.
      {
        urlPattern: ({ url }) => /^\/(login|signup)(\/|$)/.test(url.pathname),
        handler: 'NetworkOnly',
      },
      // /privacy — 공개 정적, 1주일 캐시 (잘 안 바뀜)
      {
        urlPattern: ({ url }) => url.pathname === '/privacy',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'public-pages',
          expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
          // 4xx/5xx 응답은 캐시하지 않음 — stale 에러 영구화 차단
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // 그 외 HTML 문서 — NetworkFirst, 짧은 캐시 (1시간)
      // 24시간이면 새 빌드 배포 후에도 SW 미갱신 사용자가 stale 페이지 볼 수 있음.
      // SwUpdatePrompt 가 5분 폴링 + skip-waiting 처리하므로 1시간이면 충분히 안전.
      {
        urlPattern: ({ request }) =>
          request.destination === 'document' ||
          request.headers.get('accept')?.includes('text/html'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
          // 4xx/5xx HTML(401/403 redirect 등)을 1시간 캐시하면 인증 흐름이 깨질 수 있음
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // CSS/JS/Worker/Font — SWR (해시된 URL 이라 stale 위험 X)
      {
        urlPattern: ({ request }) =>
          ['style', 'script', 'worker', 'font'].includes(request.destination),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static',
          expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
          // 4xx/5xx 응답은 캐시하지 않음 — stale 에러 영구화 차단
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // 이미지 — SWR, 30일 (재방문 빠름)
      // cacheableResponse 미설정 시 4xx 응답이 30일간 stale 로 박혀 onError 영구화 사고 발생 가능.
      {
        urlPattern: ({ request }) => request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // 보안 표준 헤더 — 금융 PII + OpenAI 키를 다루는 앱이라 기본 hardening.
    // CSP 는 Next.js 의 inline script(<Script>, hydration), Vercel Insights,
    // Supabase Realtime WebSocket, OpenAI 호출(서버 라우트 → 클라이언트는 동일 origin)
    // 을 모두 허용하도록 보수적으로 작성.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
