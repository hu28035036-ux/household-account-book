import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Username } from '@/lib/validators/auth';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const u = url.searchParams.get('u') ?? '';
    const parsed = Username.safeParse(u);
    if (!parsed.success) {
      return ok({ available: false, reason: parsed.error.issues[0]?.message ?? '형식 오류' });
    }
    const admin = createSupabaseAdminClient();
    const { count, error } = await admin
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .ilike('username', parsed.data);
    if (error) return fail('INTERNAL', error.message);
    return ok({ available: (count ?? 0) === 0 });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '아이디 확인 실패');
  }
}
