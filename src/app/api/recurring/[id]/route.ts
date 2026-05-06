import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  deleteRecurringRule,
  updateRecurringRule,
} from '@/services/recurringService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const PatchBody = z.object({
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: z.number().int().min(0).optional(),
  merchant_name: z.string().max(120).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  payment_method_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  month_of_year: z.number().int().min(1).max(12).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  active: z.boolean().optional(),
  auto_post: z.boolean().optional(),
  notify_days_before: z.number().int().min(0).max(30).optional(),
  memo: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const input = PatchBody.parse(await req.json());
    const row = await updateRecurringRule(supabase, u.user.id, params.id, input);
    return ok(row);
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    await deleteRecurringRule(supabase, u.user.id, params.id);
    return ok({ id: params.id });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '삭제 실패');
  }
}
