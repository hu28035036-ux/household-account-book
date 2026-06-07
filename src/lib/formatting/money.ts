/**
 * 금액 포맷팅. 내부 단위는 원(KRW) 정수.
 */
export function formatKRW(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

export function parseKRWInput(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatKRWInput(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const raw = String(input);
  const negative = raw.trim().startsWith('-');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return negative ? '-' : '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return negative ? `-${digits}` : digits;
  return `${negative ? '-' : ''}${n.toLocaleString('ko-KR')}`;
}

/**
 * 좁은 공간(캘린더 셀 등) 용 컴팩트 표기.
 *  - 1억 이상     → "1억", "12억"
 *  - 1만 이상     → "12만", "5.8만"  (10만 미만은 한 자리 소수 유지)
 *  - 1만 미만     → "5,800"          (그대로 표시)
 * 절대로 잘리지 않게 짧은 문자열만 반환.
 */
export function compactKRW(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '-';
  const n = Math.abs(amount);
  if (n >= 100_000_000) {
    const eok = n / 100_000_000;
    return `${eok >= 100 ? Math.round(eok) : eok.toFixed(eok < 10 ? 1 : 0)}억`;
  }
  if (n >= 10_000) {
    const man = n / 10_000;
    return `${man >= 100 ? Math.round(man) : man.toFixed(man < 10 ? 1 : 0)}만`;
  }
  return n.toLocaleString('ko-KR');
}
