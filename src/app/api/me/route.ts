import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok } from '@/lib/http/response';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail('UNAUTHORIZED', '로그인이 필요합니다.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, created_at')
    .eq('user_id', u.user.id)
    .maybeSingle();

  return ok({
    id: u.user.id,
    email: u.user.email,
    created_at: u.user.created_at,
    display_name: profile?.display_name ?? null,
  });
}
