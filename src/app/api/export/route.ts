import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail } from '@/lib/http/response';

/**
 * 본인 데이터 전체 내보내기 (JSON).
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  const userId = u.user.id;
  const tables = [
    'profiles',
    'categories',
    'payment_methods',
    'transactions',
    'transaction_candidates',
    'uploaded_files',
    'ocr_results',
    'ai_extraction_jobs',
    'user_learning_rules',
    'merchant_learning_rules',
    'category_learning_rules',
    'payment_method_learning_rules',
    'analysis_cache',
    'user_correction_logs',
  ] as const;

  const dump: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user: { id: userId, email: u.user.email },
  };

  for (const t of tables) {
    const { data } = await supabase.from(t).select('*').eq('user_id', userId);
    dump[t] = data ?? [];
  }

  const body = JSON.stringify(dump, null, 2);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="ledger-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
