import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { removeAllowedEmail } from '@/services/adminService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  if (!isAdminEmail(u.user.email)) return fail('FORBIDDEN', '관리자만 접근 가능합니다.');
  try {
    const admin = createSupabaseAdminClient();
    await removeAllowedEmail(admin, params.id);
    return ok({ id: params.id });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '삭제 실패');
  }
}
