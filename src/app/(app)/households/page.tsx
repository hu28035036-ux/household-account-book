import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HouseholdsClient } from '@/components/households/HouseholdsClient';

export const dynamic = 'force-dynamic';

// 미들웨어 + (app)/layout.tsx에서 보호하므로 여기서는 자체 redirect 호출 금지.
// page에서 redirect('/login')을 부르면 미들웨어의 redirect 쿼리(?redirect=...)가
// 덮어써져 사라지는 회귀를 일으킨다 (PITFALLS §1.1 참고).
export default async function HouseholdsPage() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  return <HouseholdsClient currentUserId={u.user.id} />;
}
