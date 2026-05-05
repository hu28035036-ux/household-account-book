'use client';

import { formatKRW } from '@/lib/formatting/money';

type Row = { ym: string; income: number; expense: number };

export function MonthlyBars({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-textSecondary">데이터 없음</p>;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense)));

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.ym}>
          <div className="flex items-center justify-between text-xs text-textSecondary">
            <span>{r.ym}</span>
            <span className="tabular">
              <span className="text-expense">-{formatKRW(r.expense)}</span>{' '}
              <span className="text-income ml-2">+{formatKRW(r.income)}</span>
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <div className="h-2 rounded-full bg-expenseSoft overflow-hidden">
              <div
                className="h-full bg-expense"
                style={{ width: `${Math.min(100, (r.expense / max) * 100)}%` }}
              />
            </div>
            <div className="h-2 rounded-full bg-incomeSoft overflow-hidden">
              <div
                className="h-full bg-income"
                style={{ width: `${Math.min(100, (r.income / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
