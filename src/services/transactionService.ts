import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionListQuery,
} from '@/lib/validators/common';

export async function listTransactions(
  supabase: SupabaseClient,
  userId: string,
  q: TransactionListQuery,
) {
  // RLS가 본인 + 멤버인 가족 공유분을 모두 보여주므로 user_id 필터를 강제하지 않는다.
  // 단, scope=personal/household 또는 household_id로 좁힐 수 있다.
  let query = supabase
    .from('transactions')
    .select('*, categories(name,color,icon), payment_methods(name,type,masked_number)', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);

  if (q.scope === 'personal') {
    query = query.is('household_id', null).eq('user_id', userId);
  } else if (q.scope === 'household') {
    query = query.not('household_id', 'is', null);
  }
  if (q.household_id) query = query.eq('household_id', q.household_id);

  if (q.from) query = query.gte('transaction_date', q.from);
  if (q.to) query = query.lte('transaction_date', q.to);
  if (q.type) query = query.eq('type', q.type);
  if (q.category_id) query = query.eq('category_id', q.category_id);
  if (q.payment_method_id) query = query.eq('payment_method_id', q.payment_method_id);
  if (q.q) query = query.or(`merchant_name.ilike.%${q.q}%,description.ilike.%${q.q}%,memo.ilike.%${q.q}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function createTransaction(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTransactionInput,
) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      ...input,
      source_type: 'manual',
      is_ai_generated: false,
      is_confirmed: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateTransactionInput,
) {
  const { data, error } = await supabase
    .from('transactions')
    .update(input)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
