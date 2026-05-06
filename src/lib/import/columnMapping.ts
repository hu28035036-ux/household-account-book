export type FieldKey =
  | 'transaction_date'
  | 'amount'
  | 'amount_in'
  | 'amount_out'
  | 'merchant_name'
  | 'description'
  | 'payment_method'
  | 'category'
  | 'type_column'; // 입출금 구분 컬럼 (예: 카카오뱅크의 "구분")

export type ColumnMapping = Partial<Record<FieldKey, string>>;

// 한국 은행/카드사 다수의 거래내역 헤더 변형을 커버.
// 카카오뱅크: 거래일시 / 구분 / 거래금액 / 거래 후 잔액 / 거래구분 / 내용 / 메모
// KB 국민:    거래일자 / 거래시간 / 적요 / 출금액 / 입금액 / 잔액 / 거래점 / 종류
// 신한:       일자 / 시간 / 출금금액 / 입금금액 / 잔액 / 거래내용 / 거래점 / 메모
// NH 농협:    거래일자 / 출금금액 / 입금금액 / 잔액 / 거래내용 / 거래점
// 우리:       거래일자 / 시간 / 출금금액 / 입금금액 / 잔액 / 거래메모 / 적요
// 토스뱅크:   거래일시 / 적요 / 메모 / 입금 / 출금 / 거래후잔액
// 카드 명세서: 이용일 / 이용처 / 이용금액 / 승인번호 ...
const PATTERNS: Record<FieldKey, RegExp[]> = {
  transaction_date: [
    /거래\s*일\s*시/,
    /거래\s*일\s*자/,
    /거래\s*일/,
    /이용\s*일\s*자/,
    /이용\s*일/,
    /승인\s*일/,
    /^일자$/,
    /^일시$/,
    /^날짜$/,
    /date/i,
  ],
  amount: [
    /이용\s*금액/,
    /거래\s*금액/,
    /승인\s*금액/,
    /^금액$/,
    /amount/i,
    /^total$/i,
    /^합계$/,
  ],
  amount_in: [
    /입금\s*금액/,
    /입금\s*액/,
    /^입금$/,
    /^수입$/,
    /credit/i,
    /deposit/i,
  ],
  amount_out: [
    /출금\s*금액/,
    /출금\s*액/,
    /^출금$/,
    /^지출$/,
    /debit/i,
    /withdraw/i,
  ],
  merchant_name: [
    /가맹점/,
    /상호/,
    /이용\s*처/,
    /^적요$/,
    /거래\s*내용/,
    /^내용$/,
    /보낸\s*분/,
    /받는\s*분/,
    /merchant/i,
    /payee/i,
  ],
  description: [
    /거래\s*메모/,
    /^메모$/,
    /^비고$/,
    /^설명$/,
    /description/i,
    /memo/i,
  ],
  payment_method: [
    /결제\s*수단/,
    /^카드$/,
    /^계좌$/,
    /payment/i,
  ],
  category: [
    /^분류$/,
    /^카테고리$/,
    /category/i,
  ],
  // 입출금 구분 — "입금"/"출금" 같은 문자열이 들어오는 컬럼
  type_column: [
    /^구분$/,
    /거래\s*구분/,
    /^종류$/,
    /입출금/,
  ],
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
  type_column: '입출금 구분',
};

export const FIELD_ORDER: FieldKey[] = [
  'transaction_date',
  'amount',
  'amount_in',
  'amount_out',
  'type_column',
  'merchant_name',
  'description',
  'payment_method',
  'category',
];
