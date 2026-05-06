import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rejectBulk } from '@/services/candidateService';
import { fail, ok } from '@/lib/http/response';

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const { ids } = Body.parse(await req.json());
    const result = await rejectBulk(supabase, u.user.id, ids);
    return ok({
      requested: ids.length,
      rejected: result.rejectedIds.length,
      rejectedIds: result.rejectedIds,
    });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
