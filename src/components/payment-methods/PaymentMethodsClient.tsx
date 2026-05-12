'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';

type PM = {
  id: string;
  name: string;
  type: 'card' | 'bank' | 'cash' | 'pay' | 'other';
  issuer_name: string | null;
  masked_number: string | null;
  is_default: boolean;
};

const TYPE_LABEL: Record<PM['type'], string> = {
  card: '카드',
  bank: '계좌',
  cash: '현금',
  pay: '간편결제',
  other: '기타',
};

export function PaymentMethodsClient() {
  const [rows, setRows] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PM | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<PM['type']>('card');
  const [issuer, setIssuer] = useState('');
  const [last4, setLast4] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/payment-methods');
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
    setType('card');
    setIssuer('');
    setLast4('');
    setError(null);
    setOpen(true);
  }
  function startEdit(p: PM) {
    setEditing(p);
    setName(p.name);
    setType(p.type);
    setIssuer(p.issuer_name ?? '');
    setLast4(p.masked_number?.slice(-4) ?? '');
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    if (last4 && !/^\d{4}$/.test(last4)) {
      setError('마지막 4자리는 숫자 4자만 허용합니다.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body: any = { name: name.trim(), type };
      if (issuer.trim()) body.issuer_name = issuer.trim();
      if (last4) body.last4 = last4;
      const res = await fetch(editing ? `/api/payment-methods/${editing.id}` : '/api/payment-methods', {
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

  async function remove(p: PM) {
    if (p.is_default) {
      alert('기본 결제수단은 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`'${p.name}'를 삭제할까요?`)) return;
    const res = await fetch(`/api/payment-methods/${p.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-textPrimary">결제수단</h2>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" strokeWidth={1.75} /> 추가
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardSubtle className="text-center py-6">불러오는 중…</CardSubtle>
        </Card>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className="p-3 sm:p-3 flex flex-col gap-2">
                {/* 상단: 결제수단 이름 */}
                <div className="text-sm font-semibold text-textPrimary truncate">{p.name}</div>
                {/* 중간: 유형/발급사/끝4자리/기본 */}
                <div className="text-[11px] text-textSecondary flex items-center gap-1.5 flex-wrap min-w-0">
                  <Badge tone="muted">{TYPE_LABEL[p.type]}</Badge>
                  {p.issuer_name && <span className="truncate">{p.issuer_name}</span>}
                  {p.masked_number && <span className="tabular truncate">{p.masked_number}</span>}
                  {p.is_default && <Badge tone="muted">기본</Badge>}
                </div>
                {/* 하단: 수정/삭제 버튼 */}
                <div className="flex items-center justify-end gap-0.5">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(p)} aria-label="수정" className="h-7 w-7 px-0">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label="삭제" className="h-7 w-7 px-0">
                    <Trash2 className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? '결제수단 수정' : '결제수단 추가'}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-textSecondary">이름</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 신한카드 The More"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-textSecondary">유형</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PM['type'])}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
              >
                <option value="card">카드</option>
                <option value="bank">계좌</option>
                <option value="cash">현금</option>
                <option value="pay">간편결제</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-textSecondary">발급사 (선택)</span>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="예: 신한"
                className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-textSecondary">마지막 4자리 (선택)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary tabular"
            />
            <span className="block mt-1 text-xs text-textMuted">전체 카드/계좌번호는 입력하지 않습니다. 끝 4자리만 저장됩니다.</span>
          </label>
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
