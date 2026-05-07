import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok } from '@/lib/http/response';

const PatchInput = z.object({
  raw_pattern: z.string().max(200).optional(),
  normalized_pattern: z.string().max(200).optional(),
  category_id: z.string().uuid().nullable().optional(),
  payment_method_id: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const patch = PatchInput.parse(await req.json());
    const { data, error } = await supabase
      .from('user_learning_rules')
      .update(patch)
      .eq('user_id', u.user.id)
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) throw error;
    return ok(data);
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
    const { error } = await supabase
      .from('user_learning_rules')
      .delete()
      .eq('user_id', u.user.id)
      .eq('id', params.id);
    if (error) return fail('INTERNAL', error.message);
    return ok({ id: params.id });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '학습 규칙 삭제 실패');
  }
}
