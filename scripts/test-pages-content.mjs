#!/usr/bin/env node
/**
 * 인증된 사용자로 보호 페이지 진입 + 핵심 콘텐츠 노출 검증.
 * (200 만으로는 빈 페이지/깨진 페이지 못 잡음 — 키워드 매칭으로 강화)
 *
 * 비밀번호 변경 안 함 — magic link 로 access_token 만 발급받아 쿠키 위장.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ADMIN = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const ANON = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

const TEST_EMAIL = 'e2e-pages-test@example.com';

// 사용자 ensure (비번 안 건드림 — 이미 있으면 그대로)
const { data: list } = await ADMIN.auth.admin.listUsers({ page: 1, perPage: 200 });
let user = list.users.find((u) => u.email === TEST_EMAIL);
if (!user) {
  const { data } = await ADMIN.auth.admin.createUser({ email: TEST_EMAIL, email_confirm: true });
  user = data.user;
}

// magic link 로 access_token 받기
const { data: link } = await ADMIN.auth.admin.generateLink({
  type: 'magiclink',
  email: TEST_EMAIL,
});
const { data: sess, error: ve } = await ANON.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'magiclink',
});
if (ve) {
  console.error('verify 실패:', ve.message);
  process.exit(2);
}
const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)[1];
const cookieHeader = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(sess.session)).toString('base64url')}`;

// 페이지별 기대 키워드 (HTML 본문에 포함되어야 정상)
const PAGES = [
  { path: '/dashboard', expect: ['월 캘린더', '이번 달 합계'] },
  { path: '/transactions', expect: ['거래내역'] },
  { path: '/upload', expect: ['업로드'] },
  { path: '/candidates', expect: ['분석 후보'] },
  { path: '/stats', expect: ['통계'] },
  { path: '/budgets', expect: ['예산'] },
  { path: '/categories', expect: ['카테고리'] },
  { path: '/payment-methods', expect: ['결제수단'] },
  { path: '/recurring', expect: ['고정 거래'] },
  { path: '/households', expect: ['모임'] },
  { path: '/notifications', expect: ['알림'] },
  { path: '/settings', expect: ['설정'] },
  { path: '/files', expect: ['원본 파일', '파일'] },
  { path: '/ai-history', expect: ['AI'] },
  { path: '/guide', expect: ['가계부 작성 가이드', '큰 흐름'] },
  // 공개 페이지
  { path: '/privacy', expect: ['개인정보처리방침', '운영자 접근 가능성'], unauth: true },
];

let pass = 0,
  fail = 0;
const failures = [];

for (const p of PAGES) {
  const headers = p.unauth ? {} : { cookie: cookieHeader };
  let res, html;
  try {
    res = await fetch(`${BASE}${p.path}`, { headers, redirect: 'manual' });
    html = await res.text();
  } catch (e) {
    console.log(`[ERR]  ${p.path} — fetch 실패 ${e.message}`);
    fail++;
    failures.push({ path: p.path, error: e.message });
    continue;
  }
  if (res.status !== 200) {
    console.log(`[FAIL] ${p.path} → status ${res.status}`);
    fail++;
    failures.push({ path: p.path, status: res.status });
    continue;
  }
  // OR 매칭 — expect 중 하나라도 본문에 있으면 OK
  const matched = p.expect.some((kw) => html.includes(kw));
  if (matched) {
    const found = p.expect.filter((kw) => html.includes(kw))[0];
    console.log(`[OK]   ${p.path} — "${found}" 노출`);
    pass++;
  } else {
    console.log(`[FAIL] ${p.path} → expected ${JSON.stringify(p.expect)} 중 하나 없음`);
    fail++;
    failures.push({ path: p.path, expected: p.expect });
  }
}

console.log(`\n결과: ${pass}/${pass + fail}`);
if (failures.length) {
  console.log('\n실패 상세:');
  for (const f of failures) console.log(' ', JSON.stringify(f));
  process.exit(1);
}
