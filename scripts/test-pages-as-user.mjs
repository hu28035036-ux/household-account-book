#!/usr/bin/env node
/**
 * 로그인 사용자로 모든 페이지 + 인증 API smoke.
 * Supabase service role 로 user 의 access_token 발급 → 쿠키 위장 → fetch.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const envText = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'http://localhost:3000';
const TEST_EMAIL = 'e2e-pages-test@example.com';
const TEST_PASSWORD = 'TestPass!2026';

const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

// 사용자 ensure
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
let user = list.users.find((u) => u.email === TEST_EMAIL);
if (!user) {
  const { data } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  user = data.user;
} else {
  await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD });
}
console.log(`테스트 사용자: ${TEST_EMAIL}`);

// signInWithPassword 로 access_token 발급
const anon = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: sess, error } = await anon.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
});
if (error || !sess.session) {
  console.error('signin 실패:', error?.message);
  process.exit(2);
}
const accessToken = sess.session.access_token;
const refreshToken = sess.session.refresh_token;

// @supabase/ssr 쿠키 형식: 전체 Session 객체를 base64 인코딩 ('base64-' 프리픽스).
// 큰 값은 자동 chunking (.0, .1) — 우리 토큰은 한 쿠키 안에 들어감.
const projectRef = SUPA_URL.match(/https:\/\/(.+?)\.supabase\.co/)[1];
const cookieName = `sb-${projectRef}-auth-token`;
const sessionObj = sess.session;
const cookieValue =
  'base64-' + Buffer.from(JSON.stringify(sessionObj)).toString('base64url');
// chunking: > 3180 byte 면 분할되지만 보통 한 쿠키에 들어감
const cookieHeader = `${cookieName}=${cookieValue}`;

let pass = 0, fail = 0;

async function probe(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      cookie: cookieHeader,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  return { status: res.status, headers: Object.fromEntries(res.headers) };
}

console.log('\n=== 보호 페이지 (로그인 → 200) ===');
const PAGES = [
  '/dashboard', '/transactions', '/upload', '/candidates', '/stats',
  '/budgets', '/categories', '/payment-methods', '/recurring',
  '/households', '/notifications', '/settings', '/files',
  '/ai-history', '/guide',
];
for (const p of PAGES) {
  const r = await probe('GET', p);
  if (r.status === 200) {
    console.log(`[OK]   ${p} → 200`);
    pass++;
  } else if (r.status === 307 || r.status === 302) {
    console.log(`[FAIL] ${p} → ${r.status} (로그인 안 된 것으로 판단됨 — 쿠키 형식 문제일 수 있음)`);
    fail++;
  } else {
    console.log(`[FAIL] ${p} → ${r.status}`);
    fail++;
  }
}

console.log('\n=== 인증 API GET (로그인 → 200) ===');
const APIS = [
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
for (const p of APIS) {
  const r = await probe('GET', p);
  if (r.status === 200) {
    console.log(`[OK]   ${p} → 200`);
    pass++;
  } else {
    console.log(`[FAIL] ${p} → ${r.status}`);
    fail++;
  }
}

console.log(`\n결과: ${pass}/${pass + fail}`);
if (fail > 0) process.exit(1);
