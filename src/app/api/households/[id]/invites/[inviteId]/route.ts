import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revokeInvite } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; inviteId: string } },
) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    await revokeInvite(supabase, params.id, params.inviteId);
    return ok({ id: params.inviteId });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '삭제 실패');
  }
}
