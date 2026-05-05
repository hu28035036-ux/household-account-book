import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rejectCandidate } from '@/services/candidateService';
import { fail, ok } from '@/lib/http/response';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const row = await rejectCandidate(supabase, u.user.id, params.id);
    return ok(row);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '제외 실패');
  }
}
