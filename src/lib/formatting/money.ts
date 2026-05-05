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
