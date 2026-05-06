import type { SupabaseClient } from '@supabase/supabase-js';
import { monthRangeKST } from '@/lib/formatting/date';

export type Budget = {
  id: string;
  user_id: string;
  category_id: string | null;
  month_start: string; // YYYY-MM-01
  amount: number;
  alert_threshold: number;
  memo: string | null;
  household_id: string | null;
};

function monthStartFromYM(ym: string): string {
  return `${ym}-01`;
}

/**
 * householdContext:
 *   - null → 개인 모드 (user_id 일치 + household_id IS NULL)
 *   - 'X'  → 모임 X 모드 (household_id = X)
 */
export async function listBudgets(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
  householdContext: string | null = null,
) {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  let q = supabase
    .from('budgets')
    .select('*, categories(name, color, icon)')
    .eq('month_start', monthStartFromYM(ym));
  if (householdContext) q = q.eq('household_id', householdContext);
  else q = q.eq('user_id', userId).is('household_id', null);

  const { data, error } = await q.order('category_id', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertBudget(
  supabase: SupabaseClient,
  userId: string,
  input: {
    category_id: string | null;
    year_month: string;
    amount: number;
    alert_threshold?: number;
    memo?: string | null;
  },
  householdContext: string | null = null,
) {
  const month_start = monthStartFromYM(input.year_month);
  const householdId = householdContext;

  // 같은 (scope, category, month) 행이 이미 있는지 검색
  let exQ = supabase.from('budgets').select('id').eq('month_start', month_start);
  if (input.category_id) exQ = exQ.eq('category_id', input.category_id);
  else exQ = exQ.is('category_id', null);
  if (householdId) exQ = exQ.eq('household_id', householdId);
  else exQ = exQ.eq('user_id', userId).is('household_id', null);
  const { data: existing } = await exQ.maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('budgets')
      .update({
        amount: input.amount,
        alert_threshold: input.alert_threshold ?? 0.8,
        memo: input.memo ?? null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      user_id: userId,
      category_id: input.category_id ?? null,
      month_start,
      amount: input.amount,
      alert_threshold: input.alert_threshold ?? 0.8,
      memo: input.memo ?? null,
      household_id: householdId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from('budgets').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export type BudgetProgressItem = {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  budget_amount: number;
  spent_amount: number;
  percent: number;
  status: 'safe' | 'caution' | 'over';
  alert_threshold: number;
};

export async function getBudgetProgress(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
  householdContext: string | null = null,
): Promise<{
  range: { from: string; to: string };
  items: BudgetProgressItem[];
  total?: BudgetProgressItem;
}> {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  const { from, to } = monthRangeKST(ym);
  const month_start = monthStartFromYM(ym);

  let bQ = supabase
    .from('budgets')
    .select('id, category_id, amount, alert_threshold, categories(name, color)')
    .eq('month_start', month_start);
  if (householdContext) bQ = bQ.eq('household_id', householdContext);
  else bQ = bQ.eq('user_id', userId).is('household_id', null);

  let tQ = supabase
    .from('transactions')
    .select('category_id, amount, type')
    .eq('type', 'expense')
    .gte('transaction_date', from)
    .lte('transaction_date', to);
  if (householdContext) tQ = tQ.eq('household_id', householdContext);
  else tQ = tQ.eq('user_id', userId).is('household_id', null);

  const [{ data: budgets }, { data: txs }] = await Promise.all([bQ, tQ]);

  const spentByCategory: Record<string, number> = {};
  let spentTotal = 0;
  for (const t of txs ?? []) {
    spentTotal += Number(t.amount);
    const key = (t.category_id as string | null) ?? '__uncat__';
    spentByCategory[key] = (spentByCategory[key] ?? 0) + Number(t.amount);
  }

  const items: BudgetProgressItem[] = [];
  let total: BudgetProgressItem | undefined;

  for (const b of budgets ?? []) {
    const isTotal = b.category_id == null;
    const spent = isTotal ? spentTotal : spentByCategory[b.category_id as string] ?? 0;
    const percent = b.amount > 0 ? Math.min(999, Math.round((spent / Number(b.amount)) * 100)) : 0;
    const threshold = Number(b.alert_threshold ?? 0.8);
    const status: BudgetProgressItem['status'] =
      percent >= 100 ? 'over' : percent >= Math.round(threshold * 100) ? 'caution' : 'safe';

    const item: BudgetProgressItem = {
      category_id: (b.category_id as string | null) ?? null,
      category_name: isTotal ? '전체' : (b as any).categories?.name ?? '미지정',
      category_color: isTotal ? null : (b as any).categories?.color ?? null,
      budget_amount: Number(b.amount),
      spent_amount: spent,
      percent,
      status,
      alert_threshold: threshold,
    };
    if (isTotal) total = item;
    else items.push(item);
  }

  items.sort((a, b) => b.percent - a.percent);
  return { range: { from, to }, items, total };
}
