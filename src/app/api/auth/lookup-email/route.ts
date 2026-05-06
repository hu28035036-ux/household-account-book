import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Username } from '@/lib/validators/auth';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const Body = z.object({ username: Username });

/**
 * 아이디 → 이메일 조회.
 * 보안: enumeration 공격을 줄이기 위해 username 미존재여도 200 + { email: null } 반환.
 * 클라이언트는 이후 signInWithPassword 결과로 통합 에러 메시지 표시.
 */
export async function POST(req: NextRequest) {
  let body: { username: string };
  try {
    body = Body.parse(await req.json());
  } catch {
    return ok({ email: null });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id')
    .ilike('username', body.username)
    .maybeSingle();
  if (!profile) return ok({ email: null });

  const { data: usr } = await admin.auth.admin.getUserById(profile.user_id);
  return ok({ email: usr.user?.email ?? null });
}
