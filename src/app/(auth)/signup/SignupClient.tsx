'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { localizeAuthError } from '@/lib/auth/errorMessages';
import { SignupInput } from '@/lib/validators/auth';

export default function SignupClient() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameOk, setUsernameOk] = useState<null | boolean>(null);
  const [usernameMsg, setUsernameMsg] = useState<string>('');

  // 이미 로그인 상태면 대시보드로
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) router.replace('/dashboard');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 아이디 입력 디바운스 후 중복 체크
  useEffect(() => {
    if (!username) {
      setUsernameOk(null);
      setUsernameMsg('');
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(username)}`);
        const json = await res.json();
        const ok = json?.data?.available;
        setUsernameOk(!!ok);
        setUsernameMsg(
          ok ? '사용 가능한 아이디입니다.' : json?.data?.reason ?? '이미 사용 중인 아이디입니다.',
        );
      } catch {
        setUsernameOk(null);
        setUsernameMsg('');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    const parsed = SignupInput.safeParse({
      username,
      full_name: fullName,
      birthdate,
      email,
      password: pw,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력 오류');
      return;
    }
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: {
          data: {
            username: username.trim(),
            full_name: fullName.trim(),
            birthdate,
          },
        },
      });
      if (error) throw error;
      // Confirm email OFF 정책이면 즉시 세션 생성됨 → /dashboard
      router.replace('/dashboard');
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setError(localizeAuthError(raw, '회원가입 실패'));
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    !!username &&
    !!fullName &&
    !!birthdate &&
    !!email &&
    pw.length >= 8 &&
    pw === pw2 &&
    usernameOk !== false;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-appBackground">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-block h-10 w-10 rounded-xl bg-primaryPink mb-3" />
          <h1 className="text-2xl font-semibold text-textPrimary">AI 가계부 회원가입</h1>
          <CardSubtle className="mt-1">아이디와 비밀번호로 로그인합니다. 별도 인증 절차는 없습니다.</CardSubtle>
        </div>

        <Card>
          <CardTitle>새 계정 만들기</CardTitle>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="아이디 (영문/숫자/_/-, 3–20자, 시작은 영문)">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
              {usernameMsg && (
                <p
                  className={
                    'mt-1 text-xs ' + (usernameOk ? 'text-success' : 'text-danger')
                  }
                >
                  {usernameMsg}
                </p>
              )}
            </Field>
            <Field label="이름">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                className="w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
            </Field>
            <Field label="생년월일">
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                required
                className="w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
            </Field>
            <Field label="이메일">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
            </Field>
            <Field label="비밀번호 (8자 이상)">
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
            </Field>
            <Field label="비밀번호 확인">
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary"
              />
              {pw && pw2 && pw !== pw2 && (
                <p className="mt-1 text-xs text-danger">비밀번호 확인이 일치하지 않습니다.</p>
              )}
            </Field>

            {error && (
              <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
            )}

            <Button type="submit" disabled={pending || !canSubmit} fullWidth size="lg">
              {pending ? '가입 중…' : '회원가입'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-textSecondary">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-textPinkStrong font-medium hover:underline">
              로그인
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-textSecondary">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
