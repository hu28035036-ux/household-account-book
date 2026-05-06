import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { runExtractionForFile } from '@/services/extractionService';
import { fail, ok } from '@/lib/http/response';
import { LLMUnavailableError } from '@/lib/ai/llmRouter';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const result = await runExtractionForFile(supabase, u.user.id, params.fileId);
    return ok(result, { status: 201 });
  } catch (e) {
    if (e instanceof LLMUnavailableError) {
      return fail('AI_UNAVAILABLE', `AI 서버 연결 실패: ${e.message}`);
    }
    return fail('INTERNAL', e instanceof Error ? e.message : '분석 실패');
  }
}
