import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatePaymentMethodInput, UpdatePaymentMethodInput } from '@/lib/validators/common';

function buildMaskedNumber(last4?: string | null): string | null {
  if (!last4) return null;
  return `****-****-****-${last4}`;
}

export async function listPaymentMethods(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPaymentMethod(
  supabase: SupabaseClient,
  userId: string,
  input: CreatePaymentMethodInput,
) {
  const { last4, ...rest } = input;
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      user_id: userId,
      ...rest,
      masked_number: buildMaskedNumber(last4),
      is_default: false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updatePaymentMethod(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdatePaymentMethodInput,
) {
  const { last4, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest };
  if (last4 !== undefined) patch.masked_number = buildMaskedNumber(last4);

  const { data, error } = await supabase
    .from('payment_methods')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deletePaymentMethod(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
