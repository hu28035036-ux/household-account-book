'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Building2,
  CreditCard,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { LinkAccountModal } from './LinkAccountModal';

function formatRelativeKST(iso: string | null): string {
  if (!iso) return '없음';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}일 전`;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

type LinkedAccount = {
  id: string;
  provider: 'mock' | 'codef' | 'plaid';
  bank_code: string;
  bank_name: string;
  account_type: 'checking' | 'savings' | 'card' | 'loan' | 'other';
  account_number_masked: string;
  holder_name: string | null;
  nickname: string | null;
  last_sync_at: string | null;
  last_sync_status: 'never' | 'pending' | 'ok' | 'failed';
  last_sync_error: string | null;
  balance: number | null;
  linked_at: string;
};

const TYPE_LABEL: Record<LinkedAccount['account_type'], string> = {
  checking: '입출금',
  savings: '적금/예금',
  card: '카드',
  loan: '대출',
  other: '기타',
};

function formatKRW(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('ko-KR') + '원';
}

export function BankingClient() {
  const [items, setItems] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const res = await fetch('/api/banking/accounts', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? '조회 실패');
      return;
    }
    setItems(json.data.items);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function syncOne(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/banking/accounts/${id}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '동기화 실패');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화 실패');
    } finally {
      setBusyId(null);
    }
  }

  async function unlinkOne(id: string) {
    if (!window.confirm('이 계좌 연동을 해제하시겠어요? 이미 가져온 거래는 그대로 남습니다.')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/banking/accounts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '해제 실패');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제 실패');
    } finally {
      setBusyId(null);
    }
  }

  const empty = items !== null && items.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">계좌 연동</h2>
        <Button variant="primary" onClick={() => setLinkOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          연동하기
        </Button>
      </div>

      <Card className="bg-softPinkBackground/40 border-softPinkBackground">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-textPinkStrong mt-0.5 shrink-0" strokeWidth={1.75} />
          <div className="text-xs text-textSecondary leading-relaxed">
            <b className="text-textPrimary">서버 중계 방식 — 안전합니다.</b>{' '}
            브라우저는 비밀번호·인증 정보를 직접 다루지 않습니다. Next.js 서버가 외부
            금융 데이터 Aggregator(Codef 등)와 통신하고, 자격증명은 AES-256으로 암호화되어
            저장됩니다. 연동된 계좌의 거래는{' '}
            <Link href="/candidates" className="underline text-textPinkStrong">
              분석 후보
            </Link>
            로 들어가며, 검토·승인하기 전까지는 거래내역에 반영되지 않습니다.
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-md bg-dangerSoft text-danger px-3 py-2 text-sm">{error}</div>
      )}

      {items === null ? (
        <Card>
          <CardSubtle>불러오는 중…</CardSubtle>
        </Card>
      ) : empty ? (
        <Card>
          <CardTitle>연결된 계좌가 없어요</CardTitle>
          <CardSubtle className="mt-2">
            오른쪽 위{' '}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primaryPink text-textOnPink text-xs font-medium">
              <Plus className="h-3 w-3" strokeWidth={2} />
              연동하기
            </span>{' '}
            버튼으로 첫 계좌를 연결해 보세요.
          </CardSubtle>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {a.account_type === 'card' ? (
                    <CreditCard className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
                  ) : (
                    <Building2 className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-textPrimary truncate">
                      {a.nickname ?? a.bank_name}
                    </div>
                    <div className="text-xs text-textMuted truncate">
                      {a.bank_name} · {TYPE_LABEL[a.account_type]} · {a.account_number_masked}
                    </div>
                  </div>
                </div>
                <SyncStatusBadge status={a.last_sync_status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-pageBackground border border-borderSoft px-2 py-1.5">
                  <div className="text-textMuted">잔액</div>
                  <div className="text-textPrimary font-medium">{formatKRW(a.balance)}</div>
                </div>
                <div className="rounded-md bg-pageBackground border border-borderSoft px-2 py-1.5">
                  <div className="text-textMuted">마지막 동기화</div>
                  <div className="text-textPrimary font-medium">
                    {formatRelativeKST(a.last_sync_at)}
                  </div>
                </div>
              </div>

              {a.last_sync_status === 'failed' && a.last_sync_error && (
                <div className="mt-2 rounded-md bg-dangerSoft text-danger px-2.5 py-1.5 text-xs">
                  {a.last_sync_error}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncOne(a.id)}
                  disabled={busyId === a.id}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${busyId === a.id ? 'animate-spin' : ''}`}
                    strokeWidth={1.75}
                  />
                  동기화
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkOne(a.id)}
                  disabled={busyId === a.id}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  해제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LinkAccountModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onLinked={() => {
          setLinkOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function SyncStatusBadge({ status }: { status: LinkedAccount['last_sync_status'] }) {
  if (status === 'ok') {
    return (
      <Badge tone="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        동기화됨
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge tone="warning" className="gap-1">
        <AlertCircle className="h-3 w-3" strokeWidth={2} />
        실패
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge tone="info" className="gap-1">
        <Clock className="h-3 w-3" strokeWidth={2} />
        진행 중
      </Badge>
    );
  }
  return <Badge tone="muted">대기</Badge>;
}
