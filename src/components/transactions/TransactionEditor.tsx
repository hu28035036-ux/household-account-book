'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { todayKSTISO } from '@/lib/formatting/date';
import { parseKRWInput } from '@/lib/formatting/money';
import { useActiveHousehold } from '@/lib/active-household';

type Category = { id: string; name: string; type: string };
type PaymentMethod = { id: string; name: string };

type Initial = {
  id?: string;
  transaction_date?: string;
  type?: 'income' | 'expense' | 'transfer';
  amount?: number;
  merchant_name?: string | null;
  category_id?: string | null;
  payment_method_id?: string | null;
  memo?: string | null;
  household_id?: string | null;
  recurring_rule_id?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Initial;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onSaved: () => void;
};

export function TransactionEditor({ open, onClose, initial, categories, paymentMethods, onSaved }: Props) {
  const editing = !!initial?.id;
  const { activeId, households } = useActiveHousehold();
  const [date, setDate] = useState(initial?.transaction_date ?? todayKSTISO());
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(initial?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(initial?.amount ? String(initial.amount) : '');
  const [merchant, setMerchant] = useState(initial?.merchant_name ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.payment_method_id ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [householdId, setHouseholdId] = useState<string | null>(
    initial?.household_id ?? (editing ? null : activeId),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 룰에서 발생한 거래일 때만 노출되는 적용 범위 옵션.
  const [ruleScope, setRuleScope] = useState<'this' | 'all'>('this');
  const ruleId = initial?.recurring_rule_id ?? null;

  useEffect(() => {
    if (!open) return;
    setDate(initial?.transaction_date ?? todayKSTISO());
    setType(initial?.type ?? 'expense');
    setAmountStr(initial?.amount ? String(initial.amount) : '');
    setMerchant(initial?.merchant_name ?? '');
    setCategoryId(initial?.category_id ?? '');
    setPaymentMethodId(initial?.payment_method_id ?? '');
    setMemo(initial?.memo ?? '');
    setHouseholdId(initial?.household_id ?? (editing ? null : activeId));
    setRuleScope('this');
    setError(null);
  }, [open, initial, editing, activeId]);

  async function save() {
    setError(null);
    const amount = parseKRWInput(amountStr);
    if (amount === null) {
      setError('금액을 입력하세요.');
      return;
    }
    setPending(true);
    try {
      const body = {
        transaction_date: date,
        type,
        amount,
        merchant_name: merchant || null,
        category_id: categoryId || null,
        payment_method_id: paymentMethodId || null,
        memo: memo || null,
        household_id: householdId,
      };
      const res = await fetch(editing ? `/api/transactions/${initial!.id}` : '/api/transactions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '저장 실패');

      // 룰에서 발생한 거래의 "전체 수정" 선택 시 — 룰 템플릿도 함께 갱신.
      if (editing && ruleId && ruleScope === 'all') {
        await fetch(`/api/recurring/${ruleId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type,
            amount,
            merchant_name: merchant || null,
            category_id: categoryId || null,
            payment_method_id: paymentMethodId || null,
            memo: memo || null,
          }),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '거래 수정' : '거래 추가'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-textSecondary">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">유형</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'income' | 'expense' | 'transfer')}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            >
              <option value="expense">지출</option>
              <option value="income">수입</option>
              <option value="transfer">이체</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-textSecondary">금액</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="예: 5800"
            className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary tabular"
          />
        </label>
        <label className="block">
          <span className="text-xs text-textSecondary">가맹점</span>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="예: 스타벅스 강남점"
            className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-textSecondary">카테고리</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            >
              <option value="">미지정</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-textSecondary">결제수단</span>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            >
              <option value="">미지정</option>
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-textSecondary">메모</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-borderDefault bg-white text-textPrimary"
          />
        </label>
        {households.length > 0 && (
          <label className="block">
            <span className="text-xs text-textSecondary">공유 범위</span>
            <select
              value={householdId ?? ''}
              onChange={(e) => setHouseholdId(e.target.value || null)}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
            >
              <option value="">개인 (공유 안 함)</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} (모임)
                </option>
              ))}
            </select>
            <span className="block mt-1 text-xs text-textMuted">
              모임으로 저장하면 해당 모임 멤버 모두가 이 거래를 볼 수 있습니다(읽기 전용).
            </span>
          </label>
        )}
        {editing && ruleId && (
          <div className="rounded-md border border-borderSoft p-3">
            <div className="text-xs text-textSecondary mb-2">고정 거래에서 자동 등록된 거래입니다 — 적용 범위</div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={ruleScope === 'this'}
                  onChange={() => setRuleScope('this')}
                  className="accent-primaryPink"
                />
                이번 거래만
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={ruleScope === 'all'}
                  onChange={() => setRuleScope('all')}
                  className="accent-primaryPink"
                />
                룰 전체 (이번 + 다음 발생부터 적용)
              </label>
            </div>
          </div>
        )}
        {error && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
