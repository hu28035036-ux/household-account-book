#!/usr/bin/env node
/**
 * RLS 정책 audit:
 * 1. 각 테이블이 RLS 활성화됐는지
 * 2. 정책 목록 (SELECT/INSERT/UPDATE/DELETE)
 * 3. 다른 사용자 row 접근 시도 → 0행 반환 검증
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

const ADMIN = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 사용자 데이터를 다루는 모든 테이블
const TABLES = [
  'profiles',
  'categories',
  'payment_methods',
  'transactions',
  'transaction_candidates',
  'budgets',
  'uploaded_files',
  'ocr_results',
  'ai_extraction_jobs',
  'user_learning_rules',
  'merchant_learning_rules',
  'category_learning_rules',
  'payment_method_learning_rules',
  'analysis_cache',
  'user_correction_logs',
  'notifications',
  'recurring_rules',
  'ai_analysis_history',
  'ai_stats_history',
  'households',
  'household_members',
  'household_invites',
  'allowed_emails',
  'mfa_verifications',
  // banking 테이블 — 0015 미적용이면 SKIP 됨
  'linked_accounts',
  'linked_account_syncs',
];

let pass = 0;
let fail = 0;
const failures = [];

console.log('=== 1. RLS 활성화 상태 ===');
for (const t of TABLES) {
  // 테이블 존재 + RLS 활성 확인 — pg_class.relrowsecurity 직접 못 보고
  // 우회: anon 으로 SELECT 시 row 반환 시도. RLS 없으면 모든 row 가 와버림.
  // service_role 우회 없이 anon role 만으로 요청.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.from(t).select('*').limit(1);
  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01' || error.code === 'PGRST205') {
      console.log(`[SKIP] ${t} (테이블 없음)`);
      continue;
    }
    if (error.code === '42501' || error.message.toLowerCase().includes('permission')) {
      console.log(`[OK]   ${t} → permission denied (RLS 작동)`);
      pass++;
      continue;
    }
    console.log(`[?]    ${t} → 알 수 없는 에러: ${error.message}`);
    failures.push({ table: t, msg: error.message });
    fail++;
  } else {
    // anon 으로 row 가 오면 RLS 가 너무 관대하거나 꺼져있음
    if ((data ?? []).length === 0) {
      console.log(`[OK]   ${t} → anon SELECT 0행 (RLS 또는 빈 테이블)`);
      pass++;
    } else {
      console.log(`[FAIL] ${t} → anon 으로 ${data.length}행 반환됨 ⚠ RLS 누락 가능`);
      failures.push({ table: t, leaked_rows: data.length });
      fail++;
    }
  }
}

console.log('\n=== 2. 사용자 격리 — 다른 user_id 데이터 접근 시도 ===');
{
  // 두 사용자 만들어서 A 의 토큰으로 B 의 data 조회 시도
  const emailA = 'rls-test-A@example.com';
  const emailB = 'rls-test-B@example.com';

  async function ensureUser(email) {
    const { data: list } = await ADMIN.auth.admin.listUsers({ page: 1, perPage: 200 });
    const ex = list.users.find((u) => u.email === email);
    if (ex) return ex;
    const { data } = await ADMIN.auth.admin.createUser({ email, email_confirm: true });
    return data.user;
  }
  const userA = await ensureUser(emailA);
  const userB = await ensureUser(emailB);

  // service_role 로 B 의 거래 1건 시드
  const { data: txB } = await ADMIN
    .from('transactions')
    .insert({
      user_id: userB.id,
      transaction_date: new Date().toISOString().slice(0, 10),
      type: 'expense',
      amount: 9999,
      merchant_name: '_rls_secret',
      source_type: 'manual',
      is_confirmed: true,
    })
    .select('id')
    .single();
  if (!txB) {
    console.log('[ERR] 시드 실패');
    fail++;
  } else {
    // A 의 토큰으로 anon 클라이언트
    const { data: link } = await ADMIN.auth.admin.generateLink({
      type: 'magiclink',
      email: emailA,
    });
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    const { data: sess } = await anon.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink',
    });
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
        global: { headers: { authorization: `Bearer ${sess.session.access_token}` } },
      },
    );

    // [a] B 의 거래 SELECT — 0행이어야 정상
    const { data: read } = await userClient
      .from('transactions')
      .select('id, merchant_name')
      .eq('id', txB.id);
    if ((read ?? []).length === 0) {
      console.log('[OK]   A 가 B 의 거래 SELECT → 0행');
      pass++;
    } else {
      console.log('[FAIL] A 가 B 의 거래 노출됨 ⚠');
      failures.push({ check: 'cross-user SELECT', leaked: read });
      fail++;
    }

    // [b] B 의 거래 UPDATE — 0행 영향
    const { data: upd } = await userClient
      .from('transactions')
      .update({ amount: 1 })
      .eq('id', txB.id)
      .select('id');
    if ((upd ?? []).length === 0) {
      console.log('[OK]   A 가 B 의 거래 UPDATE → 0행');
      pass++;
    } else {
      console.log('[FAIL] A 가 B 의 거래 변조 ⚠');
      failures.push({ check: 'cross-user UPDATE', leaked: upd });
      fail++;
    }

    // [c] B 의 거래 DELETE — 0행 영향
    const { data: del } = await userClient
      .from('transactions')
      .delete()
      .eq('id', txB.id)
      .select('id');
    if ((del ?? []).length === 0) {
      console.log('[OK]   A 가 B 의 거래 DELETE → 0행');
      pass++;
    } else {
      console.log('[FAIL] A 가 B 의 거래 삭제 ⚠');
      failures.push({ check: 'cross-user DELETE', leaked: del });
      fail++;
    }

    // [d] DB 에 B 의 거래 그대로 남아있는지 확인 (admin 으로)
    const { data: stillThere } = await ADMIN
      .from('transactions')
      .select('id, amount')
      .eq('id', txB.id)
      .maybeSingle();
    if (stillThere && stillThere.amount === 9999) {
      console.log('[OK]   B 의 원본 거래 그대로 (변조/삭제 안 됨)');
      pass++;
    } else {
      console.log('[FAIL] B 의 거래가 변경되거나 사라짐 ⚠', stillThere);
      failures.push({ check: 'B data integrity', got: stillThere });
      fail++;
    }

    // cleanup
    await ADMIN.from('transactions').delete().eq('id', txB.id);
  }
}

console.log(`\n결과: ${pass}/${pass + fail}`);
if (failures.length) {
  console.log('\n실패 상세:');
  for (const f of failures) console.log(' ', JSON.stringify(f).slice(0, 200));
  process.exit(1);
}
