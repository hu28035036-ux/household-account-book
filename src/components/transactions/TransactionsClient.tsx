'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { TransactionTable } from './TransactionTable';
import { TransactionCardList } from './TransactionCardList';
import { TransactionEditor } from './TransactionEditor';
import { useActiveHousehold } from '@/lib/active-household';

type Row = any;

export function TransactionsClient() {
  const { activeId, households } = useActiveHousehold();
  const activeName = activeId ? households.find((h) => h.id === activeId)?.name ?? null : null;
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | 'income' | 'expense' | 'transfer'>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    // 활성 컨텍스트가 모임이면 그 모임만, 아니면 개인만 (헤더 우상단의 컨텍스트가 단일 진실 소스)
    if (activeId) params.set('household_id', activeId);
    else params.set('scope', 'personal');
    params.set('limit', '50');
    const [txRes, catRes, pmRes] = await Promise.all([
      fetch('/api/transactions?' + params.toString()).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/payment-methods').then((r) => r.json()),
    ]);
    setRows(txRes?.data?.rows ?? []);
    setTotal(txRes?.data?.total ?? 0);
    setCategories(catRes?.data ?? []);
    setPaymentMethods(pmRes?.data ?? []);
    setSelected(new Set());
    setLoading(false);
  }, [q, type, activeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(row: Row) {
    if (!confirm(`이 거래를 삭제할까요?\n${row.merchant_name ?? ''} ${row.amount?.toLocaleString?.() ?? ''}원`)) return;
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
    if (!confirm(`선택한 ${selected.size}건을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBulkPending(true);
    try {
      const res = await fetch('/api/transactions/delete-bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j?.error?.message ?? '일괄 삭제 실패');
        return;
      }
      const deleted = j?.data?.deleted ?? 0;
      const skipped = j?.data?.skipped ?? 0;
      if (skipped > 0) {
        alert(`${deleted}건 삭제 · ${skipped}건은 권한이 없어 건너뜀(다른 가족이 만든 거래)`);
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
          {activeName ? `${activeName} (모임비)` : '개인 가계부'} 거래내역
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

      {!loading && rows.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-pageBackground/95 backdrop-blur border-b border-borderSoft md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-0 md:border-0">
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
                onClick={bulkDelete}
                disabled={bulkPending || selected.size === 0}
                variant="danger"
              >
                {selected.size > 0 ? `선택 ${selected.size}건 삭제` : '일괄 삭제 (선택 필요)'}
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-textMuted">
            본인이 만든 거래만 삭제됩니다. 다른 멤버가 만든 모임비 거래는 자동으로 제외됩니다.
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
              rows={rows}
              onEdit={(r) => {
                setEditing(r);
                setEditorOpen(true);
              }}
              onDelete={onDelete}
              selectedIds={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          </div>
          <div className="md:hidden">
            <TransactionCardList
              rows={rows}
              onEdit={(r) => {
                setEditing(r);
                setEditorOpen(true);
              }}
              onDelete={onDelete}
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
