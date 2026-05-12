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

  // profiles 일괄 조회 — full_name + nickname (가입자 표 첫 컬럼 표시용)
  const userIds = users.map((u) => u.id);
  const profilesByUserId: Record<string, { full_name: string | null; nickname: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, full_name, nickname')
      .in('user_id', userIds);
    for (const p of (profiles ?? []) as Array<{ user_id: string; full_name: string | null; nickname: string | null }>) {
      profilesByUserId[p.user_id] = { full_name: p.full_name, nickname: p.nickname };
    }
  }

  // 거래 수 조회 (전체 누적)
  const counts: Record<string, number> = {};
  for (const u of users) {
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id);
    counts[u.id] = count ?? 0;
  }

  return users.map((u) => {
    // signup 폼은 full_name 을 supabase.auth.signUp({ options: { data: { full_name } } })
    // 으로 user_metadata 에 저장. DB 트리거 handle_new_user 는 profiles.full_name 을 안 채우므로
    // profiles 값이 null 이면 user_metadata 로 fallback — 모든 가입자 이름이 즉시 표시됨.
    const meta = ((u as any).user_metadata ?? {}) as {
      full_name?: string | null;
      nickname?: string | null;
    };
    return {
      id: u.id,
      email: u.email,
      full_name: profilesByUserId[u.id]?.full_name ?? meta.full_name ?? null,
      nickname: profilesByUserId[u.id]?.nickname ?? meta.nickname ?? null,
      last_sign_in_at: u.last_sign_in_at,
      created_at: u.created_at,
      banned_until: (u as any).banned_until ?? null,
      confirmed_at: u.confirmed_at,
      transactions_count: counts[u.id] ?? 0,
    };
  });
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
  // CASCADE 로 사용자 데이터 일괄 삭제.
  // shouldSoftDelete=false 명시 — 일부 supabase 버전에서 default 가 soft 일 수 있어
  // 명시적으로 hard delete (auth.users 행 자체 제거 → CASCADE FK 발동).
  const { error } = await admin.auth.admin.deleteUser(userId, false);
  if (error) {
    // 에러를 그대로 throw 하면 라우트가 INTERNAL 로 잡아 클라이언트에 표시.
    // 디버그 위해 message 에 status/code 포함되도록 보강.
    const msg = `[deleteUser] ${error.message ?? 'unknown'}${
      (error as any)?.code ? ` (code: ${(error as any).code})` : ''
    }`;
    throw new Error(msg);
  }
}
