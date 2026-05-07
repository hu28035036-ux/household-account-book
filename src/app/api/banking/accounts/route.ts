import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listLinkedAccounts } from '@/services/linkedAccountService';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  const householdId = cookies().get('active_household_id')?.value || null;

  try {
    const items = await listLinkedAccounts(supabase, user.id, householdId);
    return ok({ items });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
