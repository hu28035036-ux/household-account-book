import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { unlinkAccount } from '@/services/linkedAccountService';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  try {
    await unlinkAccount(supabase, user.id, ctx.params.id);
    return ok({ ok: true });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '해제 실패');
  }
}
