import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok } from '@/lib/http/response';

export const runtime = 'nodejs';

const PatchBody = z.object({
  // 별명 — 특수문자 허용. 빈 문자열은 null 처리.
  nickname: z
    .string()
    .max(40, '별명은 40자 이내로 입력해 주세요.')
    .nullable()
    .optional(),
  // 이름·생년월일 수정 가능 (회원가입 정보)
  full_name: z.string().min(1, '이름을 입력하세요.').max(40).optional(),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.')
    .nullable()
    .optional(),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, birthdate, nickname, display_name, created_at')
    .eq('user_id', u.user.id)
    .maybeSingle();

  return ok({
    id: u.user.id,
    email: u.user.email,
    created_at: u.user.created_at,
    username: profile?.username ?? null,
    full_name: profile?.full_name ?? null,
    birthdate: profile?.birthdate ?? null,
    nickname: profile?.nickname ?? null,
    display_name: profile?.display_name ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const raw = (await req.json()) as Record<string, unknown>;
    // 빈 문자열은 null 로 정규화 (nickname / birthdate 둘 다)
    if (raw.nickname === '') raw.nickname = null;
    if (raw.birthdate === '') raw.birthdate = null;
    const input = PatchBody.parse(raw);

    const { data, error } = await supabase
      .from('profiles')
      .update(input)
      .eq('user_id', u.user.id)
      .select('username, full_name, birthdate, nickname, display_name, created_at')
      .single();
    if (error) throw error;
    return ok({
      id: u.user.id,
      email: u.user.email,
      created_at: u.user.created_at,
      username: data.username ?? null,
      full_name: data.full_name ?? null,
      birthdate: data.birthdate ?? null,
      nickname: data.nickname ?? null,
      display_name: data.display_name ?? null,
    });
  } catch (e) {
    return fail('BAD_REQUEST', e instanceof Error ? e.message : '입력 오류');
  }
}
