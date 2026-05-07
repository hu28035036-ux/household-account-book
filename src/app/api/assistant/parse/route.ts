import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildAssistantContext, parseUserCommand } from '@/services/assistantService';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

const Body = z.object({
  command: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return fail('BAD_REQUEST', '입력이 올바르지 않습니다.', e);
  }

  try {
    const ctx = await buildAssistantContext(supabase, user.id);
    const intent = await parseUserCommand(body.command, ctx);
    return ok({ intent });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '분석 실패');
  }
}
