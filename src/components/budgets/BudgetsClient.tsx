'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { BudgetBar } from './BudgetBar';
import { formatKRW, formatKRWInput, parseKRWInput } from '@/lib/formatting/money';
import { useActiveHousehold } from '@/lib/active-household';

type Category = { id: string; name: string; color: string | null; type: string };
type Budget = {
  id: string;
  category_id: string | null;
  month_start: string;
  amount: number;
  alert_threshold: number;
  memo: string | null;
  household_id: string | null;
  categories?: { name: string; color: string | null } | null;
};
type ExpandTx = {
  id: string;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  category_id: string | null;
  categories?: { name: string } | null;
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
  const { activeId, households } = useActiveHousehold();
  const activeName = activeId ? households.find((h) => h.id === activeId)?.name ?? null : null;
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

  // 카드 클릭 시 그 카테고리(또는 전체) 의 이번 달 거래 펼침
  // 키: 카테고리는 b.id, 전체는 'total'
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [txCache, setTxCache] = useState<Record<string, ExpandTx[]>>({});
  const [txLoading, setTxLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    // 서버는 쿠키(active_household_id)로 컨텍스트 인지. activeId 변경 시 reload만 트리거.
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
  }, [ym, activeId]);

  useEffect(() => {
    load();
    // 월 변경 또는 모임 전환 시 펼침/캐시 초기화
    setExpandedKey(null);
    setTxCache({});
    setTxLoading({});
  }, [load]);

  /**
   * 카드 클릭 → 거래내역 펼침/접기.
   * 첫 펼침 시 /api/transactions 호출하여 그 달 + 카테고리 (또는 전체) 거래 list fetch.
   */
  function monthRange(ym: string): { from: string; to: string } {
    const [y, m] = ym.split('-').map(Number);
    const fromD = new Date(Date.UTC(y, m - 1, 1));
    const toD = new Date(Date.UTC(y, m, 0)); // 다음달 0일 = 그달 마지막일
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return { from: fmt(fromD), to: fmt(toD) };
  }

  async function ensureTxLoaded(key: string, categoryId: string | null) {
    if (txCache[key]) return;
    setTxLoading((s) => ({ ...s, [key]: true }));
    try {
      const { from, to } = monthRange(ym);
      const params = new URLSearchParams({
        from,
        to,
        type: 'expense',
        limit: '200',
      });
      if (categoryId) params.set('category_id', categoryId);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();
      const rows = (json?.data?.rows ?? json?.data ?? []) as ExpandTx[];
      setTxCache((s) => ({ ...s, [key]: rows }));
    } catch {
      setTxCache((s) => ({ ...s, [key]: [] }));
    } finally {
      setTxLoading((s) => ({ ...s, [key]: false }));
    }
  }

  function toggleExpand(key: string, categoryId: string | null) {
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    void ensureTxLoaded(key, categoryId);
  }

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
    setAmountStr(formatKRWInput(b.amount));
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
        <h2 className="text-2xl font-semibold text-textPrimary">
          {activeName ? `${activeName} (모임)` : '개인 가계부'} 예산
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            className="h-10 px-3 rounded-lg border border-borderDefault bg-pageBackground text-sm text-textPrimary"
          />
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.75} /> 예산 추가
          </Button>
        </div>
      </div>

      {/*
       * 사용자 명령 (2026-05-08): 전체 예산 설정 → 카테고리 합산으로 자동화.
       *  - 모달의 '전체' 버튼 제거 — 신규 전체 예산 생성 불가.
       *  - grid 에서 category_id IS NULL 인 row 를 필터링 — 화면에 '전체' 항목 안 보임.
       *  - 기존 전체 row 는 DB 에 그대로 남지만 calendarService 는 더 이상 조회 안 함.
       *    필요 시 사용자가 /budgets API 또는 직접 삭제.
       */}

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
          {budgets.filter((b) => b.category_id !== null).map((b) => {
            const prog = b.category_id
              ? progressItems.find((p) => p.category_id === b.category_id)
              : progressTotal;
            const expanded = expandedKey === b.id;
            return (
              <li key={b.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(b.id, b.category_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(b.id, b.category_id);
                    }
                  }}
                  aria-expanded={expanded}
                  className="!p-2.5 sm:!p-3 cursor-pointer hover:bg-softPinkBackground/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-left flex-1">
                      <CardTitle className="!text-sm truncate inline-flex items-center gap-1">
                        {b.category_id ? b.categories?.name ?? '카테고리' : '전체'}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          strokeWidth={1.75}
                        />
                      </CardTitle>
                      <CardSubtle className="!text-[11px] mt-0.5">
                        한도 {formatKRW(b.amount)} · 알림 {Math.round(b.alert_threshold * 100)}%
                      </CardSubtle>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(b);
                        }}
                        aria-label="수정"
                        className="!h-7 !w-7 !px-0"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(b);
                        }}
                        aria-label="삭제"
                        className="!h-7 !w-7 !px-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                  {prog ? (
                    <div className="mt-1.5">
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
                    <CardSubtle className="!text-[11px] mt-1.5">사용 내역이 아직 없어요.</CardSubtle>
                  )}
                  {b.memo && <p className="mt-1.5 text-[11px] text-textMuted">{b.memo}</p>}
                  {expanded && (
                    <ExpandedTxList
                      loading={txLoading[b.id]}
                      rows={txCache[b.id]}
                      showCategory={!b.category_id}
                    />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? '예산 수정' : '예산 추가'}>
        <div className="space-y-3">
          {/*
           * scope 토글의 '전체' 버튼 제거 (사용자 명령 2026-05-08).
           * 신규 예산은 항상 '카테고리별'. 전체 예산은 캘린더에서 카테고리 합산으로 자동.
           */}
          <div className="text-xs text-textMuted">
            카테고리별 예산을 입력하세요. 캘린더 헤더의 전체 예산은 입력값 합산으로 자동 표시됩니다.
          </div>

          {scope === 'category' && (
            <label className="block">
              <span className="text-xs text-textSecondary">카테고리</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={!!editingId}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
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
              onChange={(e) => setAmountStr(formatKRWInput(e.target.value))}
              placeholder="예: 300,000"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
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
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
            />
            <span className="block mt-1 text-xs text-textMuted">사용률이 이 값을 넘으면 ‘주의’로 표시됩니다.</span>
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">메모 (선택)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
          </label>

          <p className="text-xs text-textMuted">
            현재 컨텍스트: <b className="text-textPrimary">{activeName ? `${activeName} (모임)` : '개인 가계부'}</b>{' '}
            — 다른 컨텍스트로 매기려면 우상단 전환기에서 바꾸세요.
          </p>

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

/**
 * 카드 펼쳤을 때 표시되는 거래 list.
 * - loading 중: 스피너
 * - 빈 결과: 안내문
 * - rows: 거래내역 (최신순, 그 달 한정)
 * - showCategory: 전체 예산 카드일 때 카테고리명도 함께 표시
 */
function ExpandedTxList({
  loading,
  rows,
  showCategory,
}: {
  loading?: boolean;
  rows?: ExpandTx[];
  showCategory: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-4 pt-3 border-t border-borderSoft flex items-center gap-2 text-xs text-textMuted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
        거래 불러오는 중…
      </div>
    );
  }
  const list = rows ?? [];
  if (list.length === 0) {
    return (
      <div className="mt-4 pt-3 border-t border-borderSoft text-xs text-textMuted text-center py-3">
        이번 달 거래가 없어요.
      </div>
    );
  }
  return (
    <div className="mt-4 pt-3 border-t border-borderSoft">
      <div className="text-xs text-textSecondary mb-2">
        이번 달 거래 ({list.length}건)
      </div>
      <ul className="space-y-1.5 max-h-[320px] overflow-y-auto">
        {list.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 text-xs rounded-md bg-pageBackground border border-borderSoft px-2.5 py-1.5"
          >
            <span className="text-textMuted shrink-0 w-12">{t.transaction_date.slice(5)}</span>
            <span className="text-textPrimary font-medium truncate flex-1">
              {t.merchant_name || '(이름 없음)'}
            </span>
            {showCategory && (
              <span className="text-textMuted shrink-0">
                {t.categories?.name ?? '미분류'}
              </span>
            )}
            <span className="text-textPrimary font-semibold shrink-0">
              -{t.amount.toLocaleString('ko-KR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
