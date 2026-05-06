/**
 * 소비 패턴 인사이트 — 순수 계산 함수만 두어 단위 테스트가 쉬움.
 * DB 접근은 서비스 레이어에서 하고, 결과를 이 함수들에 넘긴다.
 */

export type ExpenseRow = {
  transaction_date: string; // YYYY-MM-DD
  amount: number;
  merchant_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
};

export type CategoryDelta = {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  this_month: number;
  last_month: number;
  delta: number; // this - last
  pct: number | null; // null when last_month = 0
};

/**
 * 카테고리별 전월 대비 증감.
 */
export function categoryDeltas(thisMonth: ExpenseRow[], lastMonth: ExpenseRow[]): CategoryDelta[] {
  const sumByCat = (rows: ExpenseRow[]) => {
    const m: Record<string, { name: string; color: string | null; total: number }> = {};
    for (const r of rows) {
      const key = r.category_id ?? '__none__';
      m[key] ??= {
        name: r.category_name ?? '미지정',
        color: r.category_color,
        total: 0,
      };
      m[key].total += Number(r.amount);
    }
    return m;
  };
  const A = sumByCat(thisMonth);
  const B = sumByCat(lastMonth);
  const keys = new Set([...Object.keys(A), ...Object.keys(B)]);

  const out: CategoryDelta[] = [];
  for (const k of keys) {
    const a = A[k]?.total ?? 0;
    const b = B[k]?.total ?? 0;
    if (a === 0 && b === 0) continue;
    const meta = A[k] ?? B[k];
    out.push({
      category_id: k === '__none__' ? null : k,
      category_name: meta.name,
      category_color: meta.color,
      this_month: a,
      last_month: b,
      delta: a - b,
      pct: b > 0 ? Math.round(((a - b) / b) * 100) : null,
    });
  }
  return out;
}

/**
 * 이상 거래: 가맹점별 평균의 N배 이상 큰 단건.
 * - 가맹점 등장 횟수가 minOccurrences 이상이어야 통계적 의미.
 */
export type AnomalyRow = {
  date: string;
  amount: number;
  merchant_name: string;
  category_name: string | null;
  ratio: number; // amount / merchantAvg
  merchant_avg: number;
};

export function detectAnomalies(
  rowsLastNDays: ExpenseRow[],
  options: { minMultiplier?: number; minOccurrences?: number; topK?: number } = {},
): AnomalyRow[] {
  const minMult = options.minMultiplier ?? 2;
  const minOcc = options.minOccurrences ?? 3;
  const topK = options.topK ?? 5;

  const groups: Record<string, { count: number; total: number; rows: ExpenseRow[] }> = {};
  for (const r of rowsLastNDays) {
    const key = r.merchant_name?.trim().toLowerCase() ?? '';
    if (!key) continue;
    groups[key] ??= { count: 0, total: 0, rows: [] };
    groups[key].count += 1;
    groups[key].total += Number(r.amount);
    groups[key].rows.push(r);
  }

  const out: AnomalyRow[] = [];
  for (const [key, g] of Object.entries(groups)) {
    if (g.count < minOcc) continue;
    const avg = g.total / g.count;
    if (avg <= 0) continue;
    for (const r of g.rows) {
      const ratio = Number(r.amount) / avg;
      if (ratio >= minMult) {
        out.push({
          date: r.transaction_date,
          amount: Number(r.amount),
          merchant_name: r.merchant_name ?? key,
          category_name: r.category_name,
          ratio: Math.round(ratio * 10) / 10,
          merchant_avg: Math.round(avg),
        });
      }
    }
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, topK);
}

/**
 * 주말/평일 일평균 비교 (KST 기준 요일).
 */
export type WeekdayPattern = {
  weekday_avg: number; // 평일 1일 평균 지출
  weekend_avg: number; // 주말 1일 평균 지출
  weekend_to_weekday: number; // weekend / weekday (>1이면 주말 더 씀)
  weekday_days: number;
  weekend_days: number;
};

export function weekdayPattern(rows: ExpenseRow[]): WeekdayPattern {
  const byDate: Record<string, number> = {};
  for (const r of rows) byDate[r.transaction_date] = (byDate[r.transaction_date] ?? 0) + Number(r.amount);

  let weekdayTotal = 0;
  let weekendTotal = 0;
  const weekdaySet = new Set<string>();
  const weekendSet = new Set<string>();

  for (const [date, total] of Object.entries(byDate)) {
    // KST와 UTC가 다르지만 'YYYY-MM-DD'를 그대로 Date로 파싱하면 UTC 자정.
    // 한국 시간대 요일도 동일 날짜에서는 안전하게 매핑됨(±9시간 영향 없음).
    const dow = new Date(date + 'T00:00:00Z').getUTCDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend) {
      weekendTotal += total;
      weekendSet.add(date);
    } else {
      weekdayTotal += total;
      weekdaySet.add(date);
    }
  }

  const weekdayAvg = weekdaySet.size > 0 ? Math.round(weekdayTotal / weekdaySet.size) : 0;
  const weekendAvg = weekendSet.size > 0 ? Math.round(weekendTotal / weekendSet.size) : 0;
  const ratio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 0;
  return {
    weekday_avg: weekdayAvg,
    weekend_avg: weekendAvg,
    weekend_to_weekday: Math.round(ratio * 100) / 100,
    weekday_days: weekdaySet.size,
    weekend_days: weekendSet.size,
  };
}
