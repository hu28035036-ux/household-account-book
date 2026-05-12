import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { transferOwner } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

// POST /api/households/[id]/members/[userId]/transfer-owner
// 현재 user 가 owner 일 때 해당 userId 에게 owner 권한을 이전.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const result = await transferOwner(supabase, u.user.id, params.id, params.userId);
    return ok(result);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '위임 실패');
  }
}
