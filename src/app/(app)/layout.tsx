import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { AppShell } from '@/components/layout/AppShell';
import { isAdminEmail } from '@/lib/admin/isAdmin';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');
  return (
    <AppShell userEmail={user.email} isAdmin={isAdminEmail(user.email)}>
      {children}
    </AppShell>
  );
}
