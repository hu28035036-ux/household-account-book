import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkBudgetAlertsForUser } from '@/lib/budgets/alertCheck';
import { fail, ok } from '@/lib/http/response';

/**
 * 사용자가 직접 트리거하는 예산 알림 체크.
 * 거래 추가/승인 시 자동 호출되지만, 강제 재계산 용도.
 */
export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const result = await checkBudgetAlertsForUser(supabase, u.user.id);
    return ok(result);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '실패');
  }
}
