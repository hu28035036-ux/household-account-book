import type { SheetRow } from './parsers';
import type { ColumnMapping } from './columnMapping';

export type NormalizedCandidate = {
  transaction_date: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number | null;
  merchant_name: string | null;
  description: string;
  payment_method_suggestion: string | null;
  category_suggestion: string | null;
  raw_text_basis: string;
  warnings: string[];
};

const KOREAN_DATE = /^(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/;

export function parseDate(s: string): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  // ISO 우선
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const m = trimmed.match(KOREAN_DATE);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const ts = Date.parse(trimmed);
  if (!Number.isNaN(ts)) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return null;
}

export function parseAmount(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d-.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export function normalizeRow(row: SheetRow, mapping: ColumnMapping): NormalizedCandidate {
  const warnings: string[] = [];

  const dateStr = mapping.transaction_date ? row[mapping.transaction_date] : '';
  const date = parseDate(dateStr ?? '');
  if (!date) warnings.push('date_uncertain');

  const merchant = (mapping.merchant_name ? row[mapping.merchant_name] : '') || '';
  if (!merchant) warnings.push('merchant_uncertain');

  const description = (mapping.description ? row[mapping.description] : '') || '';
  const payment = (mapping.payment_method ? row[mapping.payment_method] : '') || '';
  const category = (mapping.category ? row[mapping.category] : '') || '';

  let amount: number | null = null;
  let type: 'income' | 'expense' | 'transfer' = 'expense';

  if (mapping.amount_in && mapping.amount_out) {
    const inAmt = parseAmount(row[mapping.amount_in] ?? '');
    const outAmt = parseAmount(row[mapping.amount_out] ?? '');
    if (inAmt && inAmt > 0) {
      amount = inAmt;
      type = 'income';
    } else if (outAmt && outAmt > 0) {
      amount = outAmt;
      type = 'expense';
    }
  } else if (mapping.amount) {
    const a = parseAmount(row[mapping.amount] ?? '');
    if (a !== null) {
      amount = Math.abs(a);
      type = a < 0 ? 'expense' : 'income';
      // 가맹점이 있으면 expense일 가능성이 더 높음 — 보수적으로 양수도 대부분 카드 사용내역에서는 expense
      if (a > 0 && merchant) type = 'expense';
    }
  }
  if (amount === null) warnings.push('amount_uncertain');

  const basis = [date, merchant, amount].filter(Boolean).join(' ').slice(0, 200);

  return {
    transaction_date: date,
    type,
    amount,
    merchant_name: merchant || null,
    description: description || category || '',
    payment_method_suggestion: payment || null,
    category_suggestion: category || null,
    raw_text_basis: basis,
    warnings,
  };
}
