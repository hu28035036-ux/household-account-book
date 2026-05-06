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
};

function monthStartFromYM(ym: string): string {
  return `${ym}-01`;
}

export async function listBudgets(
  supabase: SupabaseClient,
  userId: string,
  yearMonth?: string,
) {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  const { data, error } = await supabase
    .from('budgets')
    .select('*, categories(name, color, icon)')
    .eq('user_id', userId)
    .eq('month_start', monthStartFromYM(ym))
    .order('category_id', { ascending: true, nullsFirst: true });
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
    household_id?: string | null;
  },
) {
  const month_start = monthStartFromYM(input.year_month);
  const household_id = (input as any).household_id ?? null;

  if (input.category_id) {
    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: userId,
          category_id: input.category_id,
          month_start,
          amount: input.amount,
          alert_threshold: input.alert_threshold ?? 0.8,
          memo: input.memo ?? null,
          household_id,
        },
        { onConflict: 'user_id,category_id,month_start' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', userId)
      .is('category_id', null)
      .eq('month_start', month_start)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('budgets')
        .update({
          amount: input.amount,
          alert_threshold: input.alert_threshold ?? 0.8,
          memo: input.memo ?? null,
          household_id,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          category_id: null,
          month_start,
          amount: input.amount,
          alert_threshold: input.alert_threshold ?? 0.8,
          memo: input.memo ?? null,
          household_id,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }
  }
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
): Promise<{ range: { from: string; to: string }; items: BudgetProgressItem[]; total?: BudgetProgressItem }> {
  const ym = yearMonth ?? monthRangeKST().from.slice(0, 7);
  const { from, to } = monthRangeKST(ym);
  const month_start = monthStartFromYM(ym);

  const [{ data: budgets }, { data: txs }] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, category_id, amount, alert_threshold, categories(name, color)')
      .eq('user_id', userId)
      .eq('month_start', month_start),
    supabase
      .from('transactions')
      .select('category_id, amount, type')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('transaction_date', from)
      .lte('transaction_date', to),
  ]);

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
