import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { deleteNotification } from '@/services/notificationService';
import { fail, ok } from '@/lib/http/response';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    await deleteNotification(supabase, u.user.id, params.id);
    return ok({ id: params.id });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '실패');
  }
}
