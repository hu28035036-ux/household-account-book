#!/usr/bin/env node
/**
 * 형님 계정의 profiles 행 상태 직접 확인.
 * + RLS 정책으로 INSERT/UPDATE 가 막히는지 검사.
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

const ADMIN_EMAIL = 'hu28035036@gmail.com';

console.log('=== 운영자 계정 상태 ===');
const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const me = users.users.find((u) => u.email === ADMIN_EMAIL);
if (!me) {
  console.error('운영자 계정 없음');
  process.exit(1);
}
console.log('user_id:', me.id);
console.log('email:', me.email);
console.log('created_at:', me.created_at);

console.log('\n=== profiles 행 ===');
const { data: profile, error: pe } = await admin
  .from('profiles')
  .select('*')
  .eq('user_id', me.id)
  .maybeSingle();
if (pe) {
  console.log('SELECT 에러:', pe.message);
} else if (!profile) {
  console.log('!!! profiles row 없음 — INSERT 분기로 가야 함');
} else {
  console.log('profile:', JSON.stringify(profile, null, 2));
  console.log('privacy_consent_at:', profile.privacy_consent_at ?? '(NULL)');
  console.log('privacy_consent_version:', profile.privacy_consent_version ?? '(NULL)');
}

console.log('\n=== profiles RLS 정책 확인 ===');
const { data: policies, error: rlsErr } = await admin
  .rpc('pg_policies_for_table', { p_schema: 'public', p_table: 'profiles' })
  .catch(() => ({ data: null, error: { message: 'RPC 없음' } }));
if (rlsErr) {
  // RPC 가 없을 수 있음 — 직접 쿼리로
  const { data: pol2 } = await admin
    .from('pg_policies')
    .select('*')
    .eq('schemaname', 'public')
    .eq('tablename', 'profiles');
  if (pol2) {
    pol2.forEach((p) => console.log(`- ${p.policyname} [${p.cmd}]: ${p.qual}`));
  } else {
    console.log('(RLS 정책 직접 조회 불가 — Supabase 대시보드에서 확인 필요)');
  }
}

console.log('\n=== 동의 시뮬레이션 (서비스 role) ===');
const now = new Date().toISOString();
if (!profile) {
  const { error: insErr } = await admin
    .from('profiles')
    .insert({ user_id: me.id, privacy_consent_at: now, privacy_consent_version: 'v1' });
  console.log('INSERT 결과:', insErr?.message ?? 'OK');
} else {
  const { error: updErr } = await admin
    .from('profiles')
    .update({ privacy_consent_at: now, privacy_consent_version: 'v1' })
    .eq('user_id', me.id);
  console.log('UPDATE 결과:', updErr?.message ?? 'OK');
}

const { data: after } = await admin
  .from('profiles')
  .select('privacy_consent_at, privacy_consent_version')
  .eq('user_id', me.id)
  .single();
console.log('확인 (시뮬 후):', after);
