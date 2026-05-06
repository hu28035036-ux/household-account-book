import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { banUser, unbanUser, deleteUserHard } from '@/services/adminService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const Patch = z.object({ action: z.enum(['ban', 'unban']) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  if (!isAdminEmail(u.user.email)) return fail('FORBIDDEN', '관리자만 접근 가능합니다.');
  try {
    const { action } = Patch.parse(await req.json());
    const admin = createSupabaseAdminClient();
    if (action === 'ban') await banUser(admin, params.id);
    else await unbanUser(admin, params.id);
    return ok({ id: params.id, action });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  if (!isAdminEmail(u.user.email)) return fail('FORBIDDEN', '관리자만 접근 가능합니다.');
  // 본인 계정 자체 삭제 방지
  if (params.id === u.user.id) return fail('BAD_REQUEST', '본인 계정은 /api/account에서 삭제하세요.');

  // 본문 confirmation
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  if (body?.confirm !== 'DELETE') return fail('BAD_REQUEST', '본문에 { confirm: "DELETE" } 필요');

  try {
    const admin = createSupabaseAdminClient();
    await deleteUserHard(admin, params.id);
    return ok({ deleted: params.id });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '삭제 실패');
  }
}
