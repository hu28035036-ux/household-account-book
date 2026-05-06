'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardTitle, CardSubtle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Step = 'email' | 'otp';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/dashboard';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // 이미 로그인된 세션이 있으면 곧장 redirect — 새 창 없이 자동 접속.
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        router.replace(redirect);
      }
    });
    return () => {
      cancelled = true;
    };
    // redirect는 search 변동 외엔 동일하니 의존성 단순.
  }, [redirect, router]);

  // OTP 단계로 넘어가면 코드 입력란에 자동 포커스
  useEffect(() => {
    if (step === 'otp') {
      const t = setTimeout(() => otpInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [step]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      // emailRedirectTo를 비우면 매직링크 대신 OTP 코드 흐름이 우선.
      // (메일 템플릿에 매직링크가 같이 발송될 수 있으나 사용자는 코드만 입력)
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        const m = error.message || '';
        if (/EMAIL_NOT_ALLOWED|not allowed|invite list/i.test(m)) {
          throw new Error('초대 명단에 없는 이메일입니다. 관리자에게 등록을 요청하세요.');
        }
        throw error;
      }
      setStep('otp');
      setMessage('메일함에서 6자리 인증 코드를 확인해 입력해 주세요.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '코드 전송 실패');
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const token = code.replace(/\s+/g, '');
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      });
      if (error) {
        const m = error.message || '';
        if (/EMAIL_NOT_ALLOWED|not allowed|invite list/i.test(m)) {
          throw new Error('초대 명단에 없는 이메일입니다. 관리자에게 등록을 요청하세요.');
        }
        if (/expired|invalid/i.test(m)) {
          throw new Error('코드가 만료되었거나 일치하지 않습니다. 코드 다시 받기를 시도해 주세요.');
        }
        throw error;
      }
      // 세션이 브라우저에 영구 저장됨(persistSession=true 기본). 곧장 이동.
      router.replace(redirect);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증 실패');
    } finally {
      setPending(false);
    }
  }

  function backToEmail() {
    setStep('email');
    setCode('');
    setMessage(null);
    setError(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-appBackground">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-block h-10 w-10 rounded-xl bg-primaryPink mb-3" />
          <h1 className="text-2xl font-semibold text-textPrimary">AI 가계부</h1>
          <p className="text-sm text-textSecondary mt-1">이메일 6자리 인증으로 로그인하세요. 한 번 인증하면 자동 유지됩니다.</p>
        </div>

        <Card>
          {step === 'email' ? (
            <>
              <CardTitle>이메일 인증</CardTitle>
              <CardSubtle className="mt-1">초대 명단의 이메일만 가입·로그인이 가능합니다.</CardSubtle>

              <form onSubmit={sendCode} className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-sm text-textSecondary">이메일</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full h-11 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primaryPinkBorder"
                  />
                </label>
                <Button type="submit" disabled={pending || !email.trim()} fullWidth size="lg">
                  {pending ? '전송 중…' : '인증 코드 받기'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <CardTitle>인증 코드 입력</CardTitle>
              <CardSubtle className="mt-1">
                <span className="text-textPrimary">{email}</span>으로 보낸 6자리 코드를 입력하세요.
              </CardSubtle>

              <form onSubmit={verifyCode} className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-sm text-textSecondary">6자리 코드</span>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="mt-1 w-full h-12 px-3 rounded-lg bg-white border border-borderDefault text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primaryPinkBorder text-center text-xl font-mono tracking-[0.5em] tabular"
                  />
                </label>
                <Button type="submit" disabled={pending || code.length !== 6} fullWidth size="lg">
                  {pending ? '확인 중…' : '로그인'}
                </Button>
                <button
                  type="button"
                  onClick={backToEmail}
                  className="w-full text-sm text-textSecondary hover:text-textPinkStrong"
                >
                  이메일 다시 입력
                </button>
              </form>
            </>
          )}

          {message && (
            <p className="mt-4 text-sm rounded-md bg-successSoft text-success px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="mt-4 text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-textMuted">
          본 서비스는 결제 없이 운영되며, 초대받은 이메일만 가입할 수 있습니다.
          <br />한 번 인증하면 같은 브라우저에서 자동으로 유지됩니다.
        </p>
      </div>
    </div>
  );
}
