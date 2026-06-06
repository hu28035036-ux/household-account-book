import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { TrendingUp, TrendingDown, AlertOctagon } from 'lucide-react';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';
import type {
  CategoryDelta,
  AnomalyRow,
  WeekdayPattern,
} from '@/lib/insights/compute';

type Props = {
  topUp: CategoryDelta[];
  topDown: CategoryDelta[];
  anomalies: AnomalyRow[];
  weekday: WeekdayPattern;
  totalThis: number;
  totalLast: number;
};

export function InsightsSection({ topUp, topDown, anomalies, weekday, totalThis, totalLast }: Props) {
  const monthDelta = totalThis - totalLast;
  const monthPct = totalLast > 0 ? Math.round((monthDelta / totalLast) * 100) : null;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardTitle>이번 달 vs 지난 달</CardTitle>
        <div className="mt-3 space-y-2">
          <Row label="이번 달 지출" value={formatKRW(totalThis)} />
          <Row label="지난 달 지출" value={formatKRW(totalLast)} />
          <Row
            label="증감"
            value={
              <span className={monthDelta > 0 ? 'text-expense' : monthDelta < 0 ? 'text-success' : 'text-textSecondary'}>
                {monthDelta > 0 ? '+' : ''}
                {formatKRW(monthDelta)}
                {monthPct !== null && ` (${monthDelta > 0 ? '+' : ''}${monthPct}%)`}
              </span>
            }
          />
        </div>
        <div className="mt-4 border-t border-divider pt-3">
          <CardSubtle>주말/평일 일평균</CardSubtle>
          <div className="mt-2 space-y-1 text-sm">
            <Row label={`평일 (${weekday.weekday_days}일)`} value={formatKRW(weekday.weekday_avg)} small />
            <Row label={`주말 (${weekday.weekend_days}일)`} value={formatKRW(weekday.weekend_avg)} small />
            {weekday.weekday_avg > 0 && weekday.weekend_avg > 0 && (
              <p className="mt-1 text-xs text-textMuted">
                주말이 평일의 <span className="text-textPinkStrong">{weekday.weekend_to_weekday}배</span>
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>지출 늘어난 카테고리</CardTitle>
          <TrendingUp className="h-4 w-4 text-expense" strokeWidth={1.75} />
        </div>
        {topUp.length === 0 ? (
          <CardSubtle className="mt-3">늘어난 카테고리가 없어요.</CardSubtle>
        ) : (
          <ul className="mt-3 space-y-2">
            {topUp.map((d) => (
              <DeltaItem key={d.category_id ?? d.category_name} d={d} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>지출 줄어든 카테고리</CardTitle>
          <TrendingDown className="h-4 w-4 text-success" strokeWidth={1.75} />
        </div>
        {topDown.length === 0 ? (
          <CardSubtle className="mt-3">줄어든 카테고리가 없어요.</CardSubtle>
        ) : (
          <ul className="mt-3 space-y-2">
            {topDown.map((d) => (
              <DeltaItem key={d.category_id ?? d.category_name} d={d} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <CardTitle>이상 거래 (최근 30일)</CardTitle>
          <Badge tone="warning">평소 평균의 2배 이상</Badge>
        </div>
        {anomalies.length === 0 ? (
          <CardSubtle className="mt-3">눈에 띄게 큰 단건 지출이 없어요.</CardSubtle>
        ) : (
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {anomalies.map((a, i) => (
              <li
                key={`${a.merchant_name}-${a.date}-${i}`}
                className="rounded-lg border border-borderDefault p-3 bg-pageBackground"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-textPrimary truncate">{a.merchant_name}</span>
                  <span className="text-xs text-textPinkStrong inline-flex items-center gap-1">
                    <AlertOctagon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {a.ratio}배
                  </span>
                </div>
                <div className="mt-1 text-sm tabular text-expense">{formatKRW(a.amount)}</div>
                <div className="mt-1 text-xs text-textMuted">
                  {formatDateKST(a.date)} · 평균 {formatKRW(a.merchant_avg)}
                  {a.category_name && ` · ${a.category_name}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function DeltaItem({ d }: { d: CategoryDelta }) {
  const positive = d.delta > 0;
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.category_color ?? '#A3E635' }} />
        <span className="text-sm truncate">{d.category_name}</span>
      </div>
      <div className="text-right">
        <div className={'tabular text-sm ' + (positive ? 'text-expense' : 'text-success')}>
          {positive ? '+' : ''}
          {formatKRW(d.delta)}
        </div>
        {d.pct !== null && (
          <div className="text-[11px] text-textMuted tabular">
            {positive ? '+' : ''}
            {d.pct}%
          </div>
        )}
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  small,
}: {
  label: string;
  value: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className={'flex items-center justify-between ' + (small ? 'text-sm' : '')}>
      <span className="text-textSecondary">{label}</span>
      <span className="tabular text-textPrimary">{value}</span>
    </div>
  );
}
