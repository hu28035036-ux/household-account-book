import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateCandidate } from '@/services/candidateService';
import { fail, ok } from '@/lib/http/response';

const PatchSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: z.number().int().nullable().optional(),
  merchant_name: z.string().max(200).nullable().optional(),
  description: z.string().max(500).optional(),
  category_suggestion: z.string().max(80).nullable().optional(),
  payment_method_suggestion: z.string().max(80).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const patch = PatchSchema.parse(await req.json());
    const row = await updateCandidate(supabase, u.user.id, params.id, patch);
    return ok(row);
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
