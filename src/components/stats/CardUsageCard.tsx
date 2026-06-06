import { CreditCard } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { formatKRW } from '@/lib/formatting/money';
import type { CardUsageReport } from '@/services/cardStatsService';
import { cn } from '@/lib/utils/cn';

type Props = { report: CardUsageReport };

export function CardUsageCard({ report }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>카드 사용 통계</CardTitle>
        </div>
        <Badge tone="muted">
          {report.range.from} ~ {report.range.to}
        </Badge>
      </div>
      <CardSubtle className="mt-1">
        결제수단이 카드(체크/신용)인 거래만 집계. 카드별 사용액·점유율·자주 쓰는 카테고리.
      </CardSubtle>

      {report.cards.length === 0 ? (
        <CardSubtle className="mt-3">
          이번 달 카드 결제 거래가 없거나, 결제수단에 카드 등록이 안 되어 있어요. 결제수단
          페이지에서 카드를 추가해 보세요.
        </CardSubtle>
      ) : (
        <>
          {/* 합계 요약 */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-textSecondary">카드 총 지출</div>
              <div className="mt-0.5 text-base sm:text-lg font-semibold tabular text-expense whitespace-nowrap">
                -{formatKRW(report.total_card_spent)}
              </div>
            </div>
            <div>
              <div className="text-xs text-textSecondary">결제 건수</div>
              <div className="mt-0.5 text-base sm:text-lg font-semibold tabular text-textPrimary whitespace-nowrap">
                {report.total_card_count}건
              </div>
            </div>
            <div>
              <div className="text-xs text-textSecondary">카드 종류</div>
              <div className="mt-0.5 text-base sm:text-lg font-semibold tabular text-textPrimary whitespace-nowrap">
                {report.cards.length}개
              </div>
            </div>
          </div>

          {/* 카드별 점유율 바 */}
          <div className="mt-4 space-y-3">
            {report.cards.map((c) => (
              <div key={c.payment_method_id} className="rounded-md border border-borderSoft p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="font-medium text-textPrimary truncate">{c.name}</span>
                    {c.issuer_name && (
                      <span className="ml-1 text-xs text-textMuted">{c.issuer_name}</span>
                    )}
                    {c.masked_number && (
                      <span className="ml-1 text-xs text-textMuted font-mono">
                        {c.masked_number}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="tabular text-sm font-semibold text-expense">
                      -{formatKRW(c.spent_amount)}
                    </span>
                    <span className="ml-1 text-xs text-textMuted">({c.share_percent}%)</span>
                  </div>
                </div>
                {/* 점유율 바 */}
                <div className="mt-2 h-1.5 rounded-full bg-borderSoft overflow-hidden">
                  <div
                    className={cn('h-full bg-primaryPink')}
                    style={{ width: `${Math.min(100, c.share_percent)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-textMuted">
                  <span>
                    {c.transaction_count}건 · 평균{' '}
                    <span className="tabular text-textSecondary">
                      {formatKRW(c.avg_amount)}
                    </span>
                  </span>
                </div>

                {/* 카테고리 Top 3 */}
                {c.top_categories.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {c.top_categories.map((t, i) => (
                      <span
                        key={t.name + i}
                        className="inline-flex items-center gap-1 text-xs"
                        title={`${t.name} · ${formatKRW(t.amount)}`}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: t.color ?? '#A3E635' }}
                        />
                        <span className="text-textPrimary">{t.name}</span>
                        <span className="text-textMuted tabular">{t.percent}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
