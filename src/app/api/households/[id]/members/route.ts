import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listMembers } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const rows = await listMembers(supabase, params.id);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
