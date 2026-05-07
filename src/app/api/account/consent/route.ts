import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

const Body = z.object({
  type: z.literal('privacy'),
  version: z.string().max(40).default('v1'),
});

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return fail('BAD_REQUEST', '입력이 올바르지 않습니다.', e);
  }

  const now = new Date().toISOString();

  // 먼저 row 존재 확인 → 없으면 INSERT, 있으면 UPDATE
  // (UPSERT 는 unique constraint user_id 를 활용하지만, profiles 의 PK 는 id 라
  //  on_conflict 를 user_id 로 명시해야 함. 안전하게 select-after-decide.)
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', u.user.id)
    .maybeSingle();

  let error;
  if (existing) {
    const r = await supabase
      .from('profiles')
      .update({
        privacy_consent_at: now,
        privacy_consent_version: body.version,
      })
      .eq('user_id', u.user.id);
    error = r.error;
  } else {
    // 예전 사용자라 profiles row 자체가 없는 경우 — 생성
    const r = await supabase.from('profiles').insert({
      user_id: u.user.id,
      privacy_consent_at: now,
      privacy_consent_version: body.version,
    });
    error = r.error;
  }

  if (error) {
    // 컬럼 부재 시 의미있는 에러
    if (
      error.code === '42703' || // undefined_column
      (error.message ?? '').includes('privacy_consent_at')
    ) {
      return fail(
        'INTERNAL',
        '동의 기록 컬럼이 아직 적용되지 않았습니다. 운영자에게 문의하세요.',
      );
    }
    return fail('INTERNAL', error.message);
  }

  return ok({ ok: true, type: body.type, version: body.version, consented_at: now });
}
