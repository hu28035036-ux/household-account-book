import { BANKS } from '@/lib/banking/banks';
import { getActiveProvider } from '@/lib/banking/providers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ok, fail } from '@/lib/http/response';

export async function GET() {
  // 인증 가드 — 비로그인은 차단 (banking 활성화 시 사용자별 정보가 노출되지 않게)
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  const provider = getActiveProvider();
  const supported = new Set(provider.supportedBankCodes());
  const list = BANKS.map((b) => ({
    code: b.code,
    name: b.name,
    kind: b.kind,
    easyAuth: !!b.easyAuth,
    // mock 은 supports 가 모두 → 전체 활성. codef 가 비어있으면 전체 비활성.
    supported: supported.size === 0 ? false : supported.has(b.code),
  }));
  return ok({ providerId: provider.id, banks: list });
}

export const dynamic = 'force-dynamic';
