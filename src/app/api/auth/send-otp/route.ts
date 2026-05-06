import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const Body = z.object({ email: z.string().email().max(254) });

const COOLDOWN_MS = 3000; // 같은 이메일 재요청 최소 간격

export async function POST(req: NextRequest) {
  let input: { email: string };
  try {
    input = Body.parse(await req.json());
  } catch (e) {
    return fail('BAD_REQUEST', '이메일 형식이 올바르지 않습니다.');
  }
  const email = input.email.trim().toLowerCase();

  const admin = createSupabaseAdminClient();

  // 1) 같은 이메일의 최근 발송 시점 확인 (3초 이내면 거부)
  const { data: recent } = await admin
    .from('otp_send_log')
    .select('sent_at')
    .eq('email', email)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = Date.now() - new Date(recent.sent_at as string).getTime();
    if (elapsed < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return fail(
        'RATE_LIMITED',
        `너무 빠른 재시도입니다. ${wait}초 후 다시 시도해 주세요.`,
      );
    }
  }

  // 2) 발송 로그 먼저 적재(레이스에 의한 중복 발송 최소화)
  await admin.from('otp_send_log').insert({ email });

  // 3) anon 서버 클라이언트로 OTP 발송 (signInWithOtp는 anon 키로 동작)
  //    클라이언트와 동일 동작이지만 서버 경유로 throttle을 강제.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (_n: string, _v: string, _o: CookieOptions) => {},
        remove: (_n: string, _o: CookieOptions) => {},
      },
    },
  );
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    const m = error.message || '';
    if (/rate limit/i.test(m)) {
      return fail(
        'RATE_LIMITED',
        '이메일 발송 한도(시간당)에 도달했습니다. 1시간 뒤 다시 시도하거나 운영자에게 SMTP 설정을 요청하세요.',
      );
    }
    return fail('INTERNAL', error.message);
  }

  return ok({ sent: true, cooldown_ms: COOLDOWN_MS });
}
