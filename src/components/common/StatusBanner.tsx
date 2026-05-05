'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';
type Props = { tone?: Tone; children: React.ReactNode; className?: string };

const TONE_BG: Record<Tone, string> = {
  info: 'bg-infoSoft text-info',
  success: 'bg-successSoft text-success',
  warning: 'bg-warningSoft text-warning',
  danger: 'bg-dangerSoft text-danger',
};

export function StatusBanner({ tone = 'info', children, className }: Props) {
  return (
    <div className={cn('rounded-md px-3 py-2 text-sm flex items-start gap-2', TONE_BG[tone], className)} role="status">
      {tone === 'success' ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      ) : tone === 'warning' || tone === 'danger' ? (
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AiServerStatus() {
  const [state, setState] = useState<'unknown' | 'ok' | 'down'>('unknown');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai-status')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setState(j?.data?.ok ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setState('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'unknown') return null;
  return state === 'ok' ? (
    <StatusBanner tone="success">AI 서버 연결됨 (Ollama)</StatusBanner>
  ) : (
    <StatusBanner tone="warning">
      AI 서버에 연결할 수 없어요. 로컬 Ollama가 켜져 있는지, OLLAMA_API_BASE_URL이 올바른지 확인해 주세요.
      <br />
      OCR 텍스트로 수동 입력은 정상 동작합니다.
    </StatusBanner>
  );
}
