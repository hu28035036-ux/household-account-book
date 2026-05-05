import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';

export async function getDashboardSummary(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
) {
  const { from, to } = monthRangeKST(yearMonth);

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('type, amount, category_id, payment_method_id, transaction_date, categories(name,color), payment_methods(name)')
    .eq('user_id', userId)
    .gte('transaction_date', from)
    .lte('transaction_date', to);
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

  const { count: pendingCandidates } = await supabase
    .from('transaction_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('user_action', 'pending');

  const { data: recent } = await supabase
    .from('transactions')
    .select('id, transaction_date, type, amount, merchant_name, categories(name,color), payment_methods(name)')
    .eq('user_id', userId)
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
