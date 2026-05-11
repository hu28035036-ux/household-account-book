'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { TransactionTable } from './TransactionTable';
import { TransactionCardList } from './TransactionCardList';
import { TransactionEditor } from './TransactionEditor';
import { useActiveHousehold } from '@/lib/active-household';
import { useAbortableFetch } from '@/lib/hooks/useAbortableFetch';
import { useConfirm, useAlertModal } from '@/components/common/ConfirmProvider';

// 거래 행 — TransactionTable.Row + TransactionEditor.Initial 둘과 호환.
// 둘 사이의 합집합으로 정의 (Editor 는 일부 optional, Table 은 모두 required).
type TransactionRow = {
  id: string;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  description: string | null;
  memo: string | null;
  household_id: string | null;
  category_id?: string | null;
  payment_method_id?: string | null;
  categories?: { name: string; color: string | null; icon?: string | null } | null;
  payment_methods?: { name: string; type?: string; masked_number: string | null } | null;
};

// TransactionEditor.Category / PaymentMethod 와 호환 — type 필수 string.
type CategoryItem = { id: string; name: string; color?: string | null; type: string };
type PaymentMethodItem = { id: string; name: string; type: string };

export function TransactionsClient() {
  const { activeId, households } = useActiveHousehold();
  const activeName = activeId ? households.find((h) => h.id === activeId)?.name ?? null : null;
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | 'income' | 'expense' | 'transfer'>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const aFetch = useAbortableFetch();
  const confirm = useConfirm();
  const alertModal = useAlertModal();

  // 거래내역만 q/type/activeId 의존. categories·payment-methods 는 컨텍스트 무관이라
  // 별도 useEffect 로 마운트 시 1회만 fetch — 모임↔개인 전환 시 fetch 수 3개 → 1개로 감소.
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    // 활성 컨텍스트가 모임이면 그 모임만, 아니면 개인만 (헤더 우상단의 컨텍스트가 단일 진실 소스)
    if (activeId) params.set('household_id', activeId);
    else params.set('scope', 'personal');
    params.set('limit', '50');
    const txRes = await aFetch('/api/transactions?' + params.toString());
    if (!txRes) return; // abort
    const txJson = await txRes.json();
    setRows(txJson?.data?.rows ?? []);
    setTotal(txJson?.data?.total ?? 0);
    setSelected(new Set());
    setLoading(false);
  }, [q, type, activeId, aFetch]);

  // categories / payment-methods 는 사용자 단위 데이터(RLS 로 user_id 기반)라
  // 모임 컨텍스트 전환과 무관 — 마운트 시 한 번만 fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catRes, pmRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/payment-methods'),
      ]);
      if (cancelled) return;
      const catJson = await catRes.json().catch(() => ({}));
      const pmJson = await pmRes.json().catch(() => ({}));
      if (cancelled) return;
      setCategories(catJson?.data ?? []);
      setPaymentMethods(pmJson?.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(row: TransactionRow) {
    const ok = await confirm({
      title: '거래 삭제',
      message: `${row.merchant_name ?? ''} ${row.amount?.toLocaleString?.() ?? ''}원 거래를 삭제할까요? 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/transactions/${row.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const allOn = rows.length > 0 && rows.every((r) => prev.has(r.id));
      return allOn ? new Set() : new Set(rows.map((r) => r.id));
    });
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `${selected.size}건 일괄 삭제`,
      message: `선택한 ${selected.size}건을 삭제할까요? 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      tone: 'danger',
    });
    if (!ok) return;
    setBulkPending(true);
    try {
      const res = await fetch('/api/transactions/delete-bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const j = await res.json();
      if (!res.ok) {
        await alertModal({ title: '일괄 삭제 실패', message: j?.error?.message ?? '일괄 삭제 실패' });
        return;
      }
      const deleted = j?.data?.deleted ?? 0;
      const skipped = j?.data?.skipped ?? 0;
      if (skipped > 0) {
        await alertModal({
          title: '일괄 삭제 완료',
          message: `${deleted}건 삭제 · ${skipped}건은 권한이 없어 건너뜀 (다른 가족이 만든 거래).`,
        });
      }
      await load();
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">
          {activeName ? `${activeName} (모임)` : '개인 가계부'} 거래내역
        </h2>
        <Button
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} /> 거래 추가
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="search"
            placeholder="가맹점/메모 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary flex-1 min-w-0"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
          >
            <option value="">전체 유형</option>
            <option value="expense">지출</option>
            <option value="income">수입</option>
            <option value="transfer">이체</option>
          </select>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2 text-xs text-textSecondary">
        <span>총 {total}건</span>
      </div>

      {/* 액션바 — 모든 버튼 통일 사이즈: h-9 / px-3 / text-sm (= Button size="sm") */}
      {!loading && rows.length > 0 && (
        <div className="sticky top-14 z-10 -mx-4 px-4 py-2 bg-pageBackground/95 backdrop-blur border-b border-borderSoft md:static md:top-auto md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-0 md:border-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={toggleAll}>
              {rows.length > 0 && rows.every((r) => selected.has(r.id)) ? '전체 해제' : '전체 선택'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              선택 해제 ({selected.size})
            </Button>
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={bulkDelete}
                disabled={bulkPending || selected.size === 0}
                variant="danger"
              >
                {selected.size > 0 ? `선택 ${selected.size}건 삭제` : '일괄 삭제 (선택 필요)'}
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-textMuted">
            본인이 만든 거래만 삭제됩니다. 다른 멤버가 만든 모임 거래는 자동으로 제외됩니다.
          </p>
        </div>
      )}

      {loading ? (
        <Card>
          <p className="text-sm text-textSecondary text-center py-6">불러오는 중…</p>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <TransactionTable
              rows={rows as unknown as Parameters<typeof TransactionTable>[0]['rows']}
              onEdit={(r) => {
                setEditing(r as unknown as TransactionRow);
                setEditorOpen(true);
              }}
              onDelete={onDelete as unknown as Parameters<typeof TransactionTable>[0]['onDelete']}
              selectedIds={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          </div>
          <div className="md:hidden">
            <TransactionCardList
              rows={rows as unknown as Parameters<typeof TransactionCardList>[0]['rows']}
              onEdit={(r) => {
                setEditing(r as unknown as TransactionRow);
                setEditorOpen(true);
              }}
              onDelete={onDelete as unknown as Parameters<typeof TransactionCardList>[0]['onDelete']}
              selectedIds={selected}
              onToggle={toggle}
            />
          </div>
        </>
      )}

      <TransactionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editing ?? undefined}
        categories={categories}
        paymentMethods={paymentMethods}
        onSaved={load}
      />
    </div>
  );
}
