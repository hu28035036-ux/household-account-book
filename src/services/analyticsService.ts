import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';
import {
  categoryDeltas,
  detectAnomalies,
  weekdayPattern,
  type ExpenseRow,
  type CategoryDelta,
  type AnomalyRow,
  type WeekdayPattern,
} from '@/lib/insights/compute';

/**
 * 최근 N개월 월별 지출/수입 시계열.
 */
export async function getMonthlySeries(
  supabase: SupabaseClient,
  userId: string,
  monthCount = 6,
) {
  const today = new Date();
  const ymKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  const months: string[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push(ymKey(d));
  }
  const startYm = months[0];
  const startRange = monthRangeKST(startYm);

  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_date, type, amount')
    .eq('user_id', userId)
    .gte('transaction_date', startRange.from);
  if (error) throw error;

  const buckets: Record<string, { income: number; expense: number }> = {};
  for (const m of months) buckets[m] = { income: 0, expense: 0 };
  for (const t of data ?? []) {
    const ym = (t.transaction_date as string).slice(0, 7);
    if (!buckets[ym]) continue;
    if (t.type === 'income') buckets[ym].income += Number(t.amount);
    else if (t.type === 'expense') buckets[ym].expense += Number(t.amount);
  }
  return months.map((m) => ({ ym: m, ...buckets[m] }));
}

/**
 * 반복 지출 후보 (고정지출 후보):
 * 최근 90일에 같은 가맹점이 N회 이상 등장하고 금액 평균 ±15% 이내.
 */
export async function getRecurringCandidates(
  supabase: SupabaseClient,
  userId: string,
  minCount = 3,
) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('transactions')
    .select('merchant_name, amount, transaction_date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('transaction_date', since)
    .not('merchant_name', 'is', null);
  if (error) throw error;

  const groups: Record<string, { count: number; total: number; lastDate: string; amounts: number[] }> = {};
  for (const t of data ?? []) {
    const key = (t.merchant_name as string).trim().toLowerCase();
    if (!key) continue;
    groups[key] ??= { count: 0, total: 0, lastDate: '', amounts: [] };
    groups[key].count += 1;
    groups[key].total += Number(t.amount);
    groups[key].amounts.push(Number(t.amount));
    if (!groups[key].lastDate || t.transaction_date > groups[key].lastDate) {
      groups[key].lastDate = t.transaction_date as string;
    }
  }

  const out = Object.entries(groups)
    .filter(([, v]) => v.count >= minCount)
    .map(([k, v]) => {
      const avg = Math.round(v.total / v.count);
      const minA = Math.min(...v.amounts);
      const maxA = Math.max(...v.amounts);
      const stable = avg > 0 && (maxA - minA) / avg <= 0.3;
      return { merchant: k, count: v.count, total: v.total, avg, lastDate: v.lastDate, stable };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return out;
}

/**
 * AI 분석 통계 (최근 30일).
 */
export async function getAiAnalyticsSummary(supabase: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalCandidates }, { count: approvedCandidates }, { count: rejectedCandidates }, jobs] =
    await Promise.all([
      supabase
        .from('transaction_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since),
      supabase
        .from('transaction_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since)
        .eq('user_action', 'approved'),
      supabase
        .from('transaction_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since)
        .eq('user_action', 'rejected'),
      supabase
        .from('ai_extraction_jobs')
        .select('status', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', since),
    ]);

  const jobRows = jobs.data ?? [];
  const successJobs = jobRows.filter((j) => j.status === 'success').length;
  const failedJobs = jobRows.filter((j) => j.status === 'failed').length;

  return {
    totalCandidates: totalCandidates ?? 0,
    approvedCandidates: approvedCandidates ?? 0,
    rejectedCandidates: rejectedCandidates ?? 0,
    successJobs,
    failedJobs,
  };
}

/**
 * 이번 달 소비 인사이트.
 * - 카테고리별 전월 대비 증감 top up/down
 * - 최근 30일 이상 거래 (가맹점 평균 대비 N배)
 * - 주말/평일 일평균 비교
 */
export async function getInsights(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
): Promise<{
  range: { from: string; to: string };
  topUp: CategoryDelta[];
  topDown: CategoryDelta[];
  anomalies: AnomalyRow[];
  weekday: WeekdayPattern;
  total_this: number;
  total_last: number;
}> {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  const { from, to } = monthRangeKST(ym);

  // 전월 범위
  const [y, m] = ym.split('-').map(Number);
  const lastDate = new Date(Date.UTC(y, m - 2, 1));
  const lastYm = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const lastRange = monthRangeKST(lastYm);

  // 이상 탐지용 30일 윈도우
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const minFrom = since30 < lastRange.from ? since30 : lastRange.from;

  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_date, amount, merchant_name, category_id, categories(name,color)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('transaction_date', minFrom);
  if (error) throw error;

  const all: ExpenseRow[] = (data ?? []).map((r: any) => ({
    transaction_date: r.transaction_date as string,
    amount: Number(r.amount),
    merchant_name: r.merchant_name ?? null,
    category_id: r.category_id ?? null,
    category_name: r.categories?.name ?? null,
    category_color: r.categories?.color ?? null,
  }));

  const inRange = (r: ExpenseRow, f: string, t: string) => r.transaction_date >= f && r.transaction_date <= t;
  const thisRows = all.filter((r) => inRange(r, from, to));
  const lastRows = all.filter((r) => inRange(r, lastRange.from, lastRange.to));
  const anomalyRows = all.filter((r) => r.transaction_date >= since30);

  const deltas = categoryDeltas(thisRows, lastRows).sort((a, b) => b.delta - a.delta);
  const topUp = deltas.filter((d) => d.delta > 0).slice(0, 5);
  const topDown = deltas.filter((d) => d.delta < 0).slice(-5).reverse();

  const totalThis = thisRows.reduce((s, r) => s + r.amount, 0);
  const totalLast = lastRows.reduce((s, r) => s + r.amount, 0);

  return {
    range: { from, to },
    topUp,
    topDown,
    anomalies: detectAnomalies(anomalyRows),
    weekday: weekdayPattern(thisRows),
    total_this: totalThis,
    total_last: totalLast,
  };
}
