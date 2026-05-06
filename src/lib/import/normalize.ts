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

  // 1) 입출금 구분 컬럼이 있으면 그것이 type 의 1차 진실 (카카오뱅크 "구분", KB "종류")
  let typeFromColumn: 'income' | 'expense' | 'transfer' | null = null;
  if (mapping.type_column) {
    const v = (row[mapping.type_column] ?? '').trim();
    if (/이체/.test(v)) typeFromColumn = 'transfer';
    else if (/입금|수입|받음/.test(v)) typeFromColumn = 'income';
    else if (/출금|지출|보냄/.test(v)) typeFromColumn = 'expense';
  }

  if (mapping.amount_in && mapping.amount_out) {
    // 2) 입/출금 두 컬럼이 분리된 경우 (KB·신한·NH·우리 계좌 명세서)
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
    // 3) 단일 amount 컬럼 (카카오뱅크 "거래금액", 카드사 "이용금액")
    const a = parseAmount(row[mapping.amount] ?? '');
    if (a !== null) {
      amount = Math.abs(a);
      // 우선순위: type_column > 부호 > "이용*" 헤더면 expense (카드 사용내역 휴리스틱)
      if (typeFromColumn) {
        type = typeFromColumn;
      } else if (a < 0) {
        type = 'expense';
      } else {
        // 양수일 때: 매핑된 amount 컬럼이 "이용금액/승인금액"이면 카드 명세서 → expense
        const amtHeader = mapping.amount;
        if (/이용\s*금액|승인\s*금액/.test(amtHeader)) {
          type = 'expense';
        } else {
          // 그 외(거래금액·금액)에서 양수면 입금으로 추정
          type = 'income';
        }
      }
    }
  }
  // type_column 만 있고 amount 미지정인 경우에도 type 은 그대로 적용
  if (typeFromColumn && (mapping.amount_in || mapping.amount_out || mapping.amount)) {
    type = typeFromColumn;
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
