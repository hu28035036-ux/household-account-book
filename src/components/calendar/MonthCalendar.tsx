'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils/cn';
import { formatKRW } from '@/lib/formatting/money';

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
  category_name: string | null;
  category_color: string | null;
  payment_method_name: string | null;
};

type Props = {
  yearMonth: string; // YYYY-MM
  daily: DailyBucket[];
  recentByDate: Record<string, Tx[]>;
  totals: { expense: number; income: number; balance: number };
  budget: { total: number; usedPct: number; remaining: number };
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function ymOffset(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
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

export function MonthCalendar({ yearMonth, daily, recentByDate, totals, budget }: Props) {
  const today = todayKSTYMD();
  const [selected, setSelected] = useState<string | null>(null); // 한 줄 리스트 필터용

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

  const visibleRows = useMemo(() => {
    if (!selected) return flatRecent.slice(0, 50);
    return flatRecent.filter((r) => r.date === selected);
  }, [flatRecent, selected]);

  const prevYM = ymOffset(yearMonth, -1);
  const nextYM = ymOffset(yearMonth, 1);
  const overBudget = budget.remaining < 0;
  const usedPct = Math.min(100, budget.usedPct);

  return (
    <div className="space-y-4">
      {/* ① 최상단: 남은 예산 강조 */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
        </div>

        {budget.total > 0 ? (
          <div className="mt-4">
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
                <CardSubtle>이번 달 지출 / 예산</CardSubtle>
                <div className="mt-1 text-sm text-textSecondary tabular">
                  <span className="text-expense">{formatKRW(totals.expense)}</span>
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
            {/* 진행 바 */}
            <div className="mt-3 h-2.5 rounded-full bg-borderSoft overflow-hidden">
              <div
                className={cn(
                  'h-full transition-[width]',
                  overBudget ? 'bg-danger' : usedPct >= 80 ? 'bg-warning' : 'bg-primaryPink',
                )}
                style={{ width: `${overBudget ? 100 : usedPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <CardSubtle>이번 달 예산이 설정되지 않았습니다.</CardSubtle>
            <Link href="/budgets" className="mt-2 inline-block text-sm text-textPinkStrong hover:underline">
              예산 설정하기 →
            </Link>
          </div>
        )}
      </Card>

      {/* ② 캘린더 그리드 */}
      <Card className="p-2 sm:p-3">
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
            return (
              <button
                key={c.date}
                type="button"
                onClick={() => setSelected((s) => (s === c.date ? null : c.date!))}
                className={cn(
                  // 반응형 3단계 — 모바일 / 태블릿(sm) / 데스크톱(md)
                  'h-20 sm:h-24 md:h-28 p-0.5 sm:p-1 md:p-1.5 rounded-md border text-left flex flex-col gap-0.5 transition-colors overflow-hidden',
                  isSelected
                    ? 'border-primaryPink bg-primaryPinkSoft'
                    : isToday
                    ? 'border-primaryPinkBorder bg-pageBackground'
                    : 'border-borderSoft bg-pageBackground hover:bg-softPinkBackground',
                  (dow === 0 || dow === 6) && !isSelected && 'bg-sectionBackground',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-[11px] sm:text-xs font-semibold',
                      dow === 0 ? 'text-danger' : dow === 6 ? 'text-info' : 'text-textPrimary',
                      isToday && 'text-textPinkStrong',
                    )}
                  >
                    {c.day}
                  </span>
                  {bucket && bucket.count > 0 && (
                    <span className="text-[9px] sm:text-[10px] tabular text-textMuted">
                      {bucket.count}
                    </span>
                  )}
                </div>
                {bucket && bucket.expense > 0 && (
                  <div className="text-[9px] sm:text-[10px] md:text-[11px] tabular text-expense whitespace-nowrap leading-tight">
                    -{bucket.expense.toLocaleString('ko-KR')}
                  </div>
                )}
                {bucket && bucket.income > 0 && (
                  <div className="text-[9px] sm:text-[10px] md:text-[11px] tabular text-income whitespace-nowrap leading-tight">
                    +{bucket.income.toLocaleString('ko-KR')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ③ 이번 달 수입/지출/잔액 합계 */}
      <Card>
        <CardSubtle className="m-0">이번 달 합계</CardSubtle>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <div className="text-xs text-textSecondary">수입</div>
            <div className="mt-0.5 text-base sm:text-lg font-semibold tabular text-income whitespace-nowrap">
              +{formatKRW(totals.income)}
            </div>
          </div>
          <div>
            <div className="text-xs text-textSecondary">지출</div>
            <div className="mt-0.5 text-base sm:text-lg font-semibold tabular text-expense whitespace-nowrap">
              -{formatKRW(totals.expense)}
            </div>
          </div>
          <div>
            <div className="text-xs text-textSecondary">잔액</div>
            <div
              className={cn(
                'mt-0.5 text-base sm:text-lg font-semibold tabular whitespace-nowrap',
                totals.balance < 0 ? 'text-danger' : 'text-textPinkStrong',
              )}
            >
              {totals.balance < 0 ? '-' : '+'}
              {formatKRW(Math.abs(totals.balance))}
            </div>
          </div>
        </div>
      </Card>

      {/* ④ 최근 거래내역 한 줄 리스트 */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>
            {selected
              ? `${selected.slice(5).replace('-', '월 ')}일 거래`
              : '최근 거래내역'}
          </CardTitle>
          <div className="flex items-center gap-2">
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
          <ul className="mt-3 divide-y divide-divider">
            {visibleRows.map((t) => (
              <li
                key={t.id}
                className="py-1.5 flex items-center gap-3 min-w-0 text-sm"
              >
                <span className="tabular text-xs text-textMuted w-12 shrink-0">{t.date.slice(5)}</span>
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.category_color ?? '#F472B6' }}
                />
                <span className="text-textPrimary truncate flex-1">
                  {t.merchant_name || t.category_name || '거래'}
                </span>
                <span className="text-xs text-textMuted truncate hidden sm:inline max-w-[110px]">
                  {t.category_name ?? '미지정'}
                </span>
                <span className="text-xs text-textMuted truncate hidden md:inline max-w-[100px]">
                  {t.payment_method_name ?? '미지정'}
                </span>
                <span
                  className={cn(
                    'tabular font-medium whitespace-nowrap min-w-[80px] text-right',
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
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
