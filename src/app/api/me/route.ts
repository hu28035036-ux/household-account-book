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
  try {
    const supabase = createSupabaseServerClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

    // 컬럼 누락 / PostgREST schema cache 미반영 환경에서도 절대 throw 안 되도록 보호.
    // 항상 '*' 로 SELECT — 컬럼이 있으면 자동 포함, 없으면 그냥 빠질 뿐 throw 안 함.
    let profile: Record<string, unknown> | null = null;
    try {
      const r = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', u.user.id)
        .maybeSingle();
      profile = (r.data as Record<string, unknown> | null) ?? null;
    } catch (e) {
      // 어떤 이유로든 SELECT 가 throw 하면 profile=null 로 진행
      console.warn('[api/me] profiles select failed:', e);
      profile = null;
    }

    return ok({
      id: u.user.id,
      email: u.user.email,
      created_at: u.user.created_at,
      username: (profile?.username as string | null) ?? null,
      full_name: (profile?.full_name as string | null) ?? null,
      birthdate: (profile?.birthdate as string | null) ?? null,
      nickname: (profile?.nickname as string | null) ?? null,
      display_name: (profile?.display_name as string | null) ?? null,
      privacy_consent_at: (profile?.privacy_consent_at as string | null) ?? null,
      privacy_consent_version: (profile?.privacy_consent_version as string | null) ?? null,
    });
  } catch (e) {
    // production 에서 전체 함수가 throw → MIDDLEWARE/RUNTIME 500 노출 방지
    return fail('INTERNAL', e instanceof Error ? e.message : 'me 조회 실패');
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
  try {
    const raw = (await req.json()) as Record<string, unknown>;
    // 빈 문자열은 의미별로 정규화 — nickname/birthdate 는 빈값=지우기(null),
    // full_name 은 min(1) 이라 빈문자열은 아예 키 제거 (변경 안 함 의도)
    if (raw.nickname === '') raw.nickname = null;
    if (raw.birthdate === '') raw.birthdate = null;
    if (raw.full_name === '' || raw.full_name == null) delete raw.full_name;
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
