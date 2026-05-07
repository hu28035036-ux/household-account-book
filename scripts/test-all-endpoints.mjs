#!/usr/bin/env node
/**
 * 전체 API 엔드포인트 smoke + auth gate 검증.
 * 실 dev 서버에 비로그인 상태로 GET 호출 → 401/200/redirect 정상 응답하는지.
 */

const BASE = 'http://localhost:3000';

// 보호 라우트 (페이지) — 비로그인 시 /login 으로 redirect (307)
const PROTECTED_PAGES = [
  '/dashboard', '/transactions', '/upload', '/candidates', '/stats',
  '/budgets', '/categories', '/payment-methods', '/recurring',
  '/households', '/notifications', '/settings', '/files',
  '/ai-history', '/guide', '/admin',
];

// 인증 필요 API (GET) — 비로그인 시 401
const AUTH_GET_APIS = [
  '/api/me',
  '/api/categories',
  '/api/payment-methods',
  '/api/budgets',
  '/api/budgets/progress',
  '/api/candidates',
  '/api/transactions',
  '/api/recurring',
  '/api/households',
  '/api/notifications',
  '/api/files',
  '/api/dashboard/summary',
  '/api/analytics/summary',
  '/api/analytics/insights',
  '/api/stats/ai-analysis',
  '/api/banking/accounts',
  '/api/banking/banks',
];

// 인증 필요 API (POST) — 비로그인 시 401
const AUTH_POST_APIS = [
  ['/api/assistant/parse', { command: '스벅 5천' }],
  ['/api/assistant/execute', { intent: { type: 'navigate', data: { destination: 'stats' } } }],
  ['/api/learning/rules', { merchant_normalized_name: 'test', default_category_id: null, default_payment_method_id: null }],
  ['/api/candidates/approve-bulk', { ids: [] }],
  ['/api/candidates/reject-bulk', { ids: [] }],
];

// 공개 API — 200 정상
const PUBLIC_APIS = [
  '/api/ai-status',
];

let pass = 0, fail = 0;
const failures = [];

async function probe(method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    return { status: res.status };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

console.log('=== 보호 페이지 (비로그인 → 307 redirect) ===');
for (const p of PROTECTED_PAGES) {
  const r = await probe('GET', p);
  // middleware 가 redirect 또는 200 (login 페이지 자체가 아니라 보호 라우트면 redirect 가 정상)
  // 307 = next/navigation redirect, 302 = supabase redirect
  if ([302, 307, 308].includes(r.status)) {
    console.log(`[OK]   ${p} → ${r.status}`);
    pass++;
  } else {
    console.log(`[FAIL] ${p} → ${r.status}`);
    failures.push({ path: p, got: r.status, expected: '307 redirect' });
    fail++;
  }
}

console.log('\n=== 인증 API (비로그인 → 401) ===');
for (const p of AUTH_GET_APIS) {
  const r = await probe('GET', p);
  if (r.status === 401) {
    console.log(`[OK]   GET ${p} → 401`);
    pass++;
  } else {
    console.log(`[FAIL] GET ${p} → ${r.status}`);
    failures.push({ path: `GET ${p}`, got: r.status, expected: 401 });
    fail++;
  }
}

console.log('\n=== 인증 POST API (비로그인 → 401) ===');
for (const [p, body] of AUTH_POST_APIS) {
  const r = await probe('POST', p, body);
  if (r.status === 401) {
    console.log(`[OK]   POST ${p} → 401`);
    pass++;
  } else {
    console.log(`[FAIL] POST ${p} → ${r.status}`);
    failures.push({ path: `POST ${p}`, got: r.status, expected: 401 });
    fail++;
  }
}

console.log('\n=== 공개 API (200 또는 503) ===');
for (const p of PUBLIC_APIS) {
  const r = await probe('GET', p);
  if (r.status === 200 || r.status === 503) {
    console.log(`[OK]   GET ${p} → ${r.status}`);
    pass++;
  } else {
    console.log(`[FAIL] GET ${p} → ${r.status}`);
    failures.push({ path: `GET ${p}`, got: r.status });
    fail++;
  }
}

console.log(`\n결과: ${pass}/${pass + fail}`);
if (failures.length) {
  console.log('\n실패 상세:');
  for (const f of failures) console.log(' ', JSON.stringify(f));
  process.exit(1);
}
