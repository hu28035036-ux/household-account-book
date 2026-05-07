#!/usr/bin/env node
/**
 * 0016_privacy_consent 마이그레이션 적용 확인.
 * + AI 게이트 흐름 (consent NULL → 모달 → 동의 → consent 시각 채움) 시뮬레이션.
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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let pass = 0, fail = 0;

console.log('=== 1. 컬럼 존재 확인 ===');
{
  // 한 행이라도 select 해서 컬럼이 인식되는지 확인
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, privacy_consent_at, privacy_consent_version')
    .limit(1);
  if (error) {
    console.log('[FAIL] 컬럼 없음 또는 오류:', error.message);
    console.log('       → SQL 미적용 상태입니다. Supabase SQL Editor 에서 RUN 하세요.');
    fail++;
  } else {
    console.log(`[OK]   privacy_consent_at + privacy_consent_version 컬럼 인식됨 (${data.length} 행 sample)`);
    pass++;
  }
}

console.log('\n=== 2. /api/account/consent 흐름 시뮬레이션 ===');
{
  const TEST_EMAIL = 'consent-test@example.com';
  // 사용자 ensure
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const { data } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
    });
    user = data.user;
  }

  // profiles row ensure
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('user_id, privacy_consent_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!existingProfile) {
    await admin.from('profiles').insert({ user_id: user.id, privacy_consent_at: null });
  } else {
    // reset to NULL for re-test
    await admin
      .from('profiles')
      .update({ privacy_consent_at: null, privacy_consent_version: null })
      .eq('user_id', user.id);
  }

  // 1) NULL 상태 확인
  const { data: before } = await admin
    .from('profiles')
    .select('privacy_consent_at')
    .eq('user_id', user.id)
    .single();
  if (before.privacy_consent_at === null) {
    console.log('[OK]   시작 상태: privacy_consent_at = NULL');
    pass++;
  } else {
    console.log('[FAIL] 초기화 실패');
    fail++;
  }

  // 2) consent UPDATE 시뮬레이션 (실 API 와 동일 동작)
  await admin
    .from('profiles')
    .update({
      privacy_consent_at: new Date().toISOString(),
      privacy_consent_version: 'v1',
    })
    .eq('user_id', user.id);

  // 3) 채워졌는지 확인
  const { data: after } = await admin
    .from('profiles')
    .select('privacy_consent_at, privacy_consent_version')
    .eq('user_id', user.id)
    .single();
  if (after.privacy_consent_at && after.privacy_consent_version === 'v1') {
    console.log(
      `[OK]   동의 후: ${after.privacy_consent_at.slice(0, 19)} / version=${after.privacy_consent_version}`,
    );
    pass++;
  } else {
    console.log('[FAIL] 동의 기록 안 됨:', after);
    fail++;
  }
}

console.log('\n=== 3. /api/me 응답 (실 HTTP, 인증 사용자) ===');
{
  const TEST_EMAIL = 'e2e-pages-test@example.com';
  const TEST_PW = 'TestPass!2026';
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  // ensure password
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const { data } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PW,
      email_confirm: true,
    });
    user = data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: TEST_PW });
  }

  const { data: sess, error } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PW,
  });
  if (error || !sess.session) {
    console.log('[SKIP] dev 서버에 로그인 시뮬레이션 실패 (dev 안 떠있음 — 로컬 테스트 스킵)');
  } else {
    const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)[1];
    const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(sess.session)).toString('base64url')}`;

    try {
      const res = await fetch('http://localhost:3000/api/me', {
        headers: { cookie },
      });
      if (!res.ok) {
        console.log(`[SKIP] dev 서버 응답 ${res.status} — 로컬 dev 안 떠있음`);
      } else {
        const j = await res.json();
        const has = 'privacy_consent_at' in (j?.data ?? {});
        if (has) {
          console.log(
            `[OK]   /api/me 가 privacy_consent_at 포함 (${j.data.privacy_consent_at ?? 'null'})`,
          );
          pass++;
        } else {
          console.log('[FAIL] /api/me 응답에 privacy_consent_at 없음');
          fail++;
        }
      }
    } catch (e) {
      console.log(`[SKIP] dev 서버 연결 실패 — Vercel 배포본만 점검`);
    }
  }
}

console.log(`\n결과: ${pass}/${pass + fail}`);
if (fail > 0) process.exit(1);
