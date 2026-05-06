import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { AdminClient } from '@/components/admin/AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  // 비관리자에게는 라우트 자체를 노출하지 않음 (404 체감)
  if (!isAdminEmail(u.user.email)) notFound();
  return <AdminClient currentEmail={u.user.email ?? null} />;
}
