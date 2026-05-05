import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HouseholdsClient } from '@/components/households/HouseholdsClient';

export const dynamic = 'force-dynamic';

export default async function HouseholdsPage() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) redirect('/login');
  return <HouseholdsClient currentUserId={u.user.id} />;
}
