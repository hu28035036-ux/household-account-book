import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';

export type DailyBucket = {
  date: string; // YYYY-MM-DD
  expense: number;
  income: number;
  count: number;
};

export type CalendarMonth = {
  range: { from: string; to: string }; // KST 1일 ~ 말일
  daily: DailyBucket[]; // 날짜별 합계 (해당 월 내 거래만)
  totals: { expense: number; income: number; balance: number };
  budgetTotal: number; // 이번 달 전체 예산 (없으면 0)
  budgetUsedPct: number; // 0..999
  budgetRemaining: number; // 음수면 초과
  recentByDate: Record<string, Array<{
    id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    merchant_name: string | null;
    category_name: string | null;
    category_color: string | null;
    payment_method_name: string | null;
  }>>;
};

export async function getCalendarMonth(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
): Promise<CalendarMonth> {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  const { from, to } = monthRangeKST(ym);

  // 거래 조회 (해당 월)
  const { data: txs } = await supabase
    .from('transactions')
    .select(
      'id, transaction_date, type, amount, merchant_name, categories(name,color), payment_methods(name)',
    )
    .eq('user_id', userId)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: true });

  // 일별 버킷 + 일별 거래 모음
  const byDate: Record<string, DailyBucket> = {};
  const recentByDate: CalendarMonth['recentByDate'] = {};
  let totalExpense = 0;
  let totalIncome = 0;

  for (const t of txs ?? []) {
    const d = t.transaction_date as string;
    byDate[d] ??= { date: d, expense: 0, income: 0, count: 0 };
    byDate[d].count += 1;
    if (t.type === 'expense') {
      byDate[d].expense += Number(t.amount);
      totalExpense += Number(t.amount);
    } else if (t.type === 'income') {
      byDate[d].income += Number(t.amount);
      totalIncome += Number(t.amount);
    }

    recentByDate[d] ??= [];
    if (recentByDate[d].length < 20) {
      recentByDate[d].push({
        id: t.id as string,
        type: t.type as 'income' | 'expense' | 'transfer',
        amount: Number(t.amount),
        merchant_name: (t as any).merchant_name ?? null,
        category_name: (t as any).categories?.name ?? null,
        category_color: (t as any).categories?.color ?? null,
        payment_method_name: (t as any).payment_methods?.name ?? null,
      });
    }
  }

  // 예산 (전체 예산만 우선; category 단위는 통계 페이지에서)
  const monthStart = `${ym}-01`;
  const { data: totalBudget } = await supabase
    .from('budgets')
    .select('amount')
    .eq('user_id', userId)
    .is('category_id', null)
    .eq('month_start', monthStart)
    .maybeSingle();
  const budgetTotal = totalBudget ? Number(totalBudget.amount) : 0;
  const budgetUsedPct = budgetTotal > 0 ? Math.min(999, Math.round((totalExpense / budgetTotal) * 100)) : 0;
  const budgetRemaining = budgetTotal > 0 ? budgetTotal - totalExpense : 0;

  return {
    range: { from, to },
    daily: Object.values(byDate),
    totals: { expense: totalExpense, income: totalIncome, balance: totalIncome - totalExpense },
    budgetTotal,
    budgetUsedPct,
    budgetRemaining,
    recentByDate,
  };
}
