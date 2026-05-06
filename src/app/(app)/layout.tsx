import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { AppShell } from '@/components/layout/AppShell';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');

  // 2단계 인증 등록자라면, OTP 챌린지(aal2)를 통과하지 않고는 보호 라우트 진입 불가.
  // 미등록 사용자는 영향 없음 (nextLevel === 'aal1').
  // redirect()는 throw 로 구현되므로 try/catch 외부에서 호출.
  let mustChallenge = false;
  try {
    const supabase = createSupabaseServerClient();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
      mustChallenge = true;
    }
  } catch {
    // Supabase 일시 장애 — 통과(다음 페이지 단에서 다시 검증됨)
  }
  if (mustChallenge) redirect('/login/mfa');

  return (
    <AppShell userEmail={user.email} isAdmin={isAdminEmail(user.email)}>
      {children}
    </AppShell>
  );
}
