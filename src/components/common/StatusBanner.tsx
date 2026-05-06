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

type ProviderInfo = { provider: 'openai' | 'ollama'; ok: boolean; model: string; reason?: string };
type AiStatus = { ok: boolean; providers: ProviderInfo[]; reason?: string };

const PROVIDER_LABEL: Record<ProviderInfo['provider'], string> = {
  openai: 'OpenAI',
  ollama: 'Ollama',
};

export function AiServerStatus() {
  const [data, setData] = useState<AiStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai-status')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setData((j?.data as AiStatus) ?? { ok: false, providers: [], reason: 'unknown' });
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false, providers: [], reason: 'unreachable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const active = data.providers.find((p) => p.ok);
  if (data.ok && active) {
    const others = data.providers.filter((p) => p !== active);
    return (
      <StatusBanner tone="success">
        AI 서버 연결됨 — {PROVIDER_LABEL[active.provider]}{' '}
        <span className="font-mono text-xs">{active.model}</span>
        {others.length > 0 && (
          <span className="ml-1 text-xs opacity-80">
            (백업:{' '}
            {others
              .map((p) => `${PROVIDER_LABEL[p.provider]} ${p.ok ? '✓' : '✗'}`)
              .join(', ')}
            )
          </span>
        )}
      </StatusBanner>
    );
  }

  if (data.providers.length === 0) {
    return (
      <StatusBanner tone="warning">
        AI 공급자가 설정되어 있지 않아요. Vercel 환경변수에 <span className="font-mono">OPENAI_API_KEY</span> 또는{' '}
        <span className="font-mono">OLLAMA_API_BASE_URL</span>을 등록해 주세요.
        <br />
        OCR 텍스트로 수동 입력은 정상 동작합니다.
      </StatusBanner>
    );
  }

  return (
    <StatusBanner tone="warning">
      AI 서버에 연결할 수 없어요.{' '}
      <span className="text-xs">
        ({data.providers.map((p) => `${PROVIDER_LABEL[p.provider]} ${p.reason ?? 'down'}`).join(' · ')})
      </span>
      <br />
      OCR 텍스트로 수동 입력은 정상 동작합니다.
    </StatusBanner>
  );
}
