'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { CandidateCard, type Candidate } from './CandidateCard';

export function CandidatesClient() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/candidates?status=pending');
    const json = await res.json();
    setRows(json?.data ?? []);
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cleanCount = useMemo(
    () =>
      rows.filter(
        (c) =>
          c.duplicate_status === 'none' &&
          !c.warnings.includes('amount_uncertain') &&
          !c.warnings.includes('date_uncertain'),
      ).length,
    [rows],
  );

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function selectAllClean() {
    const clean = rows
      .filter(
        (c) =>
          c.duplicate_status === 'none' &&
          !c.warnings.includes('amount_uncertain') &&
          !c.warnings.includes('date_uncertain'),
      )
      .map((c) => c.id);
    setSelected(new Set(clean));
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/candidates/approve-bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '실패');
      const a = json?.data?.approved?.length ?? 0;
      const s = json?.data?.skipped?.length ?? 0;
      setMessage(`승인 ${a}건${s ? ` · 건너뜀 ${s}건(중복/확인 필요)` : ''}`);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">분석 후보</h2>
        <Badge tone="muted">대기 {rows.length}건 · 안전 후보 {cleanCount}건</Badge>
      </div>

      {message && <p className="text-sm rounded-md bg-successSoft text-success px-3 py-2">{message}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="secondary" onClick={selectAllClean} disabled={cleanCount === 0}>
          안전 후보 전체 선택
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
          선택 해제 ({selected.size})
        </Button>
        <span className="text-xs text-textMuted">중복/확인 필요 항목은 일괄 승인에서 자동 제외됩니다.</span>
      </div>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardTitle>승인 대기 중인 후보가 없어요</CardTitle>
          <CardSubtle className="mt-1">AI 업로드에서 영수증을 올려보세요.</CardSubtle>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <CandidateCard
                c={c}
                selected={selected.has(c.id)}
                onSelect={toggle}
                onChange={load}
              />
            </li>
          ))}
        </ul>
      )}

      {/* 모바일 sticky 일괄 승인 바 */}
      {rows.length > 0 && (
        <div
          className="md:hidden fixed inset-x-0 bottom-[56px] z-20 bg-pageBackground/95 backdrop-blur border-t border-borderDefault px-4 py-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <Button onClick={bulkApprove} disabled={pending || selected.size === 0} fullWidth size="lg">
            선택 {selected.size}건 일괄 승인
          </Button>
        </div>
      )}

      {/* 데스크톱 하단 바 */}
      {rows.length > 0 && (
        <div className="hidden md:flex items-center justify-end gap-2">
          <Button onClick={bulkApprove} disabled={pending || selected.size === 0}>
            선택 {selected.size}건 일괄 승인
          </Button>
        </div>
      )}
    </div>
  );
}
