'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { TransactionEditor } from '@/components/transactions/TransactionEditor';
import { cn } from '@/lib/utils/cn';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';

type DailyBucket = {
  date: string;
  expense: number;
  income: number;
  count: number;
};

type Tx = {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  memo: string | null;
  household_id: string | null;
  recurring_rule_id: string | null;
};

type CategoryBudget = {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  budget_amount: number;
  spent_amount: number;
  percent: number;
  status: 'safe' | 'caution' | 'over';
};

type Props = {
  yearMonth: string; // YYYY-MM
  daily: DailyBucket[];
  recentByDate: Record<string, Tx[]>;
  totals: { expense: number; income: number; balance: number };
  budget: { total: number; usedPct: number; remaining: number };
  categoryBudgets: CategoryBudget[];
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function ymOffset(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
/** 셀 안 금액은 천 단위 콤마 숫자로만 표시 — '만' 같은 한글 단위 X (사용자 요구) */
function __numFmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 거래내역 그룹 헤더용 — "6월 28일 (일)" */
function formatDateHeader(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  const dowKr = ['일', '월', '화', '수', '목', '금', '토'][dow];
  return `${m}월 ${d}일 (${dowKr})`;
}

function todayKSTYMD(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

export function MonthCalendar({
  yearMonth,
  daily,
  recentByDate,
  totals,
  budget,
  categoryBudgets,
}: Props) {
  const today = todayKSTYMD();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null); // 한 줄 리스트 필터용
  const [categoryFilter, setCategoryFilter] = useState<string>(''); // '' = 전체
  const [createTxDate, setCreateTxDate] = useState<string | null>(null);

  // 상세 팝업 + 수정 모달 state
  const [selectedTx, setSelectedTx] = useState<(Tx & { date: string }) | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPending, setEditorPending] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);

  // 거래 수정 모달용 categories / payment-methods — 마운트 시 1회 fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catRes, pmRes] = await Promise.all([
        fetch('/api/categories').then((r) => r.json()).catch(() => ({})),
        fetch('/api/payment-methods').then((r) => r.json()).catch(() => ({})),
      ]);
      if (cancelled) return;
      setCategories(catRes?.data ?? []);
      setPaymentMethods(pmRes?.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dailyMap = useMemo(() => {
    const m: Record<string, DailyBucket> = {};
    for (const d of daily) m[d.date] = d;
    return m;
  }, [daily]);

  const cells = useMemo(() => {
    const [y, mm] = yearMonth.split('-').map(Number);
    const firstDow = new Date(Date.UTC(y, mm - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    const arr: { date: string | null; day: number | null }[] = [];
    for (let i = 0; i < firstDow; i++) arr.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ date: `${yearMonth}-${pad2(d)}`, day: d });
    }
    while (arr.length % 7 !== 0) arr.push({ date: null, day: null });
    return arr;
  }, [yearMonth]);

  // 이번 달 모든 거래를 한 줄 리스트로 (최신 날짜 → 오래된 날짜)
  const flatRecent = useMemo(() => {
    const dates = Object.keys(recentByDate).sort((a, b) => (a < b ? 1 : -1));
    const rows: Array<Tx & { date: string }> = [];
    for (const d of dates) {
      for (const t of recentByDate[d]) rows.push({ ...t, date: d });
    }
    return rows;
  }, [recentByDate]);

  // 카테고리 필터 옵션 — flatRecent 의 unique categories (이름 기준)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of flatRecent) {
      if (r.category_name) set.add(r.category_name);
    }
    return Array.from(set).sort();
  }, [flatRecent]);

  const visibleRows = useMemo(() => {
    let rows = flatRecent;
    if (selected) rows = rows.filter((r) => r.date === selected);
    if (categoryFilter) rows = rows.filter((r) => (r.category_name ?? '') === categoryFilter);
    if (!selected && !categoryFilter) return rows.slice(0, 50);
    return rows;
  }, [flatRecent, selected, categoryFilter]);

  // 같은 날짜끼리 묶어 날짜는 한 번만 표시 (visibleRows 는 날짜 내림차순)
  const groupedRows = useMemo(() => {
    const groups: Array<{ date: string; items: Array<Tx & { date: string }> }> = [];
    for (const r of visibleRows) {
      const last = groups[groups.length - 1];
      if (last && last.date === r.date) last.items.push(r);
      else groups.push({ date: r.date, items: [r] });
    }
    return groups;
  }, [visibleRows]);

  async function handleDelete() {
    if (!selectedTx) return;
    if (
      !confirm(
        `${selectedTx.merchant_name ?? ''} ${formatKRW(selectedTx.amount)} 거래를 삭제할까요? 되돌릴 수 없습니다.`,
      )
    )
      return;
    setEditorPending(true);
    try {
      const res = await fetch(`/api/transactions/${selectedTx.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`삭제 실패: ${j?.error?.message ?? res.statusText}`);
        return;
      }
      setSelectedTx(null);
      router.refresh();
    } finally {
      setEditorPending(false);
    }
  }

  function openCreateTransaction(date: string) {
    setSelected(date);
    setSelectedTx(null);
    setEditorOpen(false);
    setCreateTxDate(date);
  }

  function handleDateKeyDown(date: string, e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected((s) => (s === date ? null : date));
    }
  }

  const prevYM = ymOffset(yearMonth, -1);
  const nextYM = ymOffset(yearMonth, 1);
  const overBudget = budget.remaining < 0;
  const usedPct = Math.min(100, budget.usedPct);

  return (
    <div className="space-y-4">
      {/* ① 최상단: 남은 예산 강조 */}
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              href={`?ym=${prevYM}`}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault hover:bg-softPinkBackground"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <CardTitle className="px-2">{yearMonth.replace('-', '년 ')}월</CardTitle>
            <Link
              href={`?ym=${nextYM}`}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-borderDefault hover:bg-softPinkBackground"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
          {/* 이번 달 합계 — 날짜 옆 우측 상단에 한 줄씩 작게 */}
          <div className="flex flex-col items-end gap-0.5 ml-auto text-[10px] leading-tight tabular">
            <div className="whitespace-nowrap">
              <span className="text-textSecondary">수입 </span>
              <span className="font-semibold text-income">+{formatKRW(totals.income)}</span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-textSecondary">지출 </span>
              <span className="font-semibold text-expense">-{formatKRW(totals.expense)}</span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-textSecondary">잔액 </span>
              <span
                className={cn(
                  'font-semibold',
                  totals.balance < 0 ? 'text-danger' : 'text-textPinkStrong',
                )}
              >
                {totals.balance < 0 ? '-' : '+'}
                {formatKRW(Math.abs(totals.balance))}
              </span>
            </div>
          </div>
        </div>

        {budget.total > 0 ? (
          <BudgetCarousel
            budget={budget}
            usedPct={usedPct}
            overBudget={overBudget}
            categoryBudgets={categoryBudgets}
          />
        ) : (
          <div className="mt-4">
            <CardSubtle>이번 달 카테고리별 예산이 설정되지 않았습니다.</CardSubtle>
            <p className="mt-1 text-xs text-textMuted">
              카테고리별로 예산을 설정하면 합산이 자동으로 계산됩니다.
            </p>
            <Link href="/budgets" className="mt-2 inline-block text-sm text-textPinkStrong hover:underline">
              카테고리별 예산 설정하기 →
            </Link>
          </div>
        )}
      </Card>

      {/* ② 캘린더 그리드 */}
      <Card className="p-2 sm:p-3">
        {/* 캘린더 헤더 — 이번 달 총 지출 강조 */}
        <div className="px-1.5 sm:px-2 pb-2 mb-1.5 border-b border-borderSoft flex items-baseline justify-between gap-2">
          <div>
            <span className="text-xs text-textSecondary">이번 달 총 지출</span>
          </div>
          <div className="text-lg sm:text-xl font-bold tabular text-expense">
            -{formatKRW(totals.expense)}
          </div>
        </div>

        <div className="grid grid-cols-7 text-xs text-textSecondary">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div
              key={d}
              className={cn(
                'text-center py-1.5 font-medium',
                i === 0 && 'text-danger',
                i === 6 && 'text-info',
              )}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {cells.map((c, idx) => {
            if (!c.date) return <div key={idx} className="h-20 sm:h-24 md:h-28" />;
            const bucket = dailyMap[c.date];
            const isToday = c.date === today;
            const isSelected = c.date === selected;
            const dow = new Date(c.date + 'T00:00:00Z').getUTCDay();

            // 그날 expense 거래를 카테고리별로 집계 (색깔별 합산)
            const dayTxs = recentByDate[c.date] ?? [];
            const byCat: Record<
              string,
              { color: string; name: string; amount: number }
            > = {};
            for (const t of dayTxs) {
              if (t.type !== 'expense') continue;
              const color = t.category_color ?? '#9CA3AF';
              const name = t.category_name ?? '미분류';
              const key = name + '|' + color;
              if (!byCat[key]) byCat[key] = { color, name, amount: 0 };
              byCat[key].amount += Number(t.amount) || 0;
            }
            const catList = Object.values(byCat).sort((a, b) => b.amount - a.amount);
            // 모바일: 1개 + 2+, 태블릿(sm): 2개 + N
            const mobileVisible = catList.slice(0, 1);
            const smVisible = catList.slice(0, 2);
            const mobileOverflow = Math.max(0, catList.length - mobileVisible.length);
            const smOverflow = Math.max(0, catList.length - smVisible.length);

            return (
              <div
                key={c.date}
                data-calendar-date={c.date}
                role="button"
                tabIndex={0}
                onClick={() => setSelected((s) => (s === c.date ? null : c.date!))}
                onKeyDown={(e) => handleDateKeyDown(c.date!, e)}
                aria-label={`${c.date} 거래 보기`}
                className={cn(
                  'h-20 sm:h-24 md:h-28 p-0.5 sm:p-1 md:p-1.5 rounded-md border text-left flex flex-col gap-0.5 transition-colors overflow-hidden cursor-pointer',
                  isSelected
                    ? 'border-primaryPink bg-primaryPinkSoft'
                    : isToday
                    ? 'border-primaryPinkBorder bg-pageBackground'
                    : 'border-borderSoft bg-pageBackground hover:bg-softPinkBackground',
                  (dow === 0 || dow === 6) && !isSelected && 'bg-sectionBackground',
                )}
              >
                {/* 1행 — 날짜 */}
                <div className="flex items-center gap-0.5">
                  <span
                    className={cn(
                      'text-[11px] sm:text-xs font-semibold',
                      dow === 0 ? 'text-danger' : dow === 6 ? 'text-info' : 'text-textPrimary',
                      isToday && 'text-textPinkStrong',
                    )}
                  >
                    {c.day}
                  </span>
                </div>
                {/* 2행 — 총 지출 (강조) */}
                {bucket && bucket.expense > 0 ? (
                  <div className="text-[10px] sm:text-[11px] md:text-xs tabular font-semibold text-expense whitespace-nowrap leading-tight">
                    -{__numFmt(bucket.expense)}
                  </div>
                ) : (
                  <div className="h-3" />
                )}

                {/* 카테고리별 지출 금액 — 점 없음, 숫자가 카테고리 색깔로 표시 */}
                {/* 모바일 */}
                <div className="sm:hidden flex flex-col gap-0.5 mt-auto">
                  {mobileVisible.map((c2) => (
                    <div
                      key={c2.name}
                      className="text-[9px] tabular font-medium whitespace-nowrap truncate leading-tight"
                      style={{ color: c2.color }}
                    >
                      {__numFmt(c2.amount)}
                    </div>
                  ))}
                  {mobileOverflow > 0 && (
                    <span className="text-[8px] tabular text-textMuted">
                      +{mobileOverflow}개
                    </span>
                  )}
                </div>
                {/* 태블릿 / 데스크톱 */}
                <div className="hidden sm:flex sm:flex-col gap-0.5 mt-auto">
                  {smVisible.map((c2) => (
                    <div
                      key={c2.name}
                      className="flex items-center gap-1 leading-tight tabular text-[10px] md:text-[11px] font-medium"
                      style={{ color: c2.color }}
                    >
                      <span className="truncate">{c2.name}</span>
                      <span className="ml-auto whitespace-nowrap">{__numFmt(c2.amount)}</span>
                    </div>
                  ))}
                  {smOverflow > 0 && (
                    <span className="text-[9px] md:text-[10px] tabular text-textMuted">
                      +{smOverflow}개
                    </span>
                  )}
                </div>

                {/* 수입 — 마지막 줄 (있을 때만) */}
                {bucket && bucket.income > 0 && (
                  <div className="text-[9px] sm:text-[10px] tabular text-income whitespace-nowrap leading-tight">
                    +{__numFmt(bucket.income)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* (카테고리별 예산 카드는 상단 캐러셀로 이동 — 중복 제거)
          (이번 달 합계는 상단 월 카드 헤더 우측으로 이동 — 중복 제거) */}

      {/* ④ 최근 거래내역 한 줄 리스트 */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>
            {selected
              ? `${selected.slice(5).replace('-', '월 ')}일 거래`
              : '최근 거래내역'}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="카테고리 필터"
              className="h-8 min-w-0 max-w-[140px] px-2 rounded-md border border-borderDefault bg-pageBackground text-xs text-textPrimary"
            >
              <option value="">전체 카테고리</option>
              {categoryOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span className="text-xs text-textMuted">
              {selected ? `${visibleRows.length}건` : `이번 달 최신 ${visibleRows.length}건`}
            </span>
            {selected && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                전체 보기
              </Button>
            )}
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <CardSubtle className="mt-3">
            {selected ? '이 날의 거래가 없습니다.' : '이번 달 거래가 없습니다.'}
          </CardSubtle>
        ) : (
          <div className="mt-3">
            {groupedRows.map((g, gi) => {
              // 그날 총 사용금액 = 지출 합계 (수입/이체 제외)
              const dayExpense = g.items.reduce(
                (s, t) => s + (t.type === 'expense' ? Number(t.amount) || 0 : 0),
                0,
              );
              return (
              <div
                key={g.date}
                className={cn(gi > 0 && 'mt-3 pt-3 border-t border-borderDefault')}
              >
                {/* 날짜 헤더 — 같은 날은 한 번만, 우측에 그날 총 사용금액 */}
                <div className="flex items-center justify-between gap-2 mb-0.5 px-0.5">
                  <span className="text-xs font-medium text-textSecondary">
                    {formatDateHeader(g.date)}
                  </span>
                  {dayExpense > 0 && (
                    <span className="text-xs font-semibold tabular text-expense whitespace-nowrap">
                      -{formatKRW(dayExpense)}
                    </span>
                  )}
                </div>
                <ul>
                  {g.items.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTx(t)}
                        aria-label="거래 상세 보기"
                        className="w-full py-2 flex items-center gap-2 sm:gap-3 min-w-0 text-sm text-left hover:bg-softPinkBackground/40 -mx-2 px-2 rounded-md transition-colors"
                      >
                        {/* 카테고리 (점 + 이름) — 모바일도 표시 */}
                        <span className="flex items-center gap-1 shrink-0 max-w-[80px] sm:max-w-[110px]">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: t.category_color ?? '#9CA3AF' }}
                          />
                          <span className="text-xs text-textMuted truncate">
                            {t.category_name ?? '미지정'}
                          </span>
                        </span>
                        {/* 거래내역 (가맹점) */}
                        <span className="text-textPrimary truncate flex-1 min-w-0">
                          {t.merchant_name || '(가맹점 없음)'}
                        </span>
                        {/* 결제수단 — 데스크톱만 */}
                        <span className="text-xs text-textMuted truncate hidden md:inline max-w-[100px]">
                          {t.payment_method_name ?? ''}
                        </span>
                        {/* 금액 */}
                        <span
                          className={cn(
                            'tabular font-semibold whitespace-nowrap min-w-[80px] text-right',
                            t.type === 'income'
                              ? 'text-income'
                              : t.type === 'transfer'
                              ? 'text-transfer'
                              : 'text-expense',
                          )}
                        >
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                          {formatKRW(t.amount)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 거래 상세 팝업 — 행 클릭 시 표시. 수정·삭제 액션 포함 */}
      {selectedTx && !editorOpen && (
        <Modal
          open
          onClose={() => setSelectedTx(null)}
          title="거래 상세"
        >
          <div className="space-y-2 text-sm">
            <Row label="날짜">{formatDateKST(selectedTx.date)}</Row>
            <Row label="가맹점">{selectedTx.merchant_name || '(가맹점 없음)'}</Row>
            <Row label="금액">
              <span
                className={cn(
                  'tabular font-semibold',
                  selectedTx.type === 'income'
                    ? 'text-income'
                    : selectedTx.type === 'transfer'
                    ? 'text-transfer'
                    : 'text-expense',
                )}
              >
                {selectedTx.type === 'income'
                  ? '+'
                  : selectedTx.type === 'expense'
                  ? '-'
                  : ''}
                {formatKRW(selectedTx.amount)}
              </span>
            </Row>
            <Row label="카테고리">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedTx.category_color ?? '#9CA3AF' }}
                />
                {selectedTx.category_name ?? '미지정'}
              </span>
            </Row>
            <Row label="결제수단">{selectedTx.payment_method_name ?? '-'}</Row>
          </div>
          <div className="mt-4 flex items-center justify-end gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedTx(null)}
              disabled={editorPending}
              className="!h-8 !px-2.5 !text-xs"
            >
              닫기
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={editorPending}
              className="!h-8 !px-2.5 !text-xs text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              삭제
            </Button>
            <Button
              size="sm"
              onClick={() => setEditorOpen(true)}
              disabled={editorPending}
              className="!h-8 !px-2.5 !text-xs"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              수정
            </Button>
          </div>
        </Modal>
      )}

      {/* 거래 수정 — TransactionEditor 재사용. onSaved 후 SSR 페이지 갱신.
          기존 카테고리/결제수단/메모/household 가 빈 값으로 덮어쓰이지 않도록 전체 필드 전달. */}
      {selectedTx && (
        <TransactionEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          initial={{
            id: selectedTx.id,
            transaction_date: selectedTx.date,
            type: selectedTx.type,
            amount: selectedTx.amount,
            merchant_name: selectedTx.merchant_name,
            category_id: selectedTx.category_id,
            payment_method_id: selectedTx.payment_method_id,
            memo: selectedTx.memo,
            household_id: selectedTx.household_id,
            recurring_rule_id: selectedTx.recurring_rule_id,
          }}
          categories={categories}
          paymentMethods={paymentMethods}
          onSaved={() => {
            setEditorOpen(false);
            setSelectedTx(null);
            router.refresh();
          }}
        />
      )}

      {createTxDate && (
        <TransactionEditor
          open
          onClose={() => setCreateTxDate(null)}
          initial={{ transaction_date: createTxDate }}
          categories={categories}
          paymentMethods={paymentMethods}
          onSaved={() => {
            setCreateTxDate(null);
            router.refresh();
          }}
        />
      )}

      {/* 거래 추가 FAB — 화면 우하단 고정(스크롤해도 유지).
          선택한 날짜(없으면 오늘)에 거래 추가. 색상은 컬러 테마(--primary) 토큰. */}
      <button
        type="button"
        onClick={() => openCreateTransaction(selected ?? today)}
        aria-label={selected ? `${selected} 거래 추가` : '오늘 거래 추가'}
        title="거래 추가"
        className="fixed right-4 bottom-20 md:right-6 md:bottom-6 z-40 h-14 w-14 rounded-full bg-primaryPink text-textOnPink shadow-lg flex items-center justify-center hover:bg-primaryPinkHover active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaryPinkHover focus-visible:ring-offset-2"
      >
        <Plus className="h-6 w-6" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-textSecondary shrink-0">{label}</span>
      <span className="text-textPrimary text-right min-w-0 truncate">{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 예산 캐러셀 — 옆으로 스와이프해서 합산 / 카테고리별 사용량을 차례로 본다.
// 슬라이드 1: 전체 합산. 슬라이드 2~N: 각 카테고리별 사용 / 한도 / 진행률.
// CSS scroll-snap 기반 — Chrome/Samsung Internet/Safari/PC 모두 표준 지원.
// ─────────────────────────────────────────────────────────────────────────────
function BudgetCarousel({
  budget,
  usedPct,
  overBudget,
  categoryBudgets,
}: {
  budget: { total: number; usedPct: number; remaining: number };
  usedPct: number;
  overBudget: boolean;
  categoryBudgets: CategoryBudget[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  // 슬라이드 데이터 = [합산] + 카테고리별
  const slides = useMemo(
    () => [{ kind: 'total' as const }, ...categoryBudgets.map((cb) => ({ kind: 'cat' as const, cb }))],
    [categoryBudgets],
  );
  const slideCount = slides.length;
  const loop = slideCount > 1;

  // 무한 순환: 루프면 양끝에 클론 1장씩 → [last, ...실제, first]
  const display = loop ? [slides[slideCount - 1], ...slides, slides[0]] : slides;

  // 초기 위치 = 첫 실제 슬라이드 (루프면 index 1)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !loop) return;
    el.scrollLeft = el.clientWidth;
  }, [loop, slideCount]);

  // 스크롤 추적 + 클론 도달 시 반대편으로 순간이동(끊김 없는 순환)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    function onScroll() {
      if (!el) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        const pos = Math.round(el.scrollLeft / w); // display 기준 인덱스
        if (!loop) {
          setIdx(pos);
          return;
        }
        // display: 0=last 클론, 1..slideCount=실제, slideCount+1=first 클론
        if (pos === 0) {
          el.scrollLeft = slideCount * w;
          setIdx(slideCount - 1);
        } else if (pos === slideCount + 1) {
          el.scrollLeft = w;
          setIdx(0);
        } else {
          setIdx(pos - 1);
        }
      });
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [loop, slideCount]);

  // 점 클릭 → 해당 실제 슬라이드로 (루프 보정)
  function goTo(realIdx: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: (loop ? realIdx + 1 : realIdx) * w, behavior: 'smooth' });
  }

  return (
    <div className="mt-4">
      <div className="relative">
        <div
          ref={scrollerRef}
          className="overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overscrollBehaviorX: 'contain' }}
          aria-roledescription="carousel"
        >
          {display.map((s, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              className="snap-center snap-always shrink-0 w-full"
            >
              {s.kind === 'total'
                ? renderTotalSlide({ budget, usedPct, overBudget })
                : renderCatSlide(s.cb)}
            </div>
          ))}
        </div>
      </div>

      {/* 페이지 점 — 슬라이드 2개 이상일 때만 표시 */}
      {slideCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`슬라이드 ${i + 1} 로 이동`}
              aria-current={idx === i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === i ? 'w-4 bg-primaryPink' : 'w-1.5 bg-borderDefault',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function renderTotalSlide({
  budget,
  usedPct,
  overBudget,
}: {
  budget: { total: number; usedPct: number; remaining: number };
  usedPct: number;
  overBudget: boolean;
}) {
  return (
    <>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <CardSubtle>{overBudget ? '예산 초과' : '남은 예산'}</CardSubtle>
          <div
            className={cn(
              'mt-1 text-xl sm:text-2xl font-semibold tabular',
              overBudget ? 'text-danger' : 'text-textPinkStrong',
            )}
          >
            {overBudget ? '-' : ''}
            {formatKRW(Math.abs(budget.remaining))}
          </div>
        </div>
        <div className="text-right">
          <CardSubtle>카테고리 사용 / 합산 예산</CardSubtle>
          <div className="mt-1 text-sm text-textSecondary tabular">
            <span className="text-expense">{formatKRW(budget.total - budget.remaining)}</span>
            <span className="mx-1 text-textMuted">/</span>
            <span className="text-textPrimary">{formatKRW(budget.total)}</span>
          </div>
          <div
            className={cn(
              'mt-0.5 text-xs tabular',
              overBudget ? 'text-danger' : usedPct >= 80 ? 'text-warning' : 'text-success',
            )}
          >
            {budget.usedPct}% 사용
          </div>
        </div>
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-borderSoft overflow-hidden">
        <div
          className={cn(
            'h-full transition-[width]',
            overBudget ? 'bg-danger' : usedPct >= 80 ? 'bg-warning' : 'bg-primaryPink',
          )}
          style={{ width: `${overBudget ? 100 : usedPct}%` }}
        />
      </div>
    </>
  );
}

function renderCatSlide(cb: CategoryBudget) {
  const catOver = cb.status === 'over';
  const catCaution = cb.status === 'caution';
  const pct = Math.min(100, Math.max(0, cb.percent));
  return (
    <>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cb.category_color ?? '#9CA3AF' }}
            />
            <CardSubtle className="truncate">{cb.category_name}</CardSubtle>
          </div>
          {/* 카테고리 이름 아래 — 남은 예산 */}
          <div className="mt-1 text-[11px] text-textSecondary">
            {catOver ? '예산 초과' : '남은 예산'}
          </div>
          <div
            className={cn(
              'mt-0.5 text-xl sm:text-2xl font-semibold tabular',
              catOver ? 'text-danger' : catCaution ? 'text-warning' : 'text-textPinkStrong',
            )}
          >
            {catOver ? '-' : ''}
            {formatKRW(Math.abs(cb.budget_amount - cb.spent_amount))}
          </div>
        </div>
        <div className="text-right">
          <CardSubtle>사용 / 한도</CardSubtle>
          <div className="mt-1 text-sm text-textSecondary tabular">
            <span
              className={cn(
                catOver ? 'text-danger' : catCaution ? 'text-warning' : 'text-expense',
              )}
            >
              {formatKRW(cb.spent_amount)}
            </span>
            <span className="mx-1 text-textMuted">/</span>
            <span className="text-textPrimary">{formatKRW(cb.budget_amount)}</span>
          </div>
          <div
            className={cn(
              'mt-0.5 text-xs tabular',
              catOver ? 'text-danger' : catCaution ? 'text-warning' : 'text-success',
            )}
          >
            {Math.round(cb.percent)}% 사용
          </div>
        </div>
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-borderSoft overflow-hidden">
        <div
          className={cn(
            'h-full transition-[width]',
            catOver ? 'bg-danger' : catCaution ? 'bg-warning' : 'bg-primaryPink',
          )}
          style={{ width: `${catOver ? 100 : pct}%` }}
        />
      </div>
    </>
  );
}
