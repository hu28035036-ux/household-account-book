import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { isAdminEmail } from '@/lib/admin/isAdmin';
import { PrivacyPolicyClient } from '@/components/privacy/PrivacyPolicyClient';

export const dynamic = 'force-dynamic';

/**
 * 공개 + 로그인 양방 라우트.
 * - 로그인된 사용자가 더보기에서 진입 → AppShell 로 감싸서 평소 UX 유지.
 * - 비로그인 사용자(가입 전 검토 등) → 단순 컨테이너 + 로그인/가입 링크.
 *
 * 이 라우트는 (app) 그룹 밖에 있어서 (app)/layout.tsx 의 강제 redirect 영향 X.
 * 미들웨어 PROTECTED_PREFIXES 에서도 /privacy 제외해야 함.
 */
export default async function PrivacyPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return (
      <AppShell
        title="개인정보처리방침"
        userEmail={user.email}
        isAdmin={isAdminEmail(user.email)}
      >
        <PrivacyPolicyClient />
      </AppShell>
    );
  }

  // 비로그인 — 헤더 1줄 + 본문
  return (
    <div className="min-h-screen bg-appBackground">
      <header className="sticky top-0 z-20 bg-pageBackground/95 backdrop-blur border-b border-borderDefault">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold text-textPrimary"
          >
            <span className="inline-block h-7 w-7 rounded-lg bg-primaryPink" />
            <span>AI 가계부</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-textSecondary hover:text-textPrimary">
              로그인
            </Link>
            <Link
              href="/signup"
              className="h-8 px-3 inline-flex items-center rounded-md bg-primaryPink text-textOnPink hover:bg-primaryPinkHover text-xs font-medium"
            >
              가입하기
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-6 pb-20">
        <PrivacyPolicyClient />
      </main>
    </div>
  );
}
