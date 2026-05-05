import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { joinByInviteCode } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

const Body = z.object({ code: z.string().min(4).max(40) });

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const { code } = Body.parse(await req.json());
    const row = await joinByInviteCode(supabase, u.user.id, code);
    return ok(row);
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
