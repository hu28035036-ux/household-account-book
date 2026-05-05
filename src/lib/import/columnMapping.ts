export type FieldKey =
  | 'transaction_date'
  | 'amount'
  | 'amount_in'
  | 'amount_out'
  | 'merchant_name'
  | 'description'
  | 'payment_method'
  | 'category';

export type ColumnMapping = Partial<Record<FieldKey, string>>;

const PATTERNS: Record<FieldKey, RegExp[]> = {
  transaction_date: [/이용\s*일/, /거래\s*일/, /승인\s*일/, /일자/, /date/i, /날짜/],
  amount: [/이용\s*금액/, /거래\s*금액/, /승인\s*금액/, /^금액$/, /amount/i, /total/i, /^합계$/],
  amount_in: [/입금/, /수입/, /credit/i, /deposit/i],
  amount_out: [/출금/, /지출/, /debit/i, /withdraw/i],
  merchant_name: [/가맹점/, /상호/, /이용\s*처/, /적요/, /내용/, /merchant/i, /payee/i],
  description: [/메모/, /비고/, /설명/, /description/i, /memo/i],
  payment_method: [/결제\s*수단/, /카드/, /계좌/, /payment/i],
  category: [/분류/, /카테고리/, /category/i],
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const out: ColumnMapping = {};
  for (const [field, regs] of Object.entries(PATTERNS) as [FieldKey, RegExp[]][]) {
    for (const h of headers) {
      if (regs.some((r) => r.test(h))) {
        out[field] = h;
        break;
      }
    }
  }
  return out;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  transaction_date: '날짜',
  amount: '금액',
  amount_in: '입금/수입',
  amount_out: '출금/지출',
  merchant_name: '가맹점/상호',
  description: '메모/비고',
  payment_method: '결제수단',
  category: '카테고리',
};

export const FIELD_ORDER: FieldKey[] = [
  'transaction_date',
  'amount',
  'amount_in',
  'amount_out',
  'merchant_name',
  'description',
  'payment_method',
  'category',
];
