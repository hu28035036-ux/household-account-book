import type { SupabaseClient } from '@supabase/supabase-js';
import { recordMerchantLearning, logCorrection } from './learningService';
import { checkBudgetAlertsForUser } from '@/lib/budgets/alertCheck';

export async function listCandidates(
  supabase: SupabaseClient,
  userId: string,
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
) {
  let q = supabase
    .from('transaction_candidates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') q = q.eq('user_action', status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateCandidate(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('transaction_candidates')
    .update({ ...patch, user_action: 'edited' })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function rejectCandidate(supabase: SupabaseClient, userId: string, id: string) {
  const { data, error } = await supabase
    .from('transaction_candidates')
    .update({ user_action: 'rejected' })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  await logCorrection(supabase, userId, id, 'user_action', 'pending', 'rejected', 'reject');
  return data;
}

async function resolveCategoryByName(
  supabase: SupabaseClient,
  userId: string,
  name: string | null,
): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolvePaymentMethodByName(
  supabase: SupabaseClient,
  userId: string,
  name: string | null,
): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function approveCandidate(
  supabase: SupabaseClient,
  userId: string,
  id: string,
) {
  const { data: c, error: cErr } = await supabase
    .from('transaction_candidates')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!c) throw new Error('후보를 찾을 수 없습니다.');
  if (!c.transaction_date || c.amount == null) {
    throw new Error('날짜/금액이 비어 있어 승인할 수 없습니다. 먼저 수정해 주세요.');
  }

  const categoryId = await resolveCategoryByName(supabase, userId, c.category_suggestion);
  const paymentMethodId = await resolvePaymentMethodByName(supabase, userId, c.payment_method_suggestion);

  const { data: tx, error: insErr } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      transaction_date: c.transaction_date,
      type: c.type,
      amount: c.amount,
      merchant_name: c.merchant_name,
      description: c.description ?? '',
      category_id: categoryId,
      payment_method_id: paymentMethodId,
      source_type: 'receipt_image',
      source_file_id: c.uploaded_file_id,
      is_ai_generated: true,
      is_confirmed: true,
      ai_confidence: c.confidence,
    })
    .select('*')
    .single();
  if (insErr) throw insErr;

  await supabase
    .from('transaction_candidates')
    .update({ user_action: 'approved' })
    .eq('user_id', userId)
    .eq('id', id);

  if (c.merchant_name) {
    await recordMerchantLearning(supabase, userId, c.merchant_name, categoryId, paymentMethodId);
  }
  await logCorrection(supabase, userId, id, 'user_action', 'pending', 'approved', 'approve');

  if (c.type === 'expense' && c.transaction_date) {
    try {
      await checkBudgetAlertsForUser(supabase, userId, (c.transaction_date as string).slice(0, 7));
    } catch {
      // ignore
    }
  }
  return tx;
}

export async function approveBulk(supabase: SupabaseClient, userId: string, ids: string[]) {
  const approved: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of ids) {
    const { data: c } = await supabase
      .from('transaction_candidates')
      .select('id, duplicate_status, warnings, transaction_date, amount')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
    if (!c) {
      skipped.push({ id, reason: 'not_found' });
      continue;
    }
    if (c.duplicate_status === 'suspected' || c.duplicate_status === 'duplicate') {
      skipped.push({ id, reason: 'duplicate' });
      continue;
    }
    const w = (c.warnings as string[]) ?? [];
    if (w.includes('amount_uncertain') || w.includes('date_uncertain')) {
      skipped.push({ id, reason: 'needs_review' });
      continue;
    }
    if (!c.transaction_date || c.amount == null) {
      skipped.push({ id, reason: 'missing_required' });
      continue;
    }
    try {
      await approveCandidate(supabase, userId, id);
      approved.push(id);
    } catch (e) {
      skipped.push({ id, reason: e instanceof Error ? e.message : 'error' });
    }
  }
  return { approved, skipped };
}
