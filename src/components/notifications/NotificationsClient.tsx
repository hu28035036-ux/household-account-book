'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, AlertTriangle, AlertOctagon, Info, CheckCheck } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils/cn';
import { formatDateKST } from '@/lib/formatting/date';

type N = {
  id: string;
  type: 'budget_caution' | 'budget_over' | 'duplicate_warning' | 'extraction_failed' | 'general';
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const TONE: Record<N['type'], any> = {
  budget_caution: 'warning',
  budget_over: 'danger',
  duplicate_warning: 'warning',
  extraction_failed: 'danger',
  general: 'info',
};
const LABEL: Record<N['type'], string> = {
  budget_caution: '예산 주의',
  budget_over: '예산 초과',
  duplicate_warning: '중복 의심',
  extraction_failed: '분석 실패',
  general: '알림',
};

function Icon({ type }: { type: N['type'] }) {
  const cls = TONE[type] === 'danger' ? 'text-danger' : TONE[type] === 'warning' ? 'text-warning' : 'text-info';
  if (type === 'budget_over' || type === 'extraction_failed')
    return <AlertOctagon className={cn('h-5 w-5', cls)} strokeWidth={1.75} />;
  if (type === 'budget_caution' || type === 'duplicate_warning')
    return <AlertTriangle className={cn('h-5 w-5', cls)} strokeWidth={1.75} />;
  return <Info className={cn('h-5 w-5', cls)} strokeWidth={1.75} />;
}

export function NotificationsClient() {
  const [items, setItems] = useState<N[]>([]);
  const [scope, setScope] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/notifications?scope=${scope}&limit=200`);
    const json = await res.json();
    setItems(json?.data?.items ?? []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  async function readOne(n: N) {
    if (n.read_at) return;
    await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
    load();
  }
  async function readAll() {
    setPending(true);
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setPending(false);
    load();
  }
  async function remove(n: N) {
    if (!confirm('이 알림을 삭제할까요?')) return;
    await fetch(`/api/notifications/${n.id}`, { method: 'DELETE' });
    load();
  }
  async function checkNow() {
    setPending(true);
    await fetch('/api/notifications/check-budgets', { method: 'POST' });
    setPending(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">알림</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={checkNow} disabled={pending}>
            예산 즉시 체크
          </Button>
          <Button size="sm" variant="ghost" onClick={readAll} disabled={pending}>
            <CheckCheck className="h-4 w-4" strokeWidth={1.75} /> 모두 읽음
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
          >
            <option value="all">전체</option>
            <option value="unread">안 읽음만</option>
          </select>
          <span className="text-xs text-textSecondary">총 {items.length}건</span>
        </div>
      </Card>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardTitle>알림이 없어요</CardTitle>
          <CardSubtle className="mt-1">
            예산 임계 도달 등 중요한 사건은 여기로 모입니다. 거래를 등록/승인하면 자동 체크됩니다.
          </CardSubtle>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card
                className={cn('flex items-start gap-3', !n.read_at && 'bg-primaryPinkSoft/30')}
                onClick={() => readOne(n)}
              >
                <span className="mt-0.5">
                  <Icon type={n.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={TONE[n.type]}>{LABEL[n.type]}</Badge>
                    <span className="text-sm font-semibold text-textPrimary truncate">{n.title}</span>
                    {!n.read_at && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primaryPink shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-textSecondary">{n.body}</p>
                  <div className="mt-1 text-xs text-textMuted">{formatDateKST(n.created_at)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(n); }} aria-label="삭제">
                  <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
