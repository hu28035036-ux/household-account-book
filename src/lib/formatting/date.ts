/**
 * 날짜 포맷팅. DB는 UTC, 표시는 KST.
 */
const KST_TZ = 'Asia/Seoul';

export function formatDateKST(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d).replace(/\.\s*$/, '');
}

export function todayKSTISO(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now); // YYYY-MM-DD
}

export function monthRangeKST(yearMonth?: string): { from: string; to: string } {
  const ym = yearMonth ?? todayKSTISO().slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const from = `${ym}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${ym}-${String(last).padStart(2, '0')}`;
  return { from, to };
}
