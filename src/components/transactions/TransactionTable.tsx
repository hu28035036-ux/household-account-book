'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';
import { Button } from '@/components/common/Button';

type Row = {
  id: string;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  merchant_name: string | null;
  description: string | null;
  memo: string | null;
  household_id: string | null;
  categories?: { name: string; color: string | null; icon: string | null } | null;
  payment_methods?: { name: string; type: string; masked_number: string | null } | null;
};

type Props = {
  rows: Row[];
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => void;
};

export function TransactionTable({ rows, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-card border border-borderDefault bg-cardBackground">
      <table className="min-w-full text-sm">
        <thead className="bg-sectionBackground text-textSecondary">
          <tr>
            <th className="text-left px-3 py-2 whitespace-nowrap">날짜</th>
            <th className="text-left px-3 py-2">가맹점</th>
            <th className="text-left px-3 py-2">카테고리</th>
            <th className="text-left px-3 py-2">결제수단</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">금액</th>
            <th className="text-left px-3 py-2 hidden lg:table-cell">메모</th>
            <th className="px-3 py-2 w-1" />
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-softPinkBackground/40">
              <td className="px-3 py-2 whitespace-nowrap text-textPrimary">{formatDateKST(r.transaction_date)}</td>
              <td className="px-3 py-2 text-textPrimary max-w-[200px]">
                <span className="inline-flex items-center gap-1.5">
                  {r.household_id && (
                    <span
                      title="가족 공유"
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primaryPink shrink-0"
                      aria-label="가족 공유"
                    />
                  )}
                  <span className="truncate">{r.merchant_name || '-'}</span>
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: r.categories?.color ?? '#F472B6' }}
                  />
                  <span>{r.categories?.name ?? '-'}</span>
                </span>
              </td>
              <td className="px-3 py-2 text-textSecondary">
                {r.payment_methods?.name ?? '-'}
                {r.payment_methods?.masked_number ? (
                  <span className="ml-1 text-xs text-textMuted">{r.payment_methods.masked_number}</span>
                ) : null}
              </td>
              <td
                className={
                  'px-3 py-2 text-right tabular font-medium whitespace-nowrap ' +
                  (r.type === 'income' ? 'text-income' : r.type === 'transfer' ? 'text-transfer' : 'text-expense')
                }
              >
                {r.type === 'income' ? '+' : r.type === 'expense' ? '-' : ''}
                {formatKRW(r.amount)}
              </td>
              <td className="px-3 py-2 text-textSecondary truncate max-w-[200px] hidden lg:table-cell">
                {r.memo || r.description || '-'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit?.(r)} aria-label="수정">
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete?.(r)} aria-label="삭제">
                    <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-textSecondary">
                거래내역이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
