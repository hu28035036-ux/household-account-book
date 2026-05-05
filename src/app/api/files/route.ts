import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listFiles } from '@/services/fileService';
import { fail, ok } from '@/lib/http/response';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const rows = await listFiles(supabase, u.user.id);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
