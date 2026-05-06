import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createRecurringRule,
  listRecurringRules,
} from '@/services/recurringService';
import { fail, ok } from '@/lib/http/response';
import { getActiveHouseholdContext } from '@/lib/auth/getActiveHouseholdContext';

export const runtime = 'nodejs';

const Body = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int().min(0),
  merchant_name: z.string().max(120).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  payment_method_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  month_of_year: z.number().int().min(1).max(12).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  active: z.boolean().optional(),
  auto_post: z.boolean().optional(),
  notify_days_before: z.number().int().min(0).max(30).optional(),
  memo: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const ctx = getActiveHouseholdContext();
    const rows = await listRecurringRules(supabase, u.user.id, ctx);
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
    const row = await createRecurringRule(supabase, u.user.id, ctx, input);
    return ok(row, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
