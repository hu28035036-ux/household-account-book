import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAiAnalyticsSummary, getMonthlySeries, getRecurringCandidates } from '@/services/analyticsService';
import { fail, ok } from '@/lib/http/response';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const [series, recurring, ai] = await Promise.all([
      getMonthlySeries(supabase, u.user.id, 6),
      getRecurringCandidates(supabase, u.user.id, 3),
      getAiAnalyticsSummary(supabase, u.user.id),
    ]);
    return ok({ series, recurring, ai });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
