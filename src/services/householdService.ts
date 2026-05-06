import type { SupabaseClient } from '@supabase/supabase-js';

function genCode(len = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 혼동 글자 제외
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function listMyHouseholds(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('households')
    .select('*, household_members(user_id, role)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  // RLS로 자동 필터링되지만 owner/member 표시를 위해 추가 가공
  return (data ?? []).map((h: any) => ({
    ...h,
    is_owner: h.owner_id === userId,
    member_count: (h.household_members ?? []).length,
  }));
}

export async function createHousehold(supabase: SupabaseClient, userId: string, name: string) {
  const { data: hh, error } = await supabase
    .from('households')
    .insert({ name, owner_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  // owner는 멤버에도 추가
  const { error: mErr } = await supabase.from('household_members').insert({
    household_id: hh.id,
    user_id: userId,
    role: 'owner',
  });
  if (mErr) throw mErr;
  return hh;
}

export async function renameHousehold(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  name: string,
) {
  const { data, error } = await supabase
    .from('households')
    .update({ name })
    .eq('id', id)
    .eq('owner_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHousehold(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from('households').delete().eq('id', id).eq('owner_id', userId);
  if (error) throw error;
}

export async function listMembers(supabase: SupabaseClient, householdId: string) {
  const { data: members, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  if (!members || members.length === 0) return [];

  // 별명/이름 표시를 위해 같은 모임 멤버의 profile 정보 조회
  const userIds = members.map((m: any) => m.user_id as string);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, nickname, full_name, username')
    .in('user_id', userIds);
  const map = new Map<string, any>();
  for (const p of profiles ?? []) map.set((p as any).user_id, p);

  return members.map((m: any) => {
    const p = map.get(m.user_id);
    return {
      ...m,
      nickname: p?.nickname ?? null,
      full_name: p?.full_name ?? null,
      username: p?.username ?? null,
    };
  });
}

export async function removeMember(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
  targetUserId: string,
) {
  // 본인 탈퇴 또는 owner의 강제 제거 (RLS에서도 보장)
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', targetUserId);
  if (error) throw error;
}

export async function createInvite(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
  ttlDays = 7,
) {
  const code = genCode(10);
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      code,
      invited_by: userId,
      expires_at: expires,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listInvites(supabase: SupabaseClient, householdId: string) {
  const { data, error } = await supabase
    .from('household_invites')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokeInvite(supabase: SupabaseClient, householdId: string, inviteId: string) {
  const { error } = await supabase
    .from('household_invites')
    .delete()
    .eq('household_id', householdId)
    .eq('id', inviteId);
  if (error) throw error;
}

/**
 * 초대 코드로 가족에 합류.
 * - 코드가 유효(not used, not expired)해야 함
 * - household_members에 본인 등록 (own user_id) — RLS의 with_check에 의해 본인만 추가 가능
 * - 코드 사용 처리(used_at/used_by) — 본인은 update 권한이 없으므로 admin client 또는 RPC 함수가 필요.
 *   여기서는 used_at만 기록하지 못해도 expires로 제한되므로 일단 1회 사용 후 코드 자체를 폐기하지는 않음.
 *   대신 멤버십 unique 제약으로 같은 사용자가 같은 household에 두 번 들어갈 수는 없음.
 */
export async function joinByInviteCode(supabase: SupabaseClient, userId: string, code: string) {
  const { data: invite, error } = await supabase
    .from('household_invites')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!invite) throw new Error('초대 코드가 유효하지 않습니다.');
  if (invite.used_at) throw new Error('이미 사용된 코드입니다.');
  if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error('만료된 코드입니다.');

  const { error: mErr } = await supabase.from('household_members').insert({
    household_id: invite.household_id,
    user_id: userId,
    role: 'member',
    invited_by: invite.invited_by,
  });
  if (mErr) {
    // unique 위반 → 이미 멤버
    if ((mErr as any).code === '23505') throw new Error('이미 가족 구성원입니다.');
    throw mErr;
  }
  return { household_id: invite.household_id };
}
