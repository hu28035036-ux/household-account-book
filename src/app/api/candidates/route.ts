import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listCandidates } from '@/services/candidateService';
import { fail, ok } from '@/lib/http/response';

const QuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
});

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const url = new URL(req.url);
    const q = QuerySchema.parse({ status: url.searchParams.get('status') ?? undefined });
    const rows = await listCandidates(supabase, u.user.id, q.status);
    return ok(rows);
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
