'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { localizeAuthError } from '@/lib/auth/errorMessages';
import { LoginInput } from '@/lib/validators/auth';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/dashboard';
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) router.replace(redirect);
    });
    return () => {
      cancelled = true;
    };
  }, [redirect, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = LoginInput.safeParse({ username, password: pw });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력 오류');
      return;
    }
    setPending(true);
    try {
      const lookup = await fetch('/api/auth/lookup-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      }).then((r) => r.json());
      const email = lookup?.data?.email as string | null | undefined;
      if (!email) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) {
        if (/invalid login credentials/i.test(error.message || '')) {
          throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
        throw error;
      }

      router.replace(redirect);
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setError(localizeAuthError(raw, '로그인 실패'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-appBackground">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-block h-10 w-10 rounded-xl bg-primaryPink mb-3" />
          <h1 className="text-2xl font-semibold text-textPrimary">AI 가계부</h1>
          <p className="text-sm text-textSecondary mt-1">아이디와 비밀번호로 로그인하세요.</p>
        </div>

        <Card>
          <CardTitle>로그인</CardTitle>
          <CardSubtle className="mt-1">한 번 로그인하면 같은 브라우저에서 자동 유지됩니다.</CardSubtle>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-sm text-textSecondary">아이디</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="mt-1 w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
            </label>
            <label className="block">
              <span className="text-sm text-textSecondary">비밀번호</span>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                required
                minLength={8}
                className="mt-1 w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
            </label>

            {error && (
              <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
            )}

            <Button type="submit" disabled={pending || !username || pw.length < 8} fullWidth size="lg">
              {pending ? '로그인 중…' : '로그인'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-textSecondary">
            아직 계정이 없으신가요?{' '}
            <Link href="/signup" className="text-textPinkStrong font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-center text-xs text-textMuted">
          결제 없이 운영됩니다. 별도 이메일 인증 절차는 없으며 비밀번호로 로그인합니다.
        </p>
      </div>
    </div>
  );
}
