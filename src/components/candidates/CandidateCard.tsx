'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatKRW, parseKRWInput } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';

export type Candidate = {
  id: string;
  transaction_date: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number | null;
  merchant_name: string | null;
  description: string | null;
  category_suggestion: string | null;
  payment_method_suggestion: string | null;
  confidence: number;
  duplicate_status: 'none' | 'suspected' | 'duplicate';
  raw_text_basis: string | null;
  warnings: string[];
  user_action: 'pending' | 'approved' | 'rejected' | 'edited';
};

type Props = {
  c: Candidate;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onChange: () => void;
};

const WARN_LABELS: Record<string, string> = {
  date_uncertain: '날짜 확인 필요',
  amount_uncertain: '금액 확인 필요',
  merchant_uncertain: '가맹점 확인 필요',
  category_uncertain: '카테고리 확인 필요',
  basis_not_found: '근거 텍스트 누락',
  differs_from_user_pattern: '평소 패턴과 다름',
  recurring_candidate: '반복 지출 가능성',
};

export function CandidateCard({ c, selected, onSelect, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(c.transaction_date ?? '');
  const [type, setType] = useState(c.type);
  const [amountStr, setAmountStr] = useState(c.amount?.toString() ?? '');
  const [merchant, setMerchant] = useState(c.merchant_name ?? '');
  const [category, setCategory] = useState(c.category_suggestion ?? '');
  const [payment, setPayment] = useState(c.payment_method_suggestion ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(c.transaction_date ?? '');
    setType(c.type);
    setAmountStr(c.amount?.toString() ?? '');
    setMerchant(c.merchant_name ?? '');
    setCategory(c.category_suggestion ?? '');
    setPayment(c.payment_method_suggestion ?? '');
  }, [c.id, c.transaction_date, c.type, c.amount, c.merchant_name, c.category_suggestion, c.payment_method_suggestion]);

  const conf = Math.round(c.confidence * 100);
  const isDup = c.duplicate_status !== 'none';
  const isReview = c.warnings.includes('date_uncertain') || c.warnings.includes('amount_uncertain');
  const canSelect = !isDup && !isReview;

  async function saveEdit() {
    setPending(true);
    setError(null);
    try {
      const amount = parseKRWInput(amountStr);
      const body = {
        transaction_date: date || null,
        type,
        amount,
        merchant_name: merchant || null,
        category_suggestion: category || null,
        payment_method_suggestion: payment || null,
      };
      const res = await fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? '수정 실패');
      }
      setEditing(false);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setPending(false);
    }
  }

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${c.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? '승인 실패');
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인 실패');
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${c.id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? '제외 실패');
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '제외 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1.5 h-5 w-5 rounded border-borderDefault text-primaryPink focus:ring-primaryPinkBorder"
          checked={selected}
          disabled={!canSelect}
          onChange={(e) => onSelect(c.id, e.target.checked)}
          aria-label="일괄 승인 선택"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-base font-semibold text-textPrimary truncate">
                {c.merchant_name || '미지정 가맹점'}
              </div>
              <div className="mt-0.5 text-xs text-textSecondary">
                {c.transaction_date ? formatDateKST(c.transaction_date) : '날짜 없음'} ·{' '}
                {c.category_suggestion ?? '카테고리 ?'} · {c.payment_method_suggestion ?? '결제수단 ?'}
              </div>
            </div>
            <div
              className={
                'tabular text-base font-semibold whitespace-nowrap ' +
                (c.type === 'income' ? 'text-income' : c.type === 'transfer' ? 'text-transfer' : 'text-expense')
              }
            >
              {c.amount == null
                ? '금액 ?'
                : (c.type === 'income' ? '+' : c.type === 'expense' ? '-' : '') + formatKRW(c.amount)}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge tone={conf >= 70 ? 'success' : conf >= 40 ? 'warning' : 'review'}>신뢰도 {conf}%</Badge>
            {c.duplicate_status === 'suspected' && <Badge tone="duplicate">중복 의심</Badge>}
            {c.duplicate_status === 'duplicate' && <Badge tone="review">중복 가능성 높음</Badge>}
            {c.warnings.map((w) => (
              <Badge key={w} tone={w === 'differs_from_user_pattern' ? 'warning' : 'review'}>
                {WARN_LABELS[w] ?? w}
              </Badge>
            ))}
          </div>

          {c.raw_text_basis && (
            <div className="mt-2 text-xs text-textMuted">
              근거: <span className="font-mono">{c.raw_text_basis}</span>
            </div>
          )}

          {editing && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-textSecondary">날짜</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-textSecondary">유형</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'income' | 'expense' | 'transfer')}
                  className="flex-1 h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                >
                  <option value="expense">지출</option>
                  <option value="income">수입</option>
                  <option value="transfer">이체</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-textSecondary">금액</span>
                <input
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="예: 12000"
                  className="flex-1 h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm tabular"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-textSecondary">가맹점</span>
                <input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="예: 스타벅스 강남점"
                  className="flex-1 h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-textSecondary">카테고리</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="예: 카페/간식"
                  className="flex-1 h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-textSecondary">결제수단</span>
                <input
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  placeholder="예: 신용카드"
                  className="flex-1 h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                />
              </label>
            </div>
          )}

          {error && <p className="mt-2 text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}

          <div className="mt-3 flex items-center justify-end gap-1 flex-wrap">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                  취소
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={pending}>
                  저장
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
                  수정
                </Button>
                <Button size="sm" variant="ghost" onClick={reject} disabled={pending}>
                  제외
                </Button>
                <Button size="sm" onClick={approve} disabled={pending}>
                  승인
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
