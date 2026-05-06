import { SettingsClient } from '@/components/settings/SettingsClient';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin/isAdmin';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  const isAdmin = isAdminEmail(u.user?.email);
  return <SettingsClient isAdmin={isAdmin} />;
}
