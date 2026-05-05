import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';

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
