'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';
import { cn } from '@/lib/utils/cn';

type AiResult = {
  id?: string | null;
  range: { from: string; to: string };
  totals: { expense: number; income: number; balance: number };
  transaction_count: number;
  summary: string;
  tips: Array<{ title: string; body: string; savable_won: number | null }>;
  model: string;
  generated_at: string;
};

type HistoryRow = AiResult & { id: string; created_at: string };

type Preset = 'this' | '1m' | '3m' | '6m' | 'custom';

function ymd(d: Date): string {
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
    const todayKstStr = ymd(today);
    const ym = todayKstStr.slice(0, 7);
    return { from: `${ym}-01`, to: todayKstStr };
  }
  const months = p === '1m' ? 1 : p === '3m' ? 3 : 6;
  const from = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate()),
  );
  return { from: ymd(from), to: ymd(today) };
}

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'this', label: '이번 달' },
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: 'custom', label: '직접 설정' },
];

function ResultBlock({ r }: { r: AiResult }) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-textSecondary">
        기간: <span className="text-textPrimary">{r.range.from} ~ {r.range.to}</span> · 거래{' '}
        {r.transaction_count}건 · 지출{' '}
        <span className="text-expense">{formatKRW(r.totals.expense)}</span> / 수입{' '}
        <span className="text-income">{formatKRW(r.totals.income)}</span>
      </div>
      <div className="rounded-md bg-softPinkBackground/60 px-3 py-2.5 text-sm text-textPrimary leading-relaxed whitespace-pre-line">
        {r.summary || '(요약 없음)'}
      </div>
      {r.tips.length > 0 && (
        <ul className="space-y-2">
          {r.tips.map((t, i) => (
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
    </div>
  );
}

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
  const [current, setCurrent] = useState<AiResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/ai-analysis?limit=20');
      const j = await res.json();
      setHistory(((j?.data ?? []) as HistoryRow[]) ?? []);
    } catch {
      // 이력 로드 실패는 무시 — 분석 자체엔 영향 없음
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
      setCurrent(j.data as AiResult);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실패');
    } finally {
      setPending(false);
    }
  }

  async function removeHistory(id: string) {
    if (!confirm('이 분석 기록을 삭제할까요?')) return;
    const res = await fetch(`/api/stats/ai-analysis/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (expandedId === id) setExpandedId(null);
      if (current?.id === id) setCurrent(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>AI 분석</CardTitle>
        </div>
        {current && <Badge tone="muted">{current.model}</Badge>}
      </div>
      <CardSubtle className="mt-1">
        선택한 기간의 지출 패턴을 요약하고, 절약 포인트 3~5개를 제안합니다.
        분석 결과는 자동으로 저장되어 다른 페이지에 갔다 와도 그대로 보입니다.
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

      {current && (
        <div className="mt-4">
          <ResultBlock r={current} />
        </div>
      )}

      {/* 이전 분석 이력 */}
      {history.length > 0 && (
        <div className="mt-5 border-t border-borderSoft pt-3">
          <div className="flex items-center justify-between gap-2">
            <CardSubtle className="m-0">이전 분석 기록</CardSubtle>
            <span className="text-xs text-textMuted">{history.length}건</span>
          </div>
          <ul className="mt-2 space-y-1">
            {history.map((h) => {
              const open = expandedId === h.id;
              return (
                <li key={h.id} className="rounded-md border border-borderSoft">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : h.id)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      {open ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-textMuted" strokeWidth={1.75} />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-textMuted" strokeWidth={1.75} />
                      )}
                      <span className="text-sm text-textPrimary truncate">
                        {h.range.from} ~ {h.range.to}
                      </span>
                      <span className="text-xs text-textMuted truncate hidden sm:inline">
                        지출 {formatKRW(h.totals.expense)} · 거래 {h.transaction_count}건
                      </span>
                      <span className="ml-auto text-xs text-textMuted whitespace-nowrap">
                        {formatDateKST(h.created_at)}
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeHistory(h.id)}
                      aria-label="삭제"
                      className="!h-8 !px-2"
                    >
                      <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                    </Button>
                  </div>
                  {open && (
                    <div className="px-3 pb-3">
                      <ResultBlock r={h} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
