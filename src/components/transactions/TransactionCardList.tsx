'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

type Row = {
  id: string;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  description: string | null;
  memo: string | null;
  categories?: { name: string; color: string | null } | null;
  payment_methods?: { name: string; masked_number: string | null } | null;
};

type Props = {
  rows: Row[];
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => void;
};

export function TransactionCardList({ rows, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-textSecondary text-center py-6">거래내역이 없습니다.</p>
      </Card>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-textPrimary truncate">
                  {r.merchant_name || r.categories?.name || '거래'}
                </div>
                <div className="mt-0.5 text-xs text-textSecondary">
                  {formatDateKST(r.transaction_date)} · {r.categories?.name ?? '미지정'} ·{' '}
                  {r.payment_methods?.name ?? '미지정'}
                </div>
              </div>
              <div
                className={
                  'tabular text-base font-semibold whitespace-nowrap ' +
                  (r.type === 'income' ? 'text-income' : r.type === 'transfer' ? 'text-transfer' : 'text-expense')
                }
              >
                {r.type === 'income' ? '+' : r.type === 'expense' ? '-' : ''}
                {formatKRW(r.amount)}
              </div>
            </div>
            {(r.memo || r.description) && (
              <div className="mt-2 text-xs text-textSecondary line-clamp-2">{r.memo || r.description}</div>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => onEdit?.(r)} aria-label="수정">
                <Pencil className="h-4 w-4" strokeWidth={1.75} /> 수정
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete?.(r)} aria-label="삭제">
                <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} /> 삭제
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
