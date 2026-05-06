'use client';

import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { formatKRW } from '@/lib/formatting/money';
import { cn } from '@/lib/utils/cn';

type AiResult = {
  range: { from: string; to: string };
  totals: { expense: number; income: number; balance: number };
  transaction_count: number;
  summary: string;
  tips: Array<{ title: string; body: string; savable_won: number | null }>;
  model: string;
  cost: { input_tokens: number; output_tokens: number; usd: number; krw: number };
  generated_at: string;
};

type Preset = 'this' | '1m' | '3m' | '6m' | 'custom';

function ymd(d: Date): string {
  // KST 타임존 처리: Intl 'en-CA' (YYYY-MM-DD)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function rangeForPreset(p: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  if (p === 'custom') return { from: customFrom, to: customTo };
  if (p === 'this') {
    // 이번 달 1일 ~ 오늘 (KST)
    const todayKstStr = ymd(today); // YYYY-MM-DD
    const ym = todayKstStr.slice(0, 7);
    return { from: `${ym}-01`, to: todayKstStr };
  }
  const months = p === '1m' ? 1 : p === '3m' ? 3 : 6;
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate()));
  return { from: ymd(from), to: ymd(today) };
}

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'this', label: '이번 달' },
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: 'custom', label: '직접 설정' },
];

export function StatsAiCard() {
  const todayStr = useMemo(() => ymd(new Date()), []);
  const [preset, setPreset] = useState<Preset>('1m');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 1);
    return ymd(d);
  });
  const [customTo, setCustomTo] = useState(todayStr);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function run() {
    setError(null);
    setPending(true);
    try {
      const r = rangeForPreset(preset, customFrom, customTo);
      const res = await fetch('/api/stats/ai-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(r),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? '분석 실패');
      setResult(j.data as AiResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>AI 분석</CardTitle>
        </div>
        {result && <Badge tone="muted">{result.model}</Badge>}
      </div>
      <CardSubtle className="mt-1">
        선택한 기간의 지출 패턴을 요약하고, 절약 포인트 3~5개를 제안합니다.
        버튼을 누를 때만 호출됩니다 (1회 약 1.7~2.5원).
      </CardSubtle>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              'h-9 px-3 rounded-md text-sm border transition-colors',
              preset === p.id
                ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                : 'bg-white text-textSecondary border-borderDefault hover:bg-softPinkBackground',
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={run} disabled={pending}>
            {pending ? '분석 중…' : '분석 실행'}
          </Button>
        </div>
      </div>

      {preset === 'custom' && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 px-3 rounded-md border border-borderDefault bg-white text-sm text-textPrimary"
          />
          <span className="text-xs text-textMuted">→</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 px-3 rounded-md border border-borderDefault bg-white text-sm text-textPrimary"
          />
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-textSecondary">
            기간: <span className="text-textPrimary">{result.range.from} ~ {result.range.to}</span>{' '}
            · 거래 {result.transaction_count}건 · 지출{' '}
            <span className="text-expense">{formatKRW(result.totals.expense)}</span> / 수입{' '}
            <span className="text-income">{formatKRW(result.totals.income)}</span>
          </div>
          <div className="rounded-md bg-softPinkBackground/60 px-3 py-2.5 text-sm text-textPrimary leading-relaxed whitespace-pre-line">
            {result.summary || '(요약 없음)'}
          </div>
          {result.tips.length > 0 && (
            <ul className="space-y-2">
              {result.tips.map((t, i) => (
                <li key={i} className="rounded-md border border-borderSoft px-3 py-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-textPrimary">{t.title}</span>
                    {typeof t.savable_won === 'number' && t.savable_won > 0 && (
                      <Badge tone="success">절약 ≈ {formatKRW(t.savable_won)}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-textSecondary leading-relaxed">{t.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[11px] text-textMuted text-right">
            {result.model} · 입력 {result.cost.input_tokens.toLocaleString()} / 출력{' '}
            {result.cost.output_tokens.toLocaleString()} 토큰 · 비용 ≈{' '}
            {result.cost.krw.toFixed(2)}원
          </div>
        </div>
      )}
    </Card>
  );
}
