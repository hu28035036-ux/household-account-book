import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { removeMember } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    await removeMember(supabase, u.user.id, params.id, params.userId);
    return ok({ removed: params.userId });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '삭제 실패');
  }
}
