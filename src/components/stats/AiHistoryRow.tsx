'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatKRW } from '@/lib/formatting/money';
import { formatDateKST } from '@/lib/formatting/date';

export type AiHistoryItem = {
  id: string;
  range: { from: string; to: string };
  totals: { expense: number; income: number; balance: number };
  transaction_count: number;
  summary: string;
  tips: Array<{ title: string; body: string; savable_won: number | null }>;
  model: string;
  generated_at: string;
};

type Props = {
  item: AiHistoryItem;
  defaultOpen?: boolean;
  onDelete?: (id: string) => void;
};

export function AiHistoryRow({ item, defaultOpen = false, onDelete }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="rounded-md border border-borderSoft">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-textMuted" strokeWidth={1.75} />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-textMuted" strokeWidth={1.75} />
          )}
          <span className="text-sm text-textPrimary truncate">
            {item.range.from} ~ {item.range.to}
          </span>
          <span className="text-xs text-textMuted truncate hidden sm:inline">
            지출 {formatKRW(item.totals.expense)} · 거래 {item.transaction_count}건
          </span>
          <span className="ml-auto text-xs text-textMuted whitespace-nowrap">
            {formatDateKST(item.generated_at)}
          </span>
        </button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            aria-label="삭제"
            className="!h-8 !px-2"
          >
            <Trash2 className="h-4 w-4 text-danger" strokeWidth={1.75} />
          </Button>
        )}
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="text-xs text-textSecondary">
            기간: <span className="text-textPrimary">{item.range.from} ~ {item.range.to}</span> ·
            거래 {item.transaction_count}건 · 지출{' '}
            <span className="text-expense">{formatKRW(item.totals.expense)}</span> / 수입{' '}
            <span className="text-income">{formatKRW(item.totals.income)}</span>
          </div>
          <div className="rounded-md bg-softPinkBackground/60 px-3 py-2.5 text-sm text-textPrimary leading-relaxed whitespace-pre-line">
            {item.summary || '(요약 없음)'}
          </div>
          {item.tips.length > 0 && (
            <ul className="space-y-2">
              {item.tips.map((t, i) => (
                <li key={i} className="rounded-md border border-borderSoft px-3 py-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-textPrimary">{t.title}</span>
                    {typeof t.savable_won === 'number' && t.savable_won > 0 && (
                      <Badge tone="success">절약 ≈ {formatKRW(t.savable_won)}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-textSecondary leading-relaxed">{t.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
