import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveProvider } from '@/lib/banking/providers';
import { persistLinkedAccount } from '@/services/linkedAccountService';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

const Body = z.object({
  sessionToken: z.string().min(1),
  verificationCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return fail('BAD_REQUEST', '요청 형식이 올바르지 않습니다.', e);
  }

  const householdId = cookies().get('active_household_id')?.value || null;
  const provider = getActiveProvider();

  try {
    const result = await provider.completeLink({
      sessionToken: body.sessionToken,
      verificationCode: body.verificationCode,
    });
    const account = await persistLinkedAccount(supabase, user.id, householdId, {
      provider: provider.id,
      providerAccountId: result.providerAccountId,
      bankCode: result.bankCode,
      bankName: result.bankName,
      accountType: result.accountType,
      accountNumberMasked: result.accountNumberMasked,
      holderName: result.holderName,
      balance: result.balance,
      plaintextCredentials: result.credentials,
    });
    return ok({ account });
  } catch (e) {
    const msg = e instanceof Error ? (e as { userMessage?: string }).userMessage ?? e.message : '연동 실패';
    return fail('INTERNAL', msg);
  }
}
