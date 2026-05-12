'use client';

import { useEffect, useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { BirthdateSelect } from '@/components/common/BirthdateSelect';

type Me = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  birthdate: string | null; // YYYY-MM-DD
  nickname: string | null;
};

export function ProfileCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // 편집 폼 state
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((j) => {
        const data = j?.data as Me | null;
        setMe(data);
        setFullName(data?.full_name ?? '');
        setBirthdate(data?.birthdate ?? '');
        setNickname(data?.nickname ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  function startEdit() {
    setError(null);
    setOkMsg(null);
    setFullName(me?.full_name ?? '');
    setBirthdate(me?.birthdate ?? '');
    setNickname(me?.nickname ?? '');
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setOkMsg(null);
    setEditing(false);
  }

  async function save() {
    setError(null);
    setOkMsg(null);
    setPending(true);
    try {
      // 빈 값은 PATCH body 에서 제외 — server validation 의 min(1) 에 걸리지 않게.
      // (별명만 수정하려는데 본명이 처음부터 비어있는 케이스 등)
      const trimmedName = fullName.trim();
      const trimmedNickname = nickname.trim();
      const body: Record<string, unknown> = {
        nickname: trimmedNickname || null, // 빈 별명은 명시적으로 null (지우기 동작)
      };
      if (trimmedName) body.full_name = trimmedName;
      if (birthdate) body.birthdate = birthdate;

      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? '저장 실패');
      setMe(j.data as Me);
      setEditing(false);
      setOkMsg('저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>개인 프로필</CardTitle>
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={startEdit} disabled={loading || !me}>
            수정
          </Button>
        )}
      </div>

      {loading ? (
        <CardSubtle className="mt-3">불러오는 중…</CardSubtle>
      ) : !me ? (
        <CardSubtle className="mt-3">프로필을 불러올 수 없습니다.</CardSubtle>
      ) : !editing ? (
        <ul className="mt-3 text-sm space-y-1.5">
          <li>
            <span className="text-textSecondary w-20 inline-block">아이디</span>
            <span className="text-textPrimary">{me.username ?? '-'}</span>
          </li>
          <li>
            <span className="text-textSecondary w-20 inline-block">이름</span>
            <span className="text-textPrimary">{me.full_name ?? '-'}</span>
          </li>
          <li>
            <span className="text-textSecondary w-20 inline-block">생년월일</span>
            <span className="text-textPrimary tabular">{me.birthdate ?? '-'}</span>
          </li>
          <li>
            <span className="text-textSecondary w-20 inline-block">이메일</span>
            <span className="text-textPrimary">{me.email ?? '-'}</span>
          </li>
          <li>
            <span className="text-textSecondary w-20 inline-block">별명</span>
            {me.nickname ? (
              <Badge tone="pink">{me.nickname}</Badge>
            ) : (
              <span className="text-textMuted">설정되지 않음</span>
            )}
          </li>
        </ul>
      ) : (
        <div className="mt-3 space-y-3">
          <CardSubtle>
            아이디·이메일은 변경되지 않습니다. 이름/생년월일/별명만 수정할 수 있어요.
          </CardSubtle>
          <div className="text-xs text-textSecondary">
            <span className="w-20 inline-block">아이디</span>
            <span className="text-textPrimary">{me.username ?? '-'}</span>
            <span className="ml-3 w-20 inline-block">이메일</span>
            <span className="text-textPrimary">{me.email ?? '-'}</span>
          </div>

          <label className="block">
            <span className="text-xs text-textSecondary">이름</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={40}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
          </label>

          <div>
            <span className="text-xs text-textSecondary">생년월일</span>
            <div className="mt-1">
              <BirthdateSelect value={birthdate} onChange={setBirthdate} />
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-textSecondary">별명 (특수문자 가능)</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={40}
              placeholder="예: 달려라봉봉 / 재훈 / dev_kim"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
            <span className="block mt-1 text-xs text-textMuted">
              모임 멤버 목록에서 별명이 우선 표시됩니다. 비워두면 이름이 표시됩니다.
            </span>
          </label>

          {error && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
              취소
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !fullName.trim()}>
              {pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>
      )}

      {!editing && okMsg && (
        <p className="mt-3 text-sm rounded-md bg-successSoft text-success px-3 py-2">{okMsg}</p>
      )}
    </Card>
  );
}
