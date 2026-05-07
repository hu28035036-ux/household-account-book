#!/usr/bin/env node
/**
 * UI 가 사용하는 API 응답 형태 검증.
 * - GET /api/categories: { data: [{ id, name, type, ... }] } 기대
 * - GET /api/payment-methods: { data: [{ id, name, type, ... }] }
 * - POST /api/assistant/parse: { data: { intent: ... } }
 * - POST /api/assistant/execute: { data: { ok, kind, message, ... } }
 *
 * 인증 우회: service role 로 행을 직접 SELECT 해서 그 형태가 UI 기대와 같은지 확인
 * (실제 HTTP 호출은 401 로 막혀있어 단위 검증 어려움 — 대신 underlying 서비스 호출).
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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TEST_EMAIL = 'e2e-assistant-test@example.com';
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const user = list.users.find((u) => u.email === TEST_EMAIL);
if (!user) {
  console.error('테스트 사용자 없음 — test-assistant-e2e.mjs 먼저 실행');
  process.exit(2);
}
const userId = user.id;

let pass = 0,
  fail = 0;

console.log('=== /api/categories 응답 형태 ===');
{
  const { data, error } = await admin
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.log(`[ERR] categories — ${error.message}`);
    fail++;
  } else {
    const c = (data ?? [])[0];
    if (c && c.id && c.name && ['income', 'expense', 'common'].includes(c.type)) {
      console.log(`[OK]  shape OK — ${data.length}건 / 첫 행: id=${c.id.slice(0, 8)}… name="${c.name}" type=${c.type}`);
      pass++;
    } else {
      console.log(`[FAIL] shape mismatch: ${JSON.stringify(c)}`);
      fail++;
    }
  }
}

console.log('\n=== /api/payment-methods 응답 형태 ===');
{
  // 결제수단이 아직 없을 수 있어 시드 1개 만들고 확인
  try {
    await admin
      .from('payment_methods')
      .insert({ user_id: userId, name: '_test_pm', type: 'card', is_default: false });
  } catch {
    // 이미 있어도 ok
  }
  const { data, error } = await admin
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.log(`[ERR] payment_methods — ${error.message}`);
    fail++;
  } else {
    const p = (data ?? []).find((x) => x.name === '_test_pm');
    if (p && p.id && p.name && ['card', 'bank', 'cash', 'pay', 'other'].includes(p.type)) {
      console.log(`[OK]  shape OK — ${data.length}건 / 시드 행: id=${p.id.slice(0, 8)}… name="${p.name}" type=${p.type}`);
      pass++;
    } else {
      console.log(`[FAIL] shape mismatch: ${JSON.stringify(p)}`);
      fail++;
    }
  }
  // 정리
  await admin.from('payment_methods').delete().eq('user_id', userId).eq('name', '_test_pm');
}

console.log('\n=== 401 인증 가드 (실 HTTP 호출, 비로그인) ===');
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
async function probe(path, body) {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

const probes = [
  { path: '/api/categories' },
  { path: '/api/payment-methods' },
  { path: '/api/assistant/parse', body: { command: '스벅 5천' } },
  {
    path: '/api/assistant/execute',
    body: { intent: { type: 'navigate', data: { destination: 'stats' } } },
  },
];

for (const p of probes) {
  const r = await probe(p.path, p.body);
  if (r.status === 0) {
    console.log(`[SKIP] ${p.path} — dev server not running (${r.error})`);
  } else if (r.status === 401) {
    console.log(`[OK]   ${p.path} → 401 (인증 가드 작동)`);
    pass++;
  } else {
    console.log(`[FAIL] ${p.path} → ${r.status} (예상: 401) ${JSON.stringify(r.json).slice(0, 100)}`);
    fail++;
  }
}

console.log(`\n결과: ${pass}/${pass + fail}`);
if (fail > 0) process.exit(1);
