-- =========================================================
-- 초대 코드 합류 fix
-- 원인: household_invites.select 정책은 owner/기존 멤버만 허용한다.
--       합류하려는 사용자는 아직 멤버가 아니므로 코드로 invite 행을 SELECT 할 수 없어
--       항상 "초대 코드가 유효하지 않습니다." 로 실패했다.
--       또한 used_at 기록도 비멤버에게는 update 권한이 없어 동작하지 않았다.
-- 해결: SECURITY DEFINER RPC 로 코드 검증 + 멤버 추가 + 사용 처리를 원자적으로 수행.
--       함수 내부는 RLS 를 우회하므로 비멤버도 정확한 코드만 있으면 합류할 수 있다.
-- =========================================================

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.household_invites%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_invite
  from public.household_invites
  where code = upper(btrim(p_code))
  limit 1;

  if not found then
    raise exception '초대 코드가 유효하지 않습니다.';
  end if;
  if v_invite.used_at is not null then
    raise exception '이미 사용된 코드입니다.';
  end if;
  if v_invite.expires_at < now() then
    raise exception '만료된 코드입니다.';
  end if;

  -- 이미 멤버인 경우
  if exists (
    select 1 from public.household_members
    where household_id = v_invite.household_id and user_id = v_uid
  ) then
    raise exception '이미 가족 구성원입니다.';
  end if;

  insert into public.household_members (household_id, user_id, role, invited_by)
  values (v_invite.household_id, v_uid, 'member', v_invite.invited_by);

  -- 일회용 코드: 사용 처리
  update public.household_invites
  set used_at = now(), used_by = v_uid
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

revoke all on function public.join_household_by_code(text) from public;
grant execute on function public.join_household_by_code(text) to authenticated;
