'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil, Users, Copy, LogOut, Ticket, Eye, Crown } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { formatDateKST } from '@/lib/formatting/date';
import { useActiveHousehold } from '@/lib/active-household';

type Household = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  is_owner: boolean;
  member_count: number;
};
type Member = {
  id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  nickname: string | null;
  display_name: string | null;
  full_name: string | null;
  username: string | null;
};
type Invite = { id: string; code: string; expires_at: string; used_at: string | null; created_at: string };

export function HouseholdsClient({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const { setActive: setGlobalActive } = useActiveHousehold();
  const [list, setList] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');

  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinPending, setJoinPending] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/households');
    const json = await res.json();
    const rows: Household[] = json?.data ?? [];
    setList(rows);
    if (!activeId && rows[0]) setActiveId(rows[0].id);
    setLoading(false);
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetails = useCallback(async (id: string) => {
    const [mRes, iRes] = await Promise.all([
      fetch(`/api/households/${id}/members`).then((r) => r.json()),
      fetch(`/api/households/${id}/invites`).then((r) => r.json()),
    ]);
    setMembers(mRes?.data ?? []);
    setInvites(iRes?.data ?? []);
  }, []);

  useEffect(() => {
    if (activeId) loadDetails(activeId);
  }, [activeId, loadDetails]);

  async function createOne() {
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '생성 실패');
      setCreateOpen(false);
      setName('');
      setActiveId(json?.data?.id ?? null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setPending(false);
    }
  }

  async function leaveOrDelete(h: Household) {
    if (h.is_owner) {
      if (!confirm(`'${h.name}' 가족을 삭제할까요? 같은 household_id로 묶인 거래/예산은 개인 데이터로 남습니다(레퍼런스만 끊김).`)) return;
      const res = await fetch(`/api/households/${h.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeId === h.id) setActiveId(null);
        load();
      }
    } else {
      if (!confirm(`'${h.name}' 가족에서 탈퇴할까요?`)) return;
      const res = await fetch(`/api/households/${h.id}/members/${currentUserId}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeId === h.id) setActiveId(null);
        load();
      }
    }
  }

  async function rename(h: Household) {
    const newName = prompt('새 이름', h.name);
    if (!newName || newName === h.name) return;
    const res = await fetch(`/api/households/${h.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) load();
  }

  async function newInvite() {
    if (!activeId) return;
    const res = await fetch(`/api/households/${activeId}/invites`, { method: 'POST' });
    if (res.ok) loadDetails(activeId);
  }

  async function revoke(inv: Invite) {
    if (!activeId) return;
    if (!confirm(`초대 코드 ${inv.code}를 폐기할까요?`)) return;
    const res = await fetch(`/api/households/${activeId}/invites/${inv.id}`, { method: 'DELETE' });
    if (res.ok) loadDetails(activeId);
  }

  async function transferOwner(m: Member) {
    if (!activeId) return;
    const displayName =
      m.nickname?.trim() ||
      m.display_name?.trim() ||
      m.full_name?.trim() ||
      m.username?.trim() ||
      `사용자 ${m.user_id.slice(0, 8)}`;
    if (
      !confirm(
        `${displayName} 님에게 모임장 권한을 넘길까요?\n\n이후 본인은 일반 멤버가 되며, 모임 삭제·이름 변경·멤버 추방 권한이 사라집니다.`,
      )
    )
      return;
    const res = await fetch(
      `/api/households/${activeId}/members/${m.user_id}/transfer-owner`,
      { method: 'POST', cache: 'no-store' },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(`위임 실패 (HTTP ${res.status}): ${j?.error?.message ?? res.statusText}`);
      return;
    }
    alert(`${displayName} 님을 새 모임장으로 임명했습니다.`);
    await load();
    await loadDetails(activeId);
  }

  async function removeMem(m: Member) {
    if (!activeId) return;
    const displayName =
      m.nickname?.trim() ||
      m.display_name?.trim() ||
      m.full_name?.trim() ||
      m.username?.trim() ||
      `사용자 ${m.user_id.slice(0, 8)}`;
    if (!confirm(`${displayName} 님을 이 모임에서 추방할까요?\n\n해당 멤버는 모임의 거래·예산을 더 이상 볼 수 없습니다. (개인 데이터는 보존)`)) return;
    const res = await fetch(`/api/households/${activeId}/members/${m.user_id}`, {
      method: 'DELETE',
      cache: 'no-store',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(`추방 실패 (HTTP ${res.status}): ${j?.error?.message ?? res.statusText}`);
      return;
    }
    loadDetails(activeId);
  }

  async function joinByCode() {
    if (!code.trim()) {
      setJoinError('초대 코드를 입력하세요.');
      return;
    }
    setJoinPending(true);
    setJoinError(null);
    try {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '합류 실패');
      setJoinOpen(false);
      setCode('');
      setActiveId(json?.data?.household_id ?? null);
      load();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : '합류 실패');
    } finally {
      setJoinPending(false);
    }
  }

  function copyCode(c: string) {
    navigator.clipboard?.writeText(c).catch(() => {});
  }

  const active = list.find((h) => h.id === activeId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">모임</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setJoinOpen(true)}>
            <Ticket className="h-4 w-4" strokeWidth={1.75} /> 초대 코드로 합류
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.75} /> 새 모임 만들기
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardTitle>아직 모임이 없어요</CardTitle>
          <CardSubtle className="mt-1">
            새 모임을 만들거나, 다른 사람이 보낸 초대 코드로 합류할 수 있어요.
          </CardSubtle>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardTitle>내 모임 목록</CardTitle>
            <ul className="mt-3 space-y-2">
              {list.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => setActiveId(h.id)}
                    className={
                      'w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-md ' +
                      (activeId === h.id
                        ? 'bg-primaryPinkSoft text-textPinkStrong'
                        : 'hover:bg-softPinkBackground text-textSecondary')
                    }
                  >
                    <span className="min-w-0 truncate">{h.name}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {h.is_owner && <Badge tone="pink">owner</Badge>}
                      <Badge tone="muted">
                        <Users className="h-3 w-3" strokeWidth={1.75} /> {h.member_count}
                      </Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-2">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle>{active.name}</CardTitle>
                  {/* 액션 버튼 통일 — h-8 / px-2 / text-xs (한 줄 유지용 컴팩트 사이즈) */}
                  <div className="flex items-center gap-1 flex-nowrap">
                    <Button
                      size="sm"
                      onClick={() => {
                        setGlobalActive(active.id);
                        router.push('/dashboard');
                      }}
                      className="!h-8 !px-2 !text-xs !gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> 모임 보기
                    </Button>
                    {active.is_owner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rename(active)}
                        className="!h-8 !px-2 !text-xs !gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> 이름
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => leaveOrDelete(active)}
                      className="!h-8 !px-2 !text-xs !gap-1"
                    >
                      {active.is_owner ? (
                        <>
                          <Trash2 className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} /> 삭제
                        </>
                      ) : (
                        <>
                          <LogOut className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} /> 탈퇴
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <CardSubtle className="mt-1">
                  생성일 {formatDateKST(active.created_at)} · 멤버 {active.member_count}명
                </CardSubtle>

                {/* 멤버 */}
                <div className="mt-4">
                  <div className="text-sm font-medium text-textPrimary mb-2">멤버</div>
                  <ul className="space-y-1">
                    {members.map((m) => {
                      // 표시 우선순위: 별명 > 이름 > 아이디 > UUID 앞 8자
                      const displayName =
                        m.nickname?.trim() ||
                        m.display_name?.trim() ||
                        m.full_name?.trim() ||
                        m.username?.trim() ||
                        `사용자 ${m.user_id.slice(0, 8)}`;
                      const isMe = m.user_id === currentUserId;
                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                            <span className="text-textPrimary truncate">{displayName}</span>
                            {isMe && <Badge tone="muted">나</Badge>}
                            {m.nickname && m.full_name && (
                              <span className="text-xs text-textMuted truncate">
                                ({m.full_name})
                              </span>
                            )}
                            <span className="ml-auto text-xs text-textSecondary whitespace-nowrap">
                              {formatDateKST(m.joined_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge tone={m.role === 'owner' ? 'pink' : 'muted'}>
                              {m.role === 'owner' ? '총무' : '멤버'}
                            </Badge>
                            {active.is_owner && !isMe && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => transferOwner(m)}
                                  title="모임장 권한 위임"
                                  className="!h-7 !px-2 !text-xs text-textPinkStrong"
                                >
                                  <Crown className="h-3.5 w-3.5" strokeWidth={1.75} />
                                  위임
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeMem(m)}
                                  title="멤버 추방"
                                  className="!h-7 !px-2 !text-xs text-danger"
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                                  추방
                                </Button>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {members.length === 0 && (
                      <li className="text-sm text-textSecondary">멤버가 없습니다.</li>
                    )}
                  </ul>
                </div>

                {/* 초대 코드 */}
                {active.is_owner && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-sm font-medium text-textPrimary">초대 코드</div>
                      <Button size="sm" onClick={newInvite}>
                        <Plus className="h-4 w-4" strokeWidth={1.75} /> 새 코드 발급
                      </Button>
                    </div>
                    <ul className="space-y-1">
                      {invites.map((inv) => {
                        const expired = new Date(inv.expires_at).getTime() < Date.now();
                        return (
                          <li
                            key={inv.id}
                            className="flex items-center justify-between gap-2 text-sm border border-borderDefault rounded-md px-3 py-2"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-textPrimary">{inv.code}</span>
                              <span className="ml-2 text-xs text-textSecondary">
                                만료 {formatDateKST(inv.expires_at)}
                              </span>
                              {inv.used_at && (
                                <Badge tone="muted" className="ml-2">
                                  사용됨
                                </Badge>
                              )}
                              {expired && !inv.used_at && (
                                <Badge tone="warning" className="ml-2">
                                  만료
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => copyCode(inv.code)}>
                                <Copy className="h-4 w-4" strokeWidth={1.75} />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => revoke(inv)}>
                                <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                      {invites.length === 0 && (
                        <li className="text-sm text-textSecondary">발급된 코드가 없습니다.</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <CardSubtle>왼쪽에서 가족을 선택하세요.</CardSubtle>
            )}
          </Card>
        </div>
      )}

      {/* 새 가족 모달 */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="새 가족 만들기">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-textSecondary">이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 우리집"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
          </label>
          {error && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button onClick={createOne} disabled={pending || !name.trim()}>
              {pending ? '생성 중…' : '만들기'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 합류 모달 */}
      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="초대 코드로 합류">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-textSecondary">초대 코드</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="예: AB23CDEF45"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary font-mono uppercase"
              maxLength={20}
            />
          </label>
          {joinError && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{joinError}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setJoinOpen(false)} disabled={joinPending}>
              취소
            </Button>
            <Button onClick={joinByCode} disabled={joinPending || !code.trim()}>
              {joinPending ? '합류 중…' : '합류하기'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
