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

  // privacy_consent_at = now(), version = body.version
  const { error } = await supabase
    .from('profiles')
    .update({
      privacy_consent_at: new Date().toISOString(),
      privacy_consent_version: body.version,
    })
    .eq('user_id', u.user.id);

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

  return ok({ ok: true, type: body.type, version: body.version });
}
