import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { syncLinkedAccount } from '@/services/linkedAccountService';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

const Body = z
  .object({
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  let parsed: z.infer<typeof Body> = undefined;
  try {
    const json = await req.json().catch(() => ({}));
    parsed = Body.parse(json);
  } catch (e) {
    return fail('BAD_REQUEST', '요청 형식이 올바르지 않습니다.', e);
  }

  try {
    const result = await syncLinkedAccount(supabase, user.id, ctx.params.id, parsed);
    return ok(result);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '동기화 실패');
  }
}
