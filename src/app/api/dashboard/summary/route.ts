import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDashboardSummary } from '@/services/dashboardService';
import { fail, ok } from '@/lib/http/response';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const url = new URL(req.url);
    const ym = url.searchParams.get('ym') ?? undefined;
    const summary = await getDashboardSummary(supabase, u.user.id, ym ?? undefined);
    return ok(summary);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '조회 실패');
  }
}
