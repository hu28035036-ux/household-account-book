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
    // PostgrestError 는 Error 인스턴스가 아니어도 { message, code } 를 가짐
    const err = e as { message?: string; code?: string } | undefined;
    const msg = err?.message ?? (e instanceof Error ? e.message : '조회 실패');
    // linked_accounts 테이블이 아직 마이그레이션 적용 안 됐을 수 있음 (banking 보류 상태)
    const tableMissing =
      err?.code === '42P01' || // PG: undefined_table
      err?.code === 'PGRST205' || // PostgREST: schema cache miss
      (typeof msg === 'string' &&
        msg.includes('linked_accounts') &&
        (msg.includes('does not exist') ||
          msg.includes('schema cache') ||
          msg.toLowerCase().includes('relation')));
    if (tableMissing) {
      return ok({ items: [], _note: 'banking 미설치' });
    }
    return fail('INTERNAL', msg);
  }
}
