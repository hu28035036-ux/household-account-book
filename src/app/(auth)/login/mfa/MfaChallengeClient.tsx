'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function MfaChallengeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/dashboard';
  const supabase = createSupabaseBrowserClient();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      // 이미 AAL2면 그냥 redirect
      if (aal?.currentLevel === 'aal2') {
        router.replace(redirect);
        return;
      }
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      const verified = ((factors?.totp ?? []) as Array<{ id: string; status: string }>).find(
        (f) => f.status === 'verified',
      );
      if (error || !verified) {
        // 등록된 factor 없으면 강제 안 함 — 그대로 통과
        router.replace(redirect);
        return;
      }
      setFactorId(verified.id);
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [redirect, router, supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setPending(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });
      if (error) throw error;
      router.replace(redirect);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '6자리 코드가 올바르지 않습니다.');
      setCode('');
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-appBackground">
        <Card>
          <CardSubtle>확인 중…</CardSubtle>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-appBackground">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-block h-10 w-10 rounded-xl bg-primaryPink mb-3" />
          <h1 className="text-2xl font-semibold text-textPrimary">2단계 인증</h1>
          <p className="text-sm text-textSecondary mt-1">
            Authenticator 앱의 6자리 코드를 입력하세요.
          </p>
        </div>
        <Card>
          <CardTitle>OTP 입력</CardTitle>
          <CardSubtle className="mt-1">코드는 30초마다 갱신됩니다.</CardSubtle>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              required
              className="w-full h-14 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-center tabular text-2xl tracking-[0.5em]"
            />
            {error && (
              <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
            )}
            <Button type="submit" disabled={pending || code.length !== 6} fullWidth size="lg">
              {pending ? '확인 중…' : '확인'}
            </Button>
          </form>
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={logout}>
              다른 계정으로 로그인
            </Button>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-textMuted">
          폰을 잃어버렸다면 운영자에게 OTP 해제를 요청하세요.
        </p>
      </div>
    </div>
  );
}
