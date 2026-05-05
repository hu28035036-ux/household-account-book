'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { formatDateKST } from '@/lib/formatting/date';

type FileRow = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
  storage_path: string;
};

const STATUS_TONE: Record<string, any> = {
  uploaded: 'info',
  ocr_processing: 'info',
  ocr_done: 'success',
  ai_processing: 'pink',
  parsed: 'success',
  failed: 'danger',
  approved: 'success',
  deleted: 'muted',
};
const STATUS_LABEL: Record<string, string> = {
  uploaded: '업로드 완료',
  ocr_processing: 'OCR 진행',
  ocr_done: 'OCR 완료',
  ai_processing: '분석 중',
  parsed: '분석 완료',
  failed: '실패',
  approved: '승인됨',
  deleted: '삭제',
};

function fmtSize(bytes?: number | null) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function FilesClient() {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/files');
    const json = await res.json();
    setRows(json?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(row: FileRow) {
    if (!confirm(`'${row.file_name}'을(를) 삭제할까요? Storage에서도 함께 제거됩니다.`)) return;
    const res = await fetch(`/api/files/${row.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  async function preview(row: FileRow) {
    const res = await fetch(`/api/files/${row.id}`);
    const json = await res.json();
    const url = json?.data?.signed_url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">원본 파일</h2>
        <Badge tone="muted">총 {rows.length}건</Badge>
      </div>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardTitle>업로드한 파일이 없어요</CardTitle>
          <CardSubtle className="mt-1">AI 업로드에서 영수증/캡처를 올려보세요.</CardSubtle>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-textPrimary truncate">{r.file_name}</div>
                    <div className="text-xs text-textSecondary mt-0.5">
                      {formatDateKST(r.created_at)} · {fmtSize(r.file_size)}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => preview(r)}>
                    <Eye className="h-4 w-4" strokeWidth={1.75} /> 미리보기
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} /> 삭제
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
