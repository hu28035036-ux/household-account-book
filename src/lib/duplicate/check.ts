type Existing = {
  transaction_date: string | null;
  amount: number | null;
  merchant_name: string | null;
  payment_method_id: string | null;
};

type Candidate = {
  transaction_date: string | null;
  amount: number | null;
  merchant_name: string | null;
  payment_method_suggestion: string | null;
};

function normalize(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, '').toLowerCase();
}

/**
 * 같은 날짜 + 같은 금액 + 가맹점 부분 일치이면 duplicate(suspected) 처리.
 * 이체/수입은 별도 룰이 필요하지만 1차 구현은 단순.
 */
export function checkDuplicate(c: Candidate, existings: Existing[]): 'none' | 'suspected' | 'duplicate' {
  if (!c.transaction_date || !c.amount) return 'none';
  for (const e of existings) {
    if (e.transaction_date !== c.transaction_date) continue;
    if (e.amount !== c.amount) continue;
    const m1 = normalize(c.merchant_name);
    const m2 = normalize(e.merchant_name);
    if (m1 && m2) {
      if (m1 === m2) return 'duplicate';
      if (m1.includes(m2) || m2.includes(m1)) return 'suspected';
    } else {
      return 'suspected';
    }
  }
  return 'none';
}
