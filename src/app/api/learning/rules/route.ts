import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok } from '@/lib/http/response';

const RuleType = z.enum(['merchant', 'category', 'payment_method', 'recurring', 'keyword']);

const CreateInput = z.object({
  rule_type: RuleType,
  raw_pattern: z.string().max(200).optional(),
  normalized_pattern: z.string().min(1).max(200),
  category_id: z.string().uuid().nullable().optional(),
  payment_method_id: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  const { data, error } = await supabase
    .from('user_learning_rules')
    .select('*')
    .eq('user_id', u.user.id)
    .order('match_count', { ascending: false })
    .limit(200);
  if (error) return fail('INTERNAL', error.message);
  return ok(data);
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const input = CreateInput.parse(await req.json());
    const { data, error } = await supabase
      .from('user_learning_rules')
      .insert({ user_id: u.user.id, ...input })
      .select('*')
      .single();
    if (error) throw error;
    return ok(data, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
