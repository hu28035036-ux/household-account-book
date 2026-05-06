import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { importCandidates } from '@/services/importService';
import { fail, ok } from '@/lib/http/response';

const Candidate = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int().nullable(),
  merchant_name: z.string().max(200).nullable(),
  description: z.string().max(500).default(''),
  payment_method_suggestion: z.string().max(80).nullable(),
  category_suggestion: z.string().max(80).nullable(),
  raw_text_basis: z.string().max(500).default(''),
  warnings: z.array(z.string()).default([]),
});

const Body = z.object({
  candidates: z.array(Candidate).min(1).max(2000),
  useLlmFallback: z.boolean().optional().default(false),
});

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const body = Body.parse(await req.json());
    const result = await importCandidates(supabase, u.user.id, body.candidates, {
      useLlmFallback: body.useLlmFallback,
    });
    return ok(result, { status: 201 });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
