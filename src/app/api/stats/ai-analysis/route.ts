import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  runStatsAiAnalysis,
  saveStatsAiAnalysis,
  listStatsAiHistory,
} from '@/services/statsAiService';
import { fail, ok } from '@/lib/http/response';
import { LLMUnavailableError } from '@/lib/ai/llmRouter';
import { getActiveHouseholdContext } from '@/lib/auth/getActiveHouseholdContext';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const { from, to } = Body.parse(await req.json());
    if (from > to) return fail('BAD_REQUEST', '시작일이 종료일보다 늦을 수 없습니다.');
    const ctx = getActiveHouseholdContext();
    const result = await runStatsAiAnalysis(supabase, u.user.id, from, to, ctx);
    // 분석 결과를 자동 저장 (페이지 이동·재진입 후에도 보이도록)
    let savedId: string | null = null;
    if (result.transaction_count > 0) {
      try {
        const saved = await saveStatsAiAnalysis(supabase, u.user.id, ctx, result);
        savedId = saved.id;
      } catch {
        // 저장 실패해도 분석 결과 자체는 응답으로 돌려줌
      }
    }
    return ok({ ...result, id: savedId });
  } catch (e) {
    if (e instanceof LLMUnavailableError) {
      return fail('AI_UNAVAILABLE', `AI 서버 연결 실패: ${e.message}`);
    }
    return fail('INTERNAL', e instanceof Error ? e.message : 'AI 분석 실패');
  }
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
    const ctx = getActiveHouseholdContext();
    const rows = await listStatsAiHistory(supabase, u.user.id, ctx, limit);
    return ok(rows);
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '이력 조회 실패');
  }
}
