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
  const duplicateRows = useMemo(
    () => rows.filter((c) => c.duplicate_status === 'duplicate'),
    [rows],
  );

  // 같은 업로드 파일에서 나온 후보들을 그룹화 (카뱅/카드 다행 캡처 케이스).
  // uploaded_file_id 가 없으면 단일 그룹(_orphan).
  const groups = useMemo(() => {
    const map = new Map<string, { fileId: string | null; fileName: string | null; items: Candidate[] }>();
    for (const r of rows) {
      const fid = r.uploaded_file_id ?? '_orphan';
      const fname = r._file?.file_name ?? null;
      if (!map.has(fid)) map.set(fid, { fileId: r.uploaded_file_id ?? null, fileName: fname, items: [] });
      map.get(fid)!.items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

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

  async function bulkRejectDuplicates() {
    if (duplicateRows.length === 0) return;
    if (
      !confirm(
        `중복 가능성 높음 ${duplicateRows.length}건을 일괄 거부할까요? 거래내역에는 등록되지 않습니다.`,
      )
    )
      return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/candidates/reject-bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: duplicateRows.map((r) => r.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '실패');
      const r = json?.data?.rejected ?? 0;
      setMessage(`중복 의심 ${r}건 일괄 거부됨`);
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

      {/* 액션바 — 모든 버튼 통일 사이즈: h-9 / px-3 / text-sm (= Button size="sm") */}
      <div className="sticky top-14 z-10 -mx-4 px-4 py-2 bg-pageBackground/95 backdrop-blur border-b border-borderSoft md:static md:top-auto md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-0 md:border-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={selectAllClean} disabled={cleanCount === 0}>
            안전 후보 전체 선택
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            선택 해제 ({selected.size})
          </Button>
          {duplicateRows.length > 0 && (
            <Button
              size="sm"
              variant="danger"
              onClick={bulkRejectDuplicates}
              disabled={pending}
            >
              중복 {duplicateRows.length}건 일괄 거부
            </Button>
          )}
          <div className="ml-auto">
            <Button size="sm" onClick={bulkApprove} disabled={pending || selected.size === 0}>
              {selected.size > 0 ? `선택 ${selected.size}건 일괄 승인` : '일괄 승인'}
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-textMuted">
          중복/확인 필요 항목은 일괄 승인에서 자동 제외됩니다.
          {duplicateRows.length > 0 && (
            <>
              {' '}중복 가능성 높음 <b className="text-danger">{duplicateRows.length}건</b>은
              위 버튼으로 한 번에 거부할 수 있어요.
            </>
          )}
        </p>
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
        <div className="space-y-5">
          {groups.map((g, gi) => {
            // 그룹이 1개뿐(단일 영수증)이면 헤더 생략해 시각 노이즈 최소화.
            const showHeader = g.items.length > 1;
            const groupIds = g.items.map((c) => c.id);
            const groupSelectedCount = groupIds.filter((id) => selected.has(id)).length;
            const groupAllSelected = groupIds.every((id) => selected.has(id));
            function toggleGroup() {
              setSelected((prev) => {
                const next = new Set(prev);
                if (groupAllSelected) groupIds.forEach((id) => next.delete(id));
                else
                  g.items.forEach((c) => {
                    const canSel =
                      c.duplicate_status === 'none' &&
                      !c.warnings.includes('amount_uncertain') &&
                      !c.warnings.includes('date_uncertain');
                    if (canSel) next.add(c.id);
                  });
                return next;
              });
            }
            return (
              <div key={g.fileId ?? `orphan-${gi}`} className="space-y-2">
                {showHeader && (
                  <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-textSecondary px-1">
                    <div className="min-w-0 truncate">
                      📎 <b className="text-textPrimary">{g.fileName ?? '원본 파일'}</b>
                      <span className="ml-1.5 text-textMuted">— {g.items.length}건 추출</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleGroup}
                      disabled={pending}
                      className="text-xs text-textPinkStrong underline underline-offset-2 disabled:opacity-50"
                    >
                      {groupAllSelected
                        ? '이 파일의 안전 후보 선택 해제'
                        : `이 파일의 안전 후보 전체 선택 (${groupSelectedCount}/${g.items.length})`}
                    </button>
                  </div>
                )}
                <ul className="space-y-3">
                  {g.items.map((c) => (
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
              </div>
            );
          })}
        </div>
      )}

      {/* 모바일 하단 sticky — 통일 사이즈: h-9 / px-3 / text-sm (= Button size="sm") */}
      {rows.length > 0 && (
        <div
          className="md:hidden fixed inset-x-0 bottom-[56px] z-20 bg-pageBackground/95 backdrop-blur border-t border-borderDefault px-4 py-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <Button onClick={bulkApprove} disabled={pending || selected.size === 0} fullWidth size="sm">
            선택 {selected.size}건 일괄 승인
          </Button>
        </div>
      )}

    </div>
  );
}
