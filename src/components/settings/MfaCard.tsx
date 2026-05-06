'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type FactorRow = { id: string; status: string; friendly_name: string | null };

export function MfaCard() {
  const supabase = createSupabaseBrowserClient();

  const [status, setStatus] = useState<'loading' | 'none' | 'pending' | 'verified'>('loading');
  const [factors, setFactors] = useState<FactorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // enroll modal state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setStatus('none');
      return;
    }
    const totp = ((data?.totp ?? []) as FactorRow[]).map((f) => ({
      id: f.id,
      status: f.status,
      friendly_name: (f as any).friendly_name ?? null,
    }));
    setFactors(totp);
    if (totp.some((f) => f.status === 'verified')) setStatus('verified');
    else if (totp.length > 0) setStatus('pending');
    else setStatus('none');
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setError(null);
    setPending(true);
    try {
      // 미완료 factor가 남아 있으면 정리 (중복 등록 방지)
      for (const f of factors) {
        if (f.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'AI 가계부',
      });
      if (error) throw error;
      setFactorId((data as any)?.id ?? null);
      setQr((data as any)?.totp?.qr_code ?? null);
      setSecret((data as any)?.totp?.secret ?? null);
      setCode('');
      setEnrollOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 시작 실패');
    } finally {
      setPending(false);
    }
  }

  async function verifyEnroll() {
    if (!factorId) return;
    setError(null);
    setPending(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      setEnrollOpen(false);
      setFactorId(null);
      setQr(null);
      setSecret(null);
      setCode('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '6자리 코드가 올바르지 않습니다.');
    } finally {
      setPending(false);
    }
  }

  async function disableMfa() {
    if (!confirm('2단계 인증을 끄시겠어요? 다음 로그인부터 비밀번호만 요구됩니다.')) return;
    setError(null);
    setPending(true);
    try {
      for (const f of factors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="h-4 w-4 text-textPinkStrong shrink-0" strokeWidth={1.75} />
          <span className="text-sm font-semibold text-textPrimary truncate">2단계 인증 (MFA)</span>
        </div>
        {status === 'verified' && <Badge tone="success">활성</Badge>}
        {status === 'pending' && <Badge tone="warning">미완료</Badge>}
        {status === 'none' && <Badge tone="muted">비활성</Badge>}
      </div>

      <p className="mt-1 text-xs text-textMuted leading-snug">
        OTP 앱의 6자리 코드를 비밀번호와 함께 요구. 운영자 계정 권장.
      </p>

      {status === 'loading' && <p className="mt-2 text-xs text-textMuted">불러오는 중…</p>}

      {(status === 'none' || status === 'pending') && (
        <div className="mt-2">
          <Button size="sm" onClick={startEnroll} disabled={pending} className="!h-8 !px-2 !text-xs">
            {status === 'pending' ? '등록 다시 시작' : '등록 시작'}
          </Button>
        </div>
      )}

      {status === 'verified' && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={disableMfa}
            disabled={pending}
            className="!h-8 !px-2 !text-xs"
          >
            해제
          </Button>
        </div>
      )}

      {error && !enrollOpen && (
        <p className="mt-2 text-xs rounded-md bg-dangerSoft text-danger px-2 py-1.5">{error}</p>
      )}

      <Modal open={enrollOpen} onClose={() => setEnrollOpen(false)} title="2단계 인증 등록">
        <div className="space-y-3">
          <ol className="text-sm text-textSecondary space-y-1 list-decimal pl-5">
            <li>OTP 앱 설치 (Google Authenticator / Microsoft Authenticator / Authy 등)</li>
            <li>아래 QR 스캔, 또는 수동 키를 직접 입력</li>
            <li>앱이 보여주는 6자리 숫자를 아래에 입력 → "확인"</li>
          </ol>
          {qr && (
            <div className="flex justify-center">
              <img
                src={qr}
                alt="MFA QR 코드"
                className="h-44 w-44 rounded-md bg-white p-2 border border-borderSoft"
              />
            </div>
          )}
          {secret && (
            <div>
              <CardSubtle>QR을 못 쓰면 수동 키:</CardSubtle>
              <code className="block mt-1 px-3 py-2 rounded bg-sectionBackground text-textPrimary text-sm tracking-wider select-all break-all">
                {secret}
              </code>
            </div>
          )}
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6자리 코드"
            autoFocus
            className="w-full h-12 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-center tabular text-xl tracking-[0.4em]"
          />
          {error && (
            <p className="text-xs rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEnrollOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button onClick={verifyEnroll} disabled={pending || code.length !== 6}>
              {pending ? '확인 중…' : '확인'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
