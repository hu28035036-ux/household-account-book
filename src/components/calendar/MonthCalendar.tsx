'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
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
  const [selected, setSelected] = useState<string | null>(null);

  const dailyMap = useMemo(() => {
    const m: Record<string, DailyBucket> = {};
    for (const d of daily) m[d.date] = d;
    return m;
  }, [daily]);

  const cells = useMemo(() => {
    const [y, mm] = yearMonth.split('-').map(Number);
    const firstDow = new Date(Date.UTC(y, mm - 1, 1)).getUTCDay(); // 0=일
    const daysInMonth = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    const arr: { date: string | null; day: number | null }[] = [];
    // 앞 빈 칸 (일요일 시작)
    for (let i = 0; i < firstDow; i++) arr.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ date: `${yearMonth}-${pad2(d)}`, day: d });
    }
    // 6주 그리드 채우기
    while (arr.length % 7 !== 0) arr.push({ date: null, day: null });
    return arr;
  }, [yearMonth]);

  const prevYM = ymOffset(yearMonth, -1);
  const nextYM = ymOffset(yearMonth, 1);
  const overBudget = budget.remaining < 0;

  const selectedTxs = selected ? recentByDate[selected] ?? [] : [];

  return (
    <div className="space-y-4">
      {/* 헤더: 월 네비게이션 + KPI */}
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
          {budget.total > 0 ? (
            <Badge tone={overBudget ? 'danger' : budget.usedPct >= 80 ? 'warning' : 'success'}>
              예산 {budget.usedPct}% 사용 · {overBudget ? '초과' : '잔여'} {formatKRW(Math.abs(budget.remaining))}
            </Badge>
          ) : (
            <Badge tone="muted">예산 미설정</Badge>
          )}
        </div>

        <section className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Kpi label="지출" value={formatKRW(totals.expense)} className="text-expense" />
          <Kpi label="수입" value={formatKRW(totals.income)} className="text-income" />
          <Kpi
            label="잔액"
            value={formatKRW(totals.balance)}
            className={totals.balance < 0 ? 'text-danger' : 'text-textPrimary'}
          />
          <Kpi
            label="예산"
            value={budget.total > 0 ? formatKRW(budget.total) : '미설정'}
            className="text-textPrimary"
          />
          <Kpi
            label={overBudget ? '초과' : '남은 예산'}
            value={budget.total > 0 ? formatKRW(Math.abs(budget.remaining)) : '-'}
            className={overBudget ? 'text-danger' : 'text-textPinkStrong'}
          />
        </section>
      </Card>

      {/* 달력 그리드 */}
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
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, idx) => {
            if (!c.date) return <div key={idx} className="h-20 sm:h-24" />;
            const bucket = dailyMap[c.date];
            const isToday = c.date === today;
            const isSelected = c.date === selected;
            const dow = new Date(c.date + 'T00:00:00Z').getUTCDay();
            return (
              <button
                key={c.date}
                type="button"
                onClick={() => setSelected(c.date)}
                className={cn(
                  'h-20 sm:h-24 p-1.5 rounded-md border text-left flex flex-col gap-0.5 transition-colors',
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
                      'text-xs font-semibold',
                      dow === 0 ? 'text-danger' : dow === 6 ? 'text-info' : 'text-textPrimary',
                      isToday && 'text-textPinkStrong',
                    )}
                  >
                    {c.day}
                  </span>
                  {bucket && bucket.count > 0 && (
                    <span className="text-[10px] tabular text-textMuted">{bucket.count}</span>
                  )}
                </div>
                {bucket && bucket.expense > 0 && (
                  <div className="text-[11px] tabular text-expense truncate">
                    -{formatKRW(bucket.expense)}
                  </div>
                )}
                {bucket && bucket.income > 0 && (
                  <div className="text-[11px] tabular text-income truncate">
                    +{formatKRW(bucket.income)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 선택한 날의 거래 리스트 */}
      <Card>
        <CardTitle>
          {selected ? `${formatDateKST(selected)} 거래` : '날짜를 선택하세요'}
        </CardTitle>
        {selected && selectedTxs.length === 0 && (
          <CardSubtle className="mt-2">이 날의 거래가 없습니다.</CardSubtle>
        )}
        {selected && selectedTxs.length > 0 && (
          <ul className="mt-3 divide-y divide-divider">
            {selectedTxs.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: t.category_color ?? '#F472B6' }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-textPrimary truncate">
                      {t.merchant_name || t.category_name || '거래'}
                    </div>
                    <div className="text-xs text-textSecondary truncate">
                      {t.category_name ?? '미지정'} · {t.payment_method_name ?? '미지정'}
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    'tabular text-sm font-medium whitespace-nowrap',
                    t.type === 'income'
                      ? 'text-income'
                      : t.type === 'transfer'
                      ? 'text-transfer'
                      : 'text-expense',
                  )}
                >
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                  {formatKRW(t.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border border-borderSoft bg-pageBackground p-2.5">
      <div className="text-[11px] text-textSecondary">{label}</div>
      <div className={cn('mt-1 text-base sm:text-lg font-semibold tabular truncate', className)}>{value}</div>
    </div>
  );
}
