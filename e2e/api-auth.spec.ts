import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * API 인증 가드: 모든 사용자 데이터 API가 미로그인 상태에서 401 (UNAUTHORIZED)을 반환하는지 검증.
 *
 * 예외:
 *  - /api/auth/callback : 401 의미 없음 (OAuth 콜백)
 *  - /api/ai-status     : 헬스체크라 200 허용
 *  - /api/admin/*       : x-cron-token 검증이라 401이지만 공개 노출 의도
 */

type Endpoint =
  | { method: 'GET'; path: string }
  | { method: 'POST'; path: string; body?: unknown }
  | { method: 'PATCH'; path: string; body?: unknown }
  | { method: 'DELETE'; path: string };

const PROTECTED: Endpoint[] = [
  // me
  { method: 'GET', path: '/api/me' },
  // transactions
  { method: 'GET', path: '/api/transactions' },
  { method: 'POST', path: '/api/transactions', body: {} },
  { method: 'PATCH', path: '/api/transactions/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'DELETE', path: '/api/transactions/00000000-0000-0000-0000-000000000000' },
  // categories
  { method: 'GET', path: '/api/categories' },
  { method: 'POST', path: '/api/categories', body: {} },
  { method: 'PATCH', path: '/api/categories/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'DELETE', path: '/api/categories/00000000-0000-0000-0000-000000000000' },
  // payment methods
  { method: 'GET', path: '/api/payment-methods' },
  { method: 'POST', path: '/api/payment-methods', body: {} },
  { method: 'PATCH', path: '/api/payment-methods/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'DELETE', path: '/api/payment-methods/00000000-0000-0000-0000-000000000000' },
  // files / upload / ocr / extraction
  { method: 'GET', path: '/api/files' },
  { method: 'GET', path: '/api/files/00000000-0000-0000-0000-000000000000' },
  { method: 'DELETE', path: '/api/files/00000000-0000-0000-0000-000000000000' },
  { method: 'POST', path: '/api/upload' },
  { method: 'POST', path: '/api/ocr/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'GET', path: '/api/ocr/00000000-0000-0000-0000-000000000000' },
  { method: 'POST', path: '/api/extraction/00000000-0000-0000-0000-000000000000' },
  // candidates
  { method: 'GET', path: '/api/candidates' },
  { method: 'PATCH', path: '/api/candidates/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'POST', path: '/api/candidates/00000000-0000-0000-0000-000000000000/approve' },
  { method: 'POST', path: '/api/candidates/00000000-0000-0000-0000-000000000000/reject' },
  { method: 'POST', path: '/api/candidates/approve-bulk', body: { ids: ['00000000-0000-0000-0000-000000000000'] } },
  // learning
  { method: 'GET', path: '/api/learning/rules' },
  { method: 'POST', path: '/api/learning/rules', body: {} },
  { method: 'PATCH', path: '/api/learning/rules/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'DELETE', path: '/api/learning/rules/00000000-0000-0000-0000-000000000000' },
  // dashboard / analytics
  { method: 'GET', path: '/api/dashboard/summary' },
  { method: 'GET', path: '/api/analytics/summary' },
  { method: 'GET', path: '/api/analytics/insights' },
  // budgets
  { method: 'GET', path: '/api/budgets' },
  { method: 'POST', path: '/api/budgets', body: {} },
  { method: 'DELETE', path: '/api/budgets/00000000-0000-0000-0000-000000000000' },
  { method: 'GET', path: '/api/budgets/progress' },
  // notifications
  { method: 'GET', path: '/api/notifications' },
  { method: 'DELETE', path: '/api/notifications/00000000-0000-0000-0000-000000000000' },
  { method: 'POST', path: '/api/notifications/00000000-0000-0000-0000-000000000000/read' },
  { method: 'POST', path: '/api/notifications/read-all' },
  { method: 'POST', path: '/api/notifications/check-budgets' },
  // households
  { method: 'GET', path: '/api/households' },
  { method: 'POST', path: '/api/households', body: {} },
  { method: 'PATCH', path: '/api/households/00000000-0000-0000-0000-000000000000', body: {} },
  { method: 'DELETE', path: '/api/households/00000000-0000-0000-0000-000000000000' },
  { method: 'GET', path: '/api/households/00000000-0000-0000-0000-000000000000/members' },
  { method: 'DELETE', path: '/api/households/00000000-0000-0000-0000-000000000000/members/00000000-0000-0000-0000-000000000000' },
  { method: 'GET', path: '/api/households/00000000-0000-0000-0000-000000000000/invites' },
  { method: 'POST', path: '/api/households/00000000-0000-0000-0000-000000000000/invites' },
  { method: 'DELETE', path: '/api/households/00000000-0000-0000-0000-000000000000/invites/00000000-0000-0000-0000-000000000000' },
  { method: 'POST', path: '/api/households/join', body: { code: 'TEST123' } },
  // export / account / import
  { method: 'GET', path: '/api/export' },
  { method: 'GET', path: '/api/export/transactions' },
  { method: 'DELETE', path: '/api/account' },
  { method: 'POST', path: '/api/import/commit', body: { candidates: [] } },
];

async function call(req: APIRequestContext, ep: Endpoint) {
  const opts = ep.method !== 'GET' && ep.method !== 'DELETE' ? { data: (ep as any).body ?? {} } : undefined;
  switch (ep.method) {
    case 'GET':
      return req.get(ep.path);
    case 'POST':
      return req.post(ep.path, opts);
    case 'PATCH':
      return req.patch(ep.path, opts);
    case 'DELETE':
      return req.delete(ep.path);
  }
}

for (const ep of PROTECTED) {
  test(`${ep.method} ${ep.path} 미인증 → 401`, async ({ request }) => {
    const res = await call(request, ep);
    expect(res.status(), `${ep.method} ${ep.path}`).toBe(401);
  });
}

test('GET /api/ai-status 는 인증 없이도 200 (헬스체크)', async ({ request }) => {
  const res = await request.get('/api/ai-status');
  expect(res.status()).toBe(200);
});

test('POST /api/admin/purge-raw-text 잘못된 토큰 → 401', async ({ request }) => {
  const res = await request.post('/api/admin/purge-raw-text');
  expect(res.status()).toBe(401);
});
