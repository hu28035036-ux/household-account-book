'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { TransactionTable } from './TransactionTable';
import { TransactionCardList } from './TransactionCardList';
import { TransactionEditor } from './TransactionEditor';

type Row = any;

export function TransactionsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | 'income' | 'expense' | 'transfer'>('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
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
    setLoading(false);
  }, [q, type]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(row: Row) {
    if (!confirm(`이 거래를 삭제할까요?\n${row.merchant_name ?? ''} ${row.amount?.toLocaleString?.() ?? ''}원`)) return;
    const res = await fetch(`/api/transactions/${row.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">거래내역</h2>
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

      <div className="text-xs text-textSecondary">총 {total}건</div>

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
