import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationRow = {
  id: string;
  user_id: string;
  type: 'budget_caution' | 'budget_over' | 'duplicate_warning' | 'extraction_failed' | 'general';
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  dedup_key: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  scope: 'all' | 'unread' = 'all',
  limit = 50,
) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (scope === 'unread') query = query.is('read_at', null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function unreadCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export async function markAllRead(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteNotification(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

type CreateInput = {
  type: NotificationRow['type'];
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  dedupKey?: string;
};

export async function createNotification(
  supabase: SupabaseClient,
  userId: string,
  input: CreateInput,
) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      metadata: input.metadata ?? {},
      dedup_key: input.dedupKey ?? null,
    })
    .select('*')
    .single();
  // dedup_key 충돌(unique violation 23505) → 이미 발송됨, 조용히 skip
  if (error && (error as any).code === '23505') return null;
  if (error) throw error;
  return data;
}
