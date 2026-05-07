#!/usr/bin/env node
/**
 * 인증된 사용자로 mutation API 라이프사이클 검증.
 * 각 도메인별 CREATE → READ → UPDATE → DELETE → cleanup 확인.
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

const TEST_EMAIL = 'e2e-mutation-test@example.com';
const { data: list } = await ADMIN.auth.admin.listUsers({ page: 1, perPage: 200 });
let user = list.users.find((u) => u.email === TEST_EMAIL);
if (!user) {
  const { data } = await ADMIN.auth.admin.createUser({ email: TEST_EMAIL, email_confirm: true });
  user = data.user;
}
const userId = user.id;

const { data: link } = await ADMIN.auth.admin.generateLink({
  type: 'magiclink',
  email: TEST_EMAIL,
});
const { data: sess } = await ANON.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'magiclink',
});
const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)[1];
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(sess.session)).toString('base64url')}`;

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, info) {
  if (cond) {
    console.log(`[OK]   ${name}`);
    pass++;
  } else {
    console.log(`[FAIL] ${name}`, info ? JSON.stringify(info).slice(0, 200) : '');
    fail++;
    fails.push({ name, info });
  }
}

// 사전: profiles row 보장 (consent API 가 의존하지 않지만 categories 등은 RLS 통과 필요)
{
  const { data: existing } = await ADMIN
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!existing) {
    await ADMIN.from('profiles').insert({ user_id: userId });
  }
}

// =============================================================================
console.log('=== /api/categories CRUD ===');
let createdCatId = null;
{
  // CREATE
  const r1 = await api('POST', '/api/categories', { name: '_e2e_test', type: 'common' });
  check('POST 카테고리 생성', r1.status === 200 || r1.status === 201, r1);
  createdCatId = r1.json?.data?.id;
  check('생성된 카테고리 id 반환', !!createdCatId);

  // READ (LIST)
  const r2 = await api('GET', '/api/categories');
  check('GET 카테고리 목록 200', r2.status === 200);
  const found = (r2.json?.data ?? []).some((c) => c.id === createdCatId);
  check('목록에 방금 만든 카테고리 포함', found);

  // UPDATE
  const r3 = await api('PATCH', `/api/categories/${createdCatId}`, { name: '_e2e_test_renamed' });
  check('PATCH 카테고리 이름 수정', r3.status === 200, r3);
  check('이름 갱신됨', r3.json?.data?.name === '_e2e_test_renamed');

  // DELETE
  const r4 = await api('DELETE', `/api/categories/${createdCatId}`);
  check('DELETE 카테고리 200', r4.status === 200);

  // 삭제 확인
  const { data: after } = await ADMIN
    .from('categories')
    .select('id')
    .eq('id', createdCatId)
    .maybeSingle();
  check('DB 에서 카테고리 사라짐', after === null);
}

// =============================================================================
console.log('\n=== /api/payment-methods CRUD ===');
let createdPmId = null;
{
  const r1 = await api('POST', '/api/payment-methods', { name: '_e2e_pm', type: 'card' });
  check('POST 결제수단 생성', r1.status === 200 || r1.status === 201);
  createdPmId = r1.json?.data?.id;
  check('생성 id 반환', !!createdPmId);

  const r2 = await api('GET', '/api/payment-methods');
  check('GET 목록 200', r2.status === 200);
  check('목록에 포함', (r2.json?.data ?? []).some((p) => p.id === createdPmId));

  const r4 = await api('DELETE', `/api/payment-methods/${createdPmId}`);
  check('DELETE 200', r4.status === 200);
}

// =============================================================================
console.log('\n=== /api/transactions CRUD ===');
let createdTxId = null;
{
  // create — 직접 service role 로 시드 카테고리 생성
  let { data: cats } = await ADMIN
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', '식비')
    .limit(1);
  let categoryId = cats?.[0]?.id;
  if (!categoryId) {
    const { data: c } = await ADMIN
      .from('categories')
      .insert({ user_id: userId, name: '식비', type: 'common' })
      .select('id')
      .single();
    categoryId = c?.id;
  }

  const r1 = await api('POST', '/api/transactions', {
    transaction_date: new Date().toISOString().slice(0, 10),
    type: 'expense',
    amount: 5000,
    merchant_name: '_e2e_merchant',
    category_id: categoryId,
  });
  check('POST 거래 생성', r1.status === 200 || r1.status === 201, r1);
  createdTxId = r1.json?.data?.id;
  check('생성된 거래 id 반환', !!createdTxId);

  // GET 목록 (필수)
  const r2 = await api('GET', '/api/transactions?limit=10');
  check('GET 거래 목록 200', r2.status === 200);
  const rows = r2.json?.data?.rows ?? r2.json?.data ?? [];
  check('목록에 포함', rows.some((t) => t.id === createdTxId), { rowsLen: rows.length });

  // PATCH (단건 수정)
  const r3 = await api('PATCH', `/api/transactions/${createdTxId}`, { amount: 6000 });
  check('PATCH 거래 수정', r3.status === 200);
  check('amount 갱신됨', r3.json?.data?.amount === 6000);

  // DELETE
  const r4 = await api('DELETE', `/api/transactions/${createdTxId}`);
  check('DELETE 200', r4.status === 200);
}

// =============================================================================
console.log('\n=== /api/budgets upsert ===');
{
  const ym = new Date().toISOString().slice(0, 7);
  // 전체 예산 set
  const r1 = await api('POST', '/api/budgets', {
    year_month: ym,
    amount: 800000,
    category_id: null,
  });
  check('POST 예산 (전체) 200', r1.status === 200 || r1.status === 201, r1);

  // 다시 같은 (월, null) 로 다른 금액 → 같은 row update (upsert)
  const r2 = await api('POST', '/api/budgets', {
    year_month: ym,
    amount: 1000000,
    category_id: null,
  });
  check('POST 같은 키로 갱신 (upsert)', r2.status === 200 || r2.status === 201);

  // 조회
  const r3 = await api('GET', `/api/budgets?ym=${ym}`);
  check('GET 예산 목록', r3.status === 200);
  const budgets = r3.json?.data ?? [];
  const overall = budgets.find((b) => b.category_id === null);
  check('갱신 후 amount=1,000,000', overall?.amount === 1000000, overall);

  // cleanup
  if (overall?.id) await ADMIN.from('budgets').delete().eq('id', overall.id);
}

// =============================================================================
console.log('\n=== /api/account/consent UPSERT ===');
{
  // 처음에 NULL 로 reset
  await ADMIN
    .from('profiles')
    .update({ privacy_consent_at: null, privacy_consent_version: null })
    .eq('user_id', userId);

  const r1 = await api('POST', '/api/account/consent', { type: 'privacy', version: 'v1' });
  check('POST consent 200', r1.status === 200, r1);
  check('consented_at 응답에 포함', !!r1.json?.data?.consented_at);

  // /api/me 가 그 값 반환하는지
  const r2 = await api('GET', '/api/me');
  check('GET /api/me — privacy_consent_at 채워짐', !!r2.json?.data?.privacy_consent_at, r2.json?.data);
}

// =============================================================================
console.log('\n=== /api/assistant 통합 (parse + execute) ===');
{
  const r1 = await api('POST', '/api/assistant/parse', { command: '통계 보여줘' });
  check('parse 200', r1.status === 200);
  check('navigate intent', r1.json?.data?.intent?.type === 'navigate');
  check('destination=stats', r1.json?.data?.intent?.data?.destination === 'stats');

  const r2 = await api('POST', '/api/assistant/parse', { command: '운동 카테고리 만들어' });
  check('parse 카테고리 생성 의도', r1.status === 200);
  check('create_category intent', r2.json?.data?.intent?.type === 'create_category');

  // 실 execute (생성 후 삭제)
  const r3 = await api('POST', '/api/assistant/execute', {
    intent: { type: 'create_category', data: { name: '_e2e_운동', type: 'common' } },
  });
  check('execute create_category', r3.status === 200, r3);
  // cleanup
  await ADMIN.from('categories').delete().eq('user_id', userId).eq('name', '_e2e_운동');
}

// =============================================================================
// 최종 cleanup — 테스트 잔여물 제거
await ADMIN
  .from('categories')
  .delete()
  .eq('user_id', userId)
  .in('name', ['_e2e_test', '_e2e_test_renamed', '_e2e_운동', '식비']);
await ADMIN.from('payment_methods').delete().eq('user_id', userId).in('name', ['_e2e_pm']);
await ADMIN.from('transactions').delete().eq('user_id', userId).ilike('merchant_name', '_e2e%');
await ADMIN.from('budgets').delete().eq('user_id', userId);

console.log(`\n결과: ${pass}/${pass + fail}`);
if (fails.length) {
  console.log('\n실패 상세:');
  for (const f of fails) console.log(' ', JSON.stringify(f).slice(0, 300));
  process.exit(1);
}
