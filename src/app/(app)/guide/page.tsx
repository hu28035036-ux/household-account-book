import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { WritingGuideClient } from '@/components/guide/WritingGuideClient';

export const dynamic = 'force-dynamic';

export default async function GuidePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <AppShell title="가계부 작성 가이드" userEmail={user.email} isAdmin={isAdminEmail(user.email)}>
      <WritingGuideClient />
    </AppShell>
  );
}
