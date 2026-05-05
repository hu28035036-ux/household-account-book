import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createHousehold, listMyHouseholds } from '@/services/householdService';
import { fail, ok } from '@/lib/http/response';

const Body = z.object({ name: z.string().min(1).max(40) });

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const rows = await listMyHouseholds(supabase, u.user.id);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const input = Body.parse(await req.json());
    const row = await createHousehold(supabase, u.user.id, input.name);
    return ok(row, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
