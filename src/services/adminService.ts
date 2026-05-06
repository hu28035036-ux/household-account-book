import type { SupabaseClient } from '@supabase/supabase-js';

export async function listAllowedEmails(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('allowed_emails')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function addAllowedEmail(
  admin: SupabaseClient,
  email: string,
  note: string | null,
  addedBy: string,
) {
  const { data, error } = await admin
    .from('allowed_emails')
    .insert({ email: email.trim().toLowerCase(), note, added_by: addedBy })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeAllowedEmail(admin: SupabaseClient, id: string) {
  const { error } = await admin.from('allowed_emails').delete().eq('id', id);
  if (error) throw error;
}

export async function listUsers(admin: SupabaseClient) {
  // auth.admin API 사용
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const users = data.users ?? [];

  // 거래 수 조회 (최근 30일)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const counts: Record<string, number> = {};
  for (const u of users) {
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id);
    counts[u.id] = count ?? 0;
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
    banned_until: (u as any).banned_until ?? null,
    confirmed_at: u.confirmed_at,
    transactions_count: counts[u.id] ?? 0,
    _since30Days: since,
  }));
}

export async function banUser(admin: SupabaseClient, userId: string, durationHours = 87600) {
  // 100년 = 영구 차단 효과
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: `${durationHours}h`,
  } as any);
  if (error) throw error;
}

export async function unbanUser(admin: SupabaseClient, userId: string) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  } as any);
  if (error) throw error;
}

export async function deleteUserHard(admin: SupabaseClient, userId: string) {
  // CASCADE로 사용자 데이터 일괄 삭제
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
