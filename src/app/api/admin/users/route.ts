import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { listUsers } from '@/services/adminService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  if (!isAdminEmail(u.user.email)) return fail('FORBIDDEN', '관리자만 접근 가능합니다.');
  try {
    const admin = createSupabaseAdminClient();
    const rows = await listUsers(admin);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
