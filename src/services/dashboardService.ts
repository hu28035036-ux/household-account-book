import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';

/**
 * householdContext:
 *   - null → 개인 모드 (user_id 일치 + household_id IS NULL)
 *   - 'X'  → 모임 X 모드 (household_id = X), RLS 가 멤버인지 검증
 */
export async function getDashboardSummary(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
  householdContext: string | null = null,
) {
  const { from, to } = monthRangeKST(yearMonth);

  let txQ = supabase
    .from('transactions')
    .select(
      'type, amount, category_id, payment_method_id, transaction_date, categories(name,color), payment_methods(name)',
    )
    .gte('transaction_date', from)
    .lte('transaction_date', to);
  if (householdContext) txQ = txQ.eq('household_id', householdContext);
  else txQ = txQ.eq('user_id', userId).is('household_id', null);

  const { data: txs, error } = await txQ;
  if (error) throw error;

  let income = 0;
  let expense = 0;
  const byCategory: Record<string, { name: string; color: string | null; amount: number }> = {};
  const byPaymentMethod: Record<string, { name: string; amount: number }> = {};

  for (const t of txs ?? []) {
    if (t.type === 'income') income += Number(t.amount);
    else if (t.type === 'expense') expense += Number(t.amount);

    if (t.type === 'expense' && t.category_id) {
      const c = (t as any).categories;
      const key = t.category_id as string;
      byCategory[key] ??= { name: c?.name ?? '미지정', color: c?.color ?? null, amount: 0 };
      byCategory[key].amount += Number(t.amount);
    }
    if (t.type === 'expense' && t.payment_method_id) {
      const p = (t as any).payment_methods;
      const key = t.payment_method_id as string;
      byPaymentMethod[key] ??= { name: p?.name ?? '미지정', amount: 0 };
      byPaymentMethod[key].amount += Number(t.amount);
    }
  }

  let pendQ = supabase
    .from('transaction_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('user_action', 'pending');
  if (householdContext) pendQ = pendQ.eq('household_id', householdContext);
  else pendQ = pendQ.eq('user_id', userId).is('household_id', null);
  const { count: pendingCandidates } = await pendQ;

  let recentQ = supabase
    .from('transactions')
    .select(
      'id, transaction_date, type, amount, merchant_name, categories(name,color), payment_methods(name)',
    );
  if (householdContext) recentQ = recentQ.eq('household_id', householdContext);
  else recentQ = recentQ.eq('user_id', userId).is('household_id', null);
  const { data: recent } = await recentQ
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(8);

  return {
    range: { from, to },
    totals: { income, expense, balance: income - expense },
    byCategory: Object.values(byCategory).sort((a, b) => b.amount - a.amount),
    byPaymentMethod: Object.values(byPaymentMethod).sort((a, b) => b.amount - a.amount),
    pendingCandidates: pendingCandidates ?? 0,
    recent: recent ?? [],
  };
}
