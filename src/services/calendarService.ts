import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';
import { getBudgetProgress, type BudgetProgressItem } from './budgetService';

export type DailyBucket = {
  date: string; // YYYY-MM-DD
  expense: number;
  income: number;
  count: number;
};

export type CalendarMonth = {
  range: { from: string; to: string }; // KST 1일 ~ 말일
  daily: DailyBucket[];
  totals: { expense: number; income: number; balance: number };
  budgetTotal: number;
  budgetUsedPct: number;
  budgetRemaining: number;
  /** 카테고리별 예산 진행률 (사용량 많은 순) */
  categoryBudgets: BudgetProgressItem[];
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

/**
 * 월 캘린더 데이터.
 * householdContext:
 *   - null  → 개인 모드 (household_id IS NULL & user_id = me)
 *   - 'X'   → 모임 X 모드 (household_id = X) — RLS 가 멤버 여부 검증
 */
export async function getCalendarMonth(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
  householdContext: string | null = null,
): Promise<CalendarMonth> {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  const { from, to } = monthRangeKST(ym);

  let txQ = supabase
    .from('transactions')
    .select(
      'id, transaction_date, type, amount, merchant_name, categories(name,color), payment_methods(name)',
    )
    .gte('transaction_date', from)
    .lte('transaction_date', to);
  if (householdContext) {
    txQ = txQ.eq('household_id', householdContext);
  } else {
    txQ = txQ.eq('user_id', userId).is('household_id', null);
  }
  const { data: txs } = await txQ.order('transaction_date', { ascending: true });

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

  // 전체 예산 — 컨텍스트와 동일한 범위
  const monthStart = `${ym}-01`;
  let budgetQ = supabase.from('budgets').select('amount').is('category_id', null).eq('month_start', monthStart);
  if (householdContext) {
    budgetQ = budgetQ.eq('household_id', householdContext);
  } else {
    budgetQ = budgetQ.eq('user_id', userId).is('household_id', null);
  }
  const { data: totalBudget } = await budgetQ.maybeSingle();
  const budgetTotal = totalBudget ? Number(totalBudget.amount) : 0;
  const budgetUsedPct =
    budgetTotal > 0 ? Math.min(999, Math.round((totalExpense / budgetTotal) * 100)) : 0;
  const budgetRemaining = budgetTotal > 0 ? budgetTotal - totalExpense : 0;

  // 카테고리별 예산 진행률 (캘린더 아래 카드용)
  let categoryBudgets: BudgetProgressItem[] = [];
  try {
    const prog = await getBudgetProgress(supabase, userId, ym, householdContext);
    categoryBudgets = prog.items;
  } catch {
    categoryBudgets = [];
  }

  return {
    range: { from, to },
    daily: Object.values(byDate),
    totals: { expense: totalExpense, income: totalIncome, balance: totalIncome - totalExpense },
    budgetTotal,
    budgetUsedPct,
    budgetRemaining,
    categoryBudgets,
    recentByDate,
  };
}
