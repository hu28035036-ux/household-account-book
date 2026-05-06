'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardTitle, CardSubtle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginClient() {
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) {
        // 화이트리스트 미등록 등 가입 트리거가 거부한 경우의 사용자 메시지
        const m = error.message || '';
        if (/EMAIL_NOT_ALLOWED|not allowed|invite list/i.test(m)) {
          throw new Error('초대 명단에 없는 이메일입니다. 관리자에게 등록을 요청하세요.');
        }
        throw error;
      }
      setMessage('메일함에서 로그인 링크를 확인하세요. (초대 명단에 없는 이메일은 첫 가입이 거부됩니다)');
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인 메일 전송 실패');
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
          <p className="text-sm text-textSecondary mt-1">이메일로 로그인 링크를 받아 시작하세요.</p>
        </div>

        <Card>
          <CardTitle>로그인 / 회원가입</CardTitle>
          <CardSubtle className="mt-1">처음이신가요? 입력하신 이메일로 자동 가입됩니다.</CardSubtle>

          <form onSubmit={sendMagicLink} className="mt-5 space-y-3">
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
            <Button type="submit" disabled={pending} fullWidth size="lg">
              {pending ? '전송 중…' : '로그인 링크 보내기'}
            </Button>
          </form>

          {message && (
            <p className="mt-4 text-sm rounded-md bg-successSoft text-success px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="mt-4 text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-textMuted">
          본 서비스는 결제 없이 운영되며, 초대받은 이메일만 가입할 수 있습니다.
          <br />가입 시 기본 카테고리/결제수단이 자동 생성됩니다.
        </p>
      </div>
    </div>
  );
}
