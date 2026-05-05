import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/validators/common';

export async function listCategories(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory(
  supabase: SupabaseClient,
  userId: string,
  input: CreateCategoryInput,
) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, ...input, is_default: false })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateCategoryInput,
) {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
