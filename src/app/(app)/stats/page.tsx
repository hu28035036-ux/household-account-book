import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDashboardSummary } from '@/services/dashboardService';
import { getActiveHouseholdContext } from '@/lib/auth/getActiveHouseholdContext';
import { getActiveHouseholdName } from '@/lib/auth/getActiveHouseholdName';
import {
  getAiAnalyticsSummary,
  getInsights,
  getMonthlySeries,
  getRecurringCandidates,
} from '@/services/analyticsService';
import { getBudgetProgress } from '@/services/budgetService';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';
import { MonthlyBars } from '@/components/charts/MonthlyBars';
import { BudgetBar } from '@/components/budgets/BudgetBar';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { StatsAiCard } from '@/components/stats/StatsAiCard';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const supabase = createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const householdContext = getActiveHouseholdContext();
  const householdName = householdContext
    ? await getActiveHouseholdName(supabase, householdContext)
    : null;
  const [summary, series, recurring, ai, budgets, insights] = await Promise.all([
    getDashboardSummary(supabase, u.user.id, undefined, householdContext),
    getMonthlySeries(supabase, u.user.id, 6),
    getRecurringCandidates(supabase, u.user.id, 3),
    getAiAnalyticsSummary(supabase, u.user.id),
    getBudgetProgress(supabase, u.user.id),
    getInsights(supabase, u.user.id),
  ]);

  const approvalRate =
    ai.totalCandidates > 0 ? Math.round((ai.approvedCandidates / ai.totalCandidates) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary">
            {householdName ? `${householdName} (모임)` : '개인 가계부'} 통계
          </h2>
          <p className="mt-0.5 text-xs text-textMuted">
            * 카테고리/거래/예산 카드는 활성 컨텍스트 기준. 6개월 흐름·고정지출·인사이트·AI 통계는
            본인 데이터 전체를 보여줍니다.
          </p>
        </div>
        <Badge tone="muted">
          {summary.range.from} ~ {summary.range.to}
        </Badge>
      </div>

      {/* AI 분석 — 사용자가 버튼 클릭 시에만 호출 */}
      <StatsAiCard />

      {/* 카테고리별 + 결제수단별 + 최근 거래 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle>최근 거래내역</CardTitle>
          {summary.recent.length > 0 ? (
            <ul className="mt-3 divide-y divide-divider">
              {summary.recent.map((t: any) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-textPrimary truncate">
                      {t.merchant_name || t.categories?.name || '거래'}
                    </div>
                    <div className="text-xs text-textSecondary">
                      {formatDateKST(t.transaction_date)} · {t.categories?.name ?? '미지정'} ·{' '}
                      {t.payment_methods?.name ?? '미지정'}
                    </div>
                  </div>
                  <div
                    className={
                      'tabular text-sm font-medium ' +
                      (t.type === 'income'
                        ? 'text-income'
                        : t.type === 'transfer'
                        ? 'text-transfer'
                        : 'text-expense')
                    }
                  >
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                    {formatKRW(Number(t.amount))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardSubtle className="mt-1">아직 거래가 없습니다.</CardSubtle>
          )}
        </Card>

        <Card>
          <CardTitle>카테고리별 지출</CardTitle>
          {summary.byCategory.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {summary.byCategory.slice(0, 8).map((c: any) => (
                <li key={c.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color ?? '#F472B6' }}
                    />
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                  <span className="tabular text-sm text-textPrimary">{formatKRW(c.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <CardSubtle className="mt-1">데이터가 쌓이면 표시됩니다.</CardSubtle>
          )}
        </Card>
      </section>

      {/* 예산 진행률 */}
      {(budgets.total || budgets.items.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className={budgets.items.length > 0 ? '' : 'lg:col-span-3'}>
            <CardTitle>예산 진행률</CardTitle>
            <CardSubtle className="mt-1">
              {budgets.range.from} ~ {budgets.range.to}
            </CardSubtle>
            {budgets.total ? (
              <div className="mt-3">
                <BudgetBar
                  name="전체"
                  color={null}
                  spent={budgets.total.spent_amount}
                  budget={budgets.total.budget_amount}
                  percent={budgets.total.percent}
                  status={budgets.total.status}
                />
              </div>
            ) : (
              <CardSubtle className="mt-3">전체 예산이 설정되지 않았습니다.</CardSubtle>
            )}
          </Card>
          {budgets.items.length > 0 && (
            <Card className="lg:col-span-2">
              <CardTitle>카테고리별 예산</CardTitle>
              <ul className="mt-3 space-y-3">
                {budgets.items.slice(0, 6).map((p) => (
                  <li key={p.category_id ?? 'total'}>
                    <BudgetBar
                      name={p.category_name}
                      color={p.category_color}
                      spent={p.spent_amount}
                      budget={p.budget_amount}
                      percent={p.percent}
                      status={p.status}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {/* 6개월 흐름 + 고정지출 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle>최근 6개월 흐름</CardTitle>
          <div className="mt-3">
            <MonthlyBars rows={series} />
          </div>
        </Card>
        <Card>
          <CardTitle>고정지출 후보</CardTitle>
          {recurring.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {recurring.map((r) => (
                <li key={r.merchant} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-textPrimary truncate">{r.merchant}</div>
                    <div className="text-xs text-textSecondary">
                      90일 {r.count}회 · 마지막 {formatDateKST(r.lastDate)}
                      {r.stable && <span className="ml-1 text-textPinkStrong">· 안정적</span>}
                    </div>
                  </div>
                  <span className="tabular text-sm text-textPrimary">{formatKRW(r.avg)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <CardSubtle className="mt-1">반복 지출이 발견되면 여기로 표시됩니다.</CardSubtle>
          )}
        </Card>
      </section>

      {/* 인사이트 */}
      <InsightsSection
        topUp={insights.topUp}
        topDown={insights.topDown}
        anomalies={insights.anomalies}
        weekday={insights.weekday}
        totalThis={insights.total_this}
        totalLast={insights.total_last}
      />

      {/* AI 통계 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardSubtle>30일 AI 후보</CardSubtle>
          <div className="mt-2 text-2xl font-semibold tabular text-textPrimary">{ai.totalCandidates}건</div>
        </Card>
        <Card>
          <CardSubtle>승인율</CardSubtle>
          <div className="mt-2 text-2xl font-semibold tabular text-textPinkStrong">{approvalRate}%</div>
          <CardSubtle className="mt-1">
            승인 {ai.approvedCandidates} · 제외 {ai.rejectedCandidates}
          </CardSubtle>
        </Card>
        <Card>
          <CardSubtle>분석 성공</CardSubtle>
          <div className="mt-2 text-2xl font-semibold tabular text-success">{ai.successJobs}</div>
        </Card>
        <Card>
          <CardSubtle>분석 실패</CardSubtle>
          <div className="mt-2 text-2xl font-semibold tabular text-danger">{ai.failedJobs}</div>
        </Card>
      </section>
    </div>
  );
}
