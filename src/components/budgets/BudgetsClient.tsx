'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { BudgetBar } from './BudgetBar';
import { formatKRW, parseKRWInput } from '@/lib/formatting/money';

type Category = { id: string; name: string; color: string | null; type: string };
type Budget = {
  id: string;
  category_id: string | null;
  month_start: string;
  amount: number;
  alert_threshold: number;
  memo: string | null;
  categories?: { name: string; color: string | null } | null;
};
type ProgressItem = {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  budget_amount: number;
  spent_amount: number;
  percent: number;
  status: 'safe' | 'caution' | 'over';
  alert_threshold: number;
};

function defaultYM(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function BudgetsClient() {
  const [ym, setYm] = useState(defaultYM());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [progressTotal, setProgressTotal] = useState<ProgressItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scope, setScope] = useState<'category' | 'total'>('category');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amountStr, setAmountStr] = useState('');
  const [thresholdPct, setThresholdPct] = useState('80');
  const [memo, setMemo] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, pRes, cRes] = await Promise.all([
      fetch(`/api/budgets?ym=${ym}`).then((r) => r.json()),
      fetch(`/api/budgets/progress?ym=${ym}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]);
    setBudgets(bRes?.data ?? []);
    setProgressItems(pRes?.data?.items ?? []);
    setProgressTotal(pRes?.data?.total ?? null);
    setCategories((cRes?.data ?? []).filter((c: Category) => c.type !== 'income'));
    setLoading(false);
  }, [ym]);

  useEffect(() => {
    load();
  }, [load]);

  const usedCategoryIds = useMemo(
    () => new Set(budgets.filter((b) => b.category_id).map((b) => b.category_id as string)),
    [budgets],
  );
  const availableCategories = useMemo(
    () => categories.filter((c) => !usedCategoryIds.has(c.id) || c.id === categoryId),
    [categories, usedCategoryIds, categoryId],
  );

  function startCreate() {
    setEditingId(null);
    setScope('category');
    setCategoryId(availableCategories[0]?.id ?? '');
    setAmountStr('');
    setThresholdPct('80');
    setMemo('');
    setSaveError(null);
    setOpen(true);
  }
  function startEdit(b: Budget) {
    setEditingId(b.id);
    setScope(b.category_id ? 'category' : 'total');
    setCategoryId(b.category_id ?? '');
    setAmountStr(String(b.amount));
    setThresholdPct(String(Math.round(b.alert_threshold * 100)));
    setMemo(b.memo ?? '');
    setSaveError(null);
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setSaveError(null);
    try {
      const amount = parseKRWInput(amountStr);
      if (amount === null || amount < 0) throw new Error('금액을 입력하세요.');
      const thrNum = Math.max(0, Math.min(100, Number(thresholdPct))) / 100;
      const body = {
        category_id: scope === 'total' ? null : categoryId || null,
        year_month: ym,
        amount,
        alert_threshold: thrNum,
        memo: memo || null,
      };
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '저장 실패');
      setOpen(false);
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setPending(false);
    }
  }

  async function remove(b: Budget) {
    if (!confirm(`${b.categories?.name ?? '전체'} 예산을 삭제할까요?`)) return;
    const res = await fetch(`/api/budgets/${b.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">예산</h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            className="h-10 px-3 rounded-lg border border-borderDefault bg-white text-sm text-textPrimary"
          />
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.75} /> 예산 추가
          </Button>
        </div>
      </div>

      {progressTotal && (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>이번 달 전체 예산</CardTitle>
            <Badge tone="muted">월 한도 {formatKRW(progressTotal.budget_amount)}</Badge>
          </div>
          <div className="mt-3">
            <BudgetBar
              name="전체"
              color={null}
              spent={progressTotal.spent_amount}
              budget={progressTotal.budget_amount}
              percent={progressTotal.percent}
              status={progressTotal.status}
              alertThreshold={progressTotal.alert_threshold}
            />
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : budgets.length === 0 ? (
        <Card>
          <CardTitle>{ym} 예산이 없어요</CardTitle>
          <CardSubtle className="mt-1">카테고리별 예산을 설정하면 진행률을 자동 추적합니다.</CardSubtle>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {budgets.map((b) => {
            const prog = b.category_id
              ? progressItems.find((p) => p.category_id === b.category_id)
              : progressTotal;
            return (
              <li key={b.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">
                        {b.category_id ? b.categories?.name ?? '카테고리' : '전체'}
                      </CardTitle>
                      <CardSubtle className="mt-0.5">
                        한도 {formatKRW(b.amount)} · 알림 {Math.round(b.alert_threshold * 100)}%
                      </CardSubtle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(b)} aria-label="수정">
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(b)} aria-label="삭제">
                        <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                  {prog ? (
                    <div className="mt-3">
                      <BudgetBar
                        name={prog.category_name}
                        color={prog.category_color}
                        spent={prog.spent_amount}
                        budget={prog.budget_amount}
                        percent={prog.percent}
                        status={prog.status}
                      />
                    </div>
                  ) : (
                    <CardSubtle className="mt-3">사용 내역이 아직 없어요.</CardSubtle>
                  )}
                  {b.memo && <p className="mt-3 text-xs text-textMuted">{b.memo}</p>}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? '예산 수정' : '예산 추가'}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScope('category')}
              className={
                'h-10 px-3 rounded-md text-sm border ' +
                (scope === 'category'
                  ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                  : 'bg-white text-textSecondary border-borderDefault')
              }
            >
              카테고리별
            </button>
            <button
              type="button"
              onClick={() => setScope('total')}
              className={
                'h-10 px-3 rounded-md text-sm border ' +
                (scope === 'total'
                  ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                  : 'bg-white text-textSecondary border-borderDefault')
              }
            >
              전체
            </button>
          </div>

          {scope === 'category' && (
            <label className="block">
              <span className="text-xs text-textSecondary">카테고리</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={!!editingId}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
              >
                {availableCategories.length === 0 ? (
                  <option value="">사용 가능한 카테고리 없음</option>
                ) : (
                  availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-xs text-textSecondary">월 예산 (원)</span>
            <input
              type="text"
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="예: 300,000"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary tabular"
            />
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">알림 임계치 (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary tabular"
            />
            <span className="block mt-1 text-xs text-textMuted">사용률이 이 값을 넘으면 ‘주의’로 표시됩니다.</span>
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">메모 (선택)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-borderDefault bg-white text-textPrimary"
            />
          </label>

          {saveError && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{saveError}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
