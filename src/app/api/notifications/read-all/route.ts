import { createSupabaseServerClient } from '@/lib/supabase/server';
import { markAllRead } from '@/services/notificationService';
import { fail, ok } from '@/lib/http/response';

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    await markAllRead(supabase, u.user.id);
    return ok({ read: 'all' });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '실패');
  }
}
