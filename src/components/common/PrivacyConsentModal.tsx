'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ShieldCheck, ExternalLink } from 'lucide-react';

/**
 * AI 기능 사용 전 개인정보처리방침 동의 모달.
 * - 기존 사용자(가입 시 체크 못 받았음)에게 첫 AI 사용 시점에 노출.
 * - 동의 시 /api/account/consent POST → profiles.privacy_consent_at 갱신.
 * - 동의 후 onAgreed() 콜백 호출 → 부모가 원래 액션 진행.
 */
export function PrivacyConsentModal({
  open,
  onClose,
  onAgreed,
  reason = 'AI 기능을 사용하려면 개인정보처리방침 동의가 필요합니다.',
}: {
  open: boolean;
  onClose: () => void;
  onAgreed: () => void;
  reason?: string;
}) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!checked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'privacy', version: 'v1' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '동의 기록 실패');
      onAgreed();
      setChecked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '동의 기록 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="개인정보처리방침 동의">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md bg-softPinkBackground/60 px-3 py-2.5">
          <ShieldCheck
            className="h-5 w-5 text-textPinkStrong shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <p className="text-sm text-textPrimary leading-relaxed">{reason}</p>
        </div>

        <div className="text-sm text-textSecondary leading-relaxed space-y-2">
          <p>이 앱은 가계부 기능을 위해 다음 정보를 처리합니다:</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs">
            <li>거래 내역 (날짜·금액·가맹점·카테고리)</li>
            <li>업로드 파일 (영수증 사진, 은행 명세서)</li>
            <li>AI 분석을 위해 OpenAI 로 텍스트 일시 전송 (모델 학습 X, 30일 후 자동 폐기)</li>
            <li>모든 데이터는 RLS 로 사용자별 격리, 계정 삭제 시 즉시 영구 삭제</li>
          </ul>
        </div>

        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-textPinkStrong hover:underline"
        >
          전문 보기
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>

        <label className="flex items-start gap-2 px-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primaryPink shrink-0"
          />
          <span className="text-sm text-textPrimary">
            개인정보처리방침의 모든 내용을 읽고 동의합니다
            <span className="text-danger ml-1">(필수)</span>
          </span>
        </label>

        {error && (
          <div className="rounded-md bg-dangerSoft text-danger px-3 py-2 text-sm">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            나중에
          </Button>
          <Button variant="primary" onClick={submit} disabled={!checked || busy}>
            {busy ? '저장 중…' : '동의하고 계속'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
