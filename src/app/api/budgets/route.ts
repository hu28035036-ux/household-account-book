import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listBudgets, upsertBudget } from '@/services/budgetService';
import { fail, ok } from '@/lib/http/response';
import { getActiveHouseholdContext } from '@/lib/auth/getActiveHouseholdContext';

const Body = z.object({
  category_id: z.string().uuid().nullable(),
  year_month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().int().min(0),
  alert_threshold: z.number().min(0).max(1).optional(),
  memo: z.string().max(200).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const url = new URL(req.url);
    const ym = url.searchParams.get('ym') ?? undefined;
    const ctx = getActiveHouseholdContext();
    const rows = await listBudgets(supabase, u.user.id, ym ?? undefined, ctx);
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
    const ctx = getActiveHouseholdContext();
    const row = await upsertBudget(supabase, u.user.id, input, ctx);
    return ok(row, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
