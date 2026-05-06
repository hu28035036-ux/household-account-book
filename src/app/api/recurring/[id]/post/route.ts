import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { postRuleOccurrence } from '@/services/recurringService';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const Body = z
  .object({
    occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

/**
 * 사용자가 룰을 수동 등록 — 거래 1건 생성 + next_run_date 갱신.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const body = req.headers.get('content-length') === '0' ? undefined : await req.json();
    const parsed = Body.parse(body);
    const { data: rule, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', u.user.id)
      .single();
    if (error || !rule) return fail('NOT_FOUND', '규칙을 찾을 수 없습니다.');
    const result = await postRuleOccurrence(supabase, rule as any, parsed?.occurrence_date);
    return ok(result, { status: 201 });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '등록 실패');
  }
}
