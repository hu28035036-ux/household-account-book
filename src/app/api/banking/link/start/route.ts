import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveProvider } from '@/lib/banking/providers';
import { persistLinkedAccount } from '@/services/linkedAccountService';
import type { AuthMethod } from '@/lib/banking/types';
import { ok, fail } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

const Body = z.object({
  bankCode: z.string().min(1),
  authMethod: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('easy_auth'),
      channel: z.enum(['kakao', 'pass', 'naver', 'samsung']),
    }),
    z.object({
      kind: z.literal('id_password'),
      idLabel: z.string(),
      passwordLabel: z.string(),
    }),
    z.object({ kind: z.literal('cert') }),
  ]),
  loginId: z.string().optional(),
  loginPassword: z.string().optional(),
  birth: z.string().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
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
    const result = await provider.startLink({
      bankCode: body.bankCode,
      authMethod: body.authMethod as AuthMethod,
      loginId: body.loginId,
      loginPassword: body.loginPassword,
      birth: body.birth,
      phone: body.phone,
      fullName: body.fullName,
    });

    if (result.kind === 'pending') {
      return ok({
        kind: 'pending',
        sessionToken: result.sessionToken,
        message: result.message,
        provider: provider.id,
      });
    }

    // 즉시 완료 → DB 저장
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

    return ok({ kind: 'completed', account });
  } catch (e) {
    const msg = e instanceof Error ? (e as { userMessage?: string }).userMessage ?? e.message : '연동 실패';
    return fail('INTERNAL', msg);
  }
}
