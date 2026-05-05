import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createInvite, listInvites } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const rows = await listInvites(supabase, params.id);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const row = await createInvite(supabase, u.user.id, params.id);
    return ok(row, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '초대 생성 실패');
  }
}
