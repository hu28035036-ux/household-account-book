'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Ban, RotateCcw, ShieldAlert, UserX } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { formatDateKST } from '@/lib/formatting/date';

type AllowedEmail = { id: string; email: string; note: string | null; created_at: string };
type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  nickname: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  banned_until: string | null;
  confirmed_at: string | null;
  transactions_count: number;
};

// 이름 마스킹 — 맨 앞 글자 + 가운데(○) + 맨 뒤 글자만 노출.
// 예: "허신회" → "허○회" / "김민지" → "김○지" / "이재훈민" → "이○○민"
function maskName(name: string | null): string {
  if (!name) return '-';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  const middle = '○'.repeat(trimmed.length - 2);
  return `${trimmed[0]}${middle}${trimmed[trimmed.length - 1]}`;
}

export function AdminClient({ currentEmail }: { currentEmail: string | null }) {
  const [allowed, setAllowed] = useState<AllowedEmail[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, uRes] = await Promise.all([
      fetch('/api/admin/allowed-emails').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ]);
    setAllowed(aRes?.data ?? []);
    setUsers(uRes?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEmail() {
    if (!emailInput.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/allowed-emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), note: noteInput.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '추가 실패');
      setAddOpen(false);
      setEmailInput('');
      setNoteInput('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setPending(false);
    }
  }

  async function removeEmail(row: AllowedEmail) {
    if (!confirm(`${row.email} 화이트리스트에서 제거할까요? (이미 가입된 사용자는 영향 없음)`)) return;
    const res = await fetch(`/api/admin/allowed-emails/${row.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  async function banToggle(u: UserRow) {
    const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
    const action = isBanned ? 'unban' : 'ban';
    const msg = isBanned ? `${u.email} 차단 해제` : `${u.email} 차단(영구)`;
    if (!confirm(msg + '하시겠어요?')) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) load();
  }

  async function deleteHard(u: UserRow) {
    const label = maskName(u.full_name) !== '-' ? maskName(u.full_name) : (u.email ?? u.id);
    const v = prompt(
      `${label} 계정을 영구 삭제합니다. 모든 거래/파일/예산이 함께 사라집니다.\n\n진행하려면 DELETE 입력`,
    );
    if (v !== 'DELETE') return;
    // confirm 은 query string 으로 전달 — 일부 환경에서 DELETE+body 가 stripped
    // 되는 호환성 이슈 우회 (서버는 query/body 둘 다 받음)
    const res = await fetch(`/api/admin/users/${u.id}?confirm=DELETE`, {
      method: 'DELETE',
    });
    if (res.ok) {
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(`삭제 실패: ${j?.error?.message ?? res.statusText}`);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary">관리자 콘솔</h2>
          <p className="mt-0.5 text-xs text-textSecondary">
            개발자 전용 — 일반 사용자에게는 메뉴와 페이지 모두 노출되지 않습니다.
            <code className="ml-1 px-1 rounded bg-sectionBackground text-textPrimary">ADMIN_EMAILS</code>{' '}
            환경변수로 식별합니다.
          </p>
        </div>
        <Badge tone="muted">
          <ShieldAlert className="h-3 w-3" strokeWidth={1.75} /> {currentEmail}
        </Badge>
      </div>

      {/* 메모/태그 (자유 가입 모드 전환 후 보조 용도) */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>이메일 메모 (선택)</CardTitle>
            <CardSubtle className="mt-1">
              자유 가입 모드입니다 — 이 목록은 가입을 차단하지 않습니다.
              운영자가 친구·가족·테스트 등 메모로 분류해두는 용도입니다.
              차단·삭제는 아래 가입자 표에서 진행하세요.
            </CardSubtle>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.75} /> 메모 추가
          </Button>
        </div>

        {loading ? (
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        ) : allowed.length === 0 ? (
          <CardSubtle className="mt-4">아직 등록된 이메일이 없습니다.</CardSubtle>
        ) : (
          <ul className="mt-4 divide-y divide-divider">
            {allowed.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-textPrimary truncate">{a.email}</div>
                  {a.note && <div className="text-xs text-textSecondary truncate">{a.note}</div>}
                  <div className="text-xs text-textMuted">{formatDateKST(a.created_at)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeEmail(a)} aria-label="제거">
                  <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 사용자 */}
      <Card>
        <CardTitle>가입자 목록</CardTitle>
        <CardSubtle className="mt-1">총 {users.length}명. 거래 수는 본 시점 누적.</CardSubtle>

        {loading ? (
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        ) : users.length === 0 ? (
          <CardSubtle className="mt-4">가입자가 없습니다.</CardSubtle>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-borderDefault">
            <table className="min-w-full text-sm">
              <thead className="bg-sectionBackground text-textSecondary">
                <tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">이름</th>
                  <th className="text-left px-3 py-2">이메일</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">가입</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">최근 로그인</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">거래 수</th>
                  <th className="text-left px-3 py-2">상태</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {users.map((u) => {
                  const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
                  return (
                    <tr key={u.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {u.full_name ? (
                          <span className="font-medium text-textPrimary">{maskName(u.full_name)}</span>
                        ) : (
                          <span className="text-textMuted">-</span>
                        )}
                        {u.nickname && (
                          <span className="ml-1.5 text-xs text-textMuted">({maskName(u.nickname)})</span>
                        )}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[260px]">{u.email ?? '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-textSecondary">
                        {formatDateKST(u.created_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-textSecondary">
                        {u.last_sign_in_at ? formatDateKST(u.last_sign_in_at) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right tabular">{u.transactions_count}</td>
                      <td className="px-3 py-2">
                        {banned ? (
                          <Badge tone="danger">차단됨</Badge>
                        ) : u.confirmed_at ? (
                          <Badge tone="success">활성</Badge>
                        ) : (
                          <Badge tone="muted">미인증</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => banToggle(u)} aria-label="차단/해제">
                            {banned ? (
                              <>
                                <RotateCcw className="h-4 w-4" strokeWidth={1.75} /> 해제
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 text-warning" strokeWidth={1.75} /> 차단
                              </>
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteHard(u)} aria-label="영구 삭제">
                            <UserX className="h-4 w-4 text-danger" strokeWidth={1.75} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="이메일 추가">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-textSecondary">이메일</span>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="friend@example.com"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">메모 (선택)</span>
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="예: 친구 영희"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            />
          </label>
          {error && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button onClick={addEmail} disabled={pending || !emailInput.trim()}>
              {pending ? '추가 중…' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
