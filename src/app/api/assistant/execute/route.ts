import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Intent } from '@/lib/ai/assistantSchema';
import { executeIntent } from '@/services/assistantService';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  let intent: ReturnType<typeof Intent.parse>;
  try {
    intent = Intent.parse((await req.json())?.intent);
  } catch (e) {
    return fail('BAD_REQUEST', '의도(Intent) 형식이 올바르지 않습니다.', e);
  }

  const householdId = cookies().get('active_household_id')?.value || null;

  try {
    const result = await executeIntent(supabase, user.id, householdId, intent);
    if (!result.ok) return fail('BAD_REQUEST', result.error);
    return ok(result);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '실행 실패');
  }
}
