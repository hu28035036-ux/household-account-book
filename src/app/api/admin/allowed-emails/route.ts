import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { addAllowedEmail, listAllowedEmails } from '@/services/adminService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email().max(254),
  note: z.string().max(200).nullable().optional(),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  if (!isAdminEmail(u.user.email)) return fail('FORBIDDEN', '관리자만 접근 가능합니다.');
  try {
    const admin = createSupabaseAdminClient();
    const rows = await listAllowedEmails(admin);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  if (!isAdminEmail(u.user.email)) return fail('FORBIDDEN', '관리자만 접근 가능합니다.');
  try {
    const input = Body.parse(await req.json());
    const admin = createSupabaseAdminClient();
    const row = await addAllowedEmail(admin, input.email, input.note ?? null, u.user.id);
    return ok(row, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
