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
    .select('user_id, nickname, display_name, full_name, username')
    .in('user_id', userIds);
  const map = new Map<string, any>();
  for (const p of profiles ?? []) map.set((p as any).user_id, p);

  return members.map((m: any) => {
    const p = map.get(m.user_id);
    return {
      ...m,
      nickname: p?.nickname ?? null,
      display_name: p?.display_name ?? null,
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

/**
 * 모임장(owner) 권한을 다른 멤버에게 위임.
 * - 현재 user 가 owner 여야 한다 (households.owner_id = userId 조건이 update 에 들어감)
 * - target 이 같은 모임 멤버여야 한다 (그렇지 않으면 update 실패)
 * - 작업:
 *   1) households.owner_id = newOwnerId 로 변경
 *   2) household_members.role 갱신: 기존 owner → 'member', new owner → 'owner'
 * RLS:
 *   - households.update 는 owner 만 허용 (owner_id 셀프 체크)
 *   - household_members.update 도 owner 또는 본인 만 허용해야 동작
 */
export async function transferOwner(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
  newOwnerId: string,
) {
  if (userId === newOwnerId) throw new Error('이미 모임장입니다.');

  // 대상이 같은 모임의 멤버인지 확인
  const { data: target } = await supabase
    .from('household_members')
    .select('user_id, role')
    .eq('household_id', householdId)
    .eq('user_id', newOwnerId)
    .maybeSingle();
  if (!target) throw new Error('대상이 이 모임의 멤버가 아닙니다.');

  // 1) households.owner_id 변경 — owner_id=userId 조건으로 RLS+권한 동시 검증
  const { data: hh, error: hErr } = await supabase
    .from('households')
    .update({ owner_id: newOwnerId })
    .eq('id', householdId)
    .eq('owner_id', userId)
    .select('*')
    .maybeSingle();
  if (hErr) throw hErr;
  if (!hh) throw new Error('권한이 없거나 모임을 찾을 수 없습니다.');

  // 2) members.role 갱신 — 두 행 순차 update (단일 트랜잭션 보장은 RPC 사용 시 가능하나, 실패 시 1단계만 롤백 어려움)
  const { error: oldErr } = await supabase
    .from('household_members')
    .update({ role: 'member' })
    .eq('household_id', householdId)
    .eq('user_id', userId);
  if (oldErr) throw oldErr;

  const { error: newErr } = await supabase
    .from('household_members')
    .update({ role: 'owner' })
    .eq('household_id', householdId)
    .eq('user_id', newOwnerId);
  if (newErr) throw newErr;

  return { household_id: householdId, new_owner_id: newOwnerId };
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
 * - 합류하려는 사용자는 아직 멤버가 아니므로 household_invites 를 직접 SELECT 할 수 없다
 *   (invites_select RLS 는 owner/멤버만 허용). 따라서 SECURITY DEFINER RPC 로 처리한다.
 * - RPC(join_household_by_code) 내부에서 코드 검증 + 멤버 추가 + 사용 처리(used_at/used_by)를
 *   원자적으로 수행한다. 코드는 unique 이므로 정확한 코드를 아는 사람만 합류 가능.
 */
export async function joinByInviteCode(supabase: SupabaseClient, _userId: string, code: string) {
  const { data, error } = await supabase.rpc('join_household_by_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message || '합류에 실패했습니다.');
  return { household_id: data as string };
}
