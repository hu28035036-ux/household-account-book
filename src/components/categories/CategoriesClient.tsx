'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'common';
  color: string | null;
  icon: string | null;
  is_default: boolean;
};

const COLOR_PRESETS = ['#F472B6','#FBCFE8','#F9A8D4','#60A5FA','#10B981','#F59E0B','#EF4444','#8B5CF6','#22D3EE','#9CA3AF'];

export function CategoriesClient() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'common'>('expense');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/categories');
    const json = await res.json();
    setRows(json?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditing(null);
    setName('');
    setType('expense');
    setColor(COLOR_PRESETS[0]);
    setError(null);
    setOpen(true);
  }
  function startEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setType(c.type);
    setColor(c.color ?? COLOR_PRESETS[0]);
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body = { name: name.trim(), type, color };
      const res = await fetch(editing ? `/api/categories/${editing.id}` : '/api/categories', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '저장 실패');
      setOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setPending(false);
    }
  }

  async function remove(c: Category) {
    if (c.is_default) {
      alert('기본 카테고리는 삭제할 수 없습니다. 이름을 바꾸거나 새로 추가하세요.');
      return;
    }
    if (!confirm(`'${c.name}' 카테고리를 삭제할까요?`)) return;
    const res = await fetch(`/api/categories/${c.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">카테고리</h2>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" strokeWidth={1.75} /> 추가
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color ?? '#F472B6' }}
                  />
                  <div className="min-w-0">
                    <CardTitle className="truncate">{c.name}</CardTitle>
                    <div className="text-xs text-textSecondary mt-0.5 flex items-center gap-2">
                      <span>{c.type === 'income' ? '수입' : c.type === 'expense' ? '지출' : '공통'}</span>
                      {c.is_default && <Badge tone="muted">기본</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)} aria-label="수정">
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label="삭제">
                    <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? '카테고리 수정' : '카테고리 추가'}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-textSecondary">이름</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">유형</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            >
              <option value="expense">지출</option>
              <option value="income">수입</option>
              <option value="common">공통</option>
            </select>
          </label>
          <div>
            <span className="text-xs text-textSecondary">색상</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={
                    'h-8 w-8 rounded-full border-2 ' +
                    (c === color ? 'border-textPrimary' : 'border-transparent')
                  }
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
