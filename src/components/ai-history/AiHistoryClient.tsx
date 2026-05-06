'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { AiHistoryRow, type AiHistoryItem } from '@/components/stats/AiHistoryRow';
import { useActiveHousehold } from '@/lib/active-household';
import { cn } from '@/lib/utils/cn';

type RangePreset = 'all' | '30d' | '90d' | '180d';

const PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '30d', label: '최근 30일' },
  { id: '90d', label: '최근 90일' },
  { id: '180d', label: '최근 180일' },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function AiHistoryClient() {
  const { activeId, households } = useActiveHousehold();
  const activeName = activeId ? households.find((h) => h.id === activeId)?.name ?? null : null;
  const [preset, setPreset] = useState<RangePreset>('all');
  const [rows, setRows] = useState<AiHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (preset !== 'all') {
      const days = preset === '30d' ? 30 : preset === '90d' ? 90 : 180;
      params.set('createdFrom', isoDaysAgo(days));
    }
    try {
      const res = await fetch(`/api/stats/ai-analysis?${params.toString()}`);
      const j = await res.json();
      setRows(((j?.data ?? []) as AiHistoryItem[]) ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [preset, activeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm('이 분석 기록을 삭제할까요?')) return;
    const res = await fetch(`/api/stats/ai-analysis/${id}`, { method: 'DELETE' });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary flex items-center gap-2">
            <History className="h-6 w-6 text-textPinkStrong" strokeWidth={1.75} />
            AI 분석 기록
          </h2>
          <p className="mt-0.5 text-xs text-textMuted">
            현재 컨텍스트:{' '}
            <b className="text-textPrimary">
              {activeName ? `${activeName} (모임)` : '개인 가계부'}
            </b>{' '}
            — 헤더 우상단 전환기에서 다른 컨텍스트로 바꿀 수 있어요.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.75} /> 새로고침
        </Button>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>기간 필터</CardTitle>
          <Badge tone="muted">{rows.length}건</Badge>
        </div>
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
        </div>
      </Card>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardTitle>아직 분석 기록이 없어요</CardTitle>
          <CardSubtle className="mt-1">
            통계 페이지의 “AI 분석” 카드에서 기간을 선택하고 [분석 실행] 을 누르면
            결과가 여기에 자동으로 쌓입니다.
          </CardSubtle>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <AiHistoryRow key={r.id} item={r} onDelete={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
