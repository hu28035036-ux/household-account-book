import { describe, it, expect } from 'vitest';
import { categoryDeltas, detectAnomalies, weekdayPattern, type ExpenseRow } from '@/lib/insights/compute';

const mk = (
  date: string,
  amount: number,
  merchant: string | null,
  category_id: string | null,
  category_name: string | null = category_id,
): ExpenseRow => ({
  transaction_date: date,
  amount,
  merchant_name: merchant,
  category_id,
  category_name,
  category_color: null,
});

describe('categoryDeltas', () => {
  it('이번 달 새로 생긴 카테고리는 last_month=0, pct=null', () => {
    const out = categoryDeltas(
      [mk('2026-05-01', 10000, null, 'food', '식비')],
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0].this_month).toBe(10000);
    expect(out[0].last_month).toBe(0);
    expect(out[0].delta).toBe(10000);
    expect(out[0].pct).toBe(null);
  });
  it('지난 달만 있던 카테고리는 delta < 0', () => {
    const out = categoryDeltas(
      [],
      [mk('2026-04-01', 5000, null, 'cafe', '카페')],
    );
    expect(out[0].delta).toBe(-5000);
    expect(out[0].pct).toBe(-100);
  });
  it('퍼센트 계산', () => {
    const out = categoryDeltas(
      [mk('2026-05-01', 12000, null, 'food', '식비')],
      [mk('2026-04-01', 10000, null, 'food', '식비')],
    );
    expect(out[0].delta).toBe(2000);
    expect(out[0].pct).toBe(20);
  });
});

describe('detectAnomalies', () => {
  it('가맹점 평균의 N배 이상 단건 감지', () => {
    const rows: ExpenseRow[] = [
      mk('2026-05-01', 5000, '스타벅스', 'cafe', '카페'),
      mk('2026-05-02', 5500, '스타벅스', 'cafe', '카페'),
      mk('2026-05-03', 6000, '스타벅스', 'cafe', '카페'),
      mk('2026-05-04', 50000, '스타벅스', 'cafe', '카페'), // 이상
    ];
    const out = detectAnomalies(rows, { minMultiplier: 2, minOccurrences: 3 });
    expect(out).toHaveLength(1);
    expect(out[0].merchant_name).toBe('스타벅스');
    expect(out[0].amount).toBe(50000);
    expect(out[0].ratio).toBeGreaterThanOrEqual(2);
  });
  it('등장 횟수가 적으면 무시', () => {
    const rows: ExpenseRow[] = [
      mk('2026-05-01', 5000, '신규가맹점', null),
      mk('2026-05-02', 100000, '신규가맹점', null),
    ];
    const out = detectAnomalies(rows, { minMultiplier: 2, minOccurrences: 3 });
    expect(out).toHaveLength(0);
  });
});

describe('weekdayPattern', () => {
  it('주말(토일)과 평일 평균 분리', () => {
    const rows: ExpenseRow[] = [
      // 2026-05-04 (월) — 평일
      mk('2026-05-04', 10000, null, null),
      // 2026-05-05 (화) — 평일
      mk('2026-05-05', 12000, null, null),
      // 2026-05-09 (토) — 주말
      mk('2026-05-09', 30000, null, null),
      // 2026-05-10 (일) — 주말
      mk('2026-05-10', 20000, null, null),
    ];
    const p = weekdayPattern(rows);
    expect(p.weekday_days).toBe(2);
    expect(p.weekend_days).toBe(2);
    expect(p.weekday_avg).toBe(11000);
    expect(p.weekend_avg).toBe(25000);
    expect(p.weekend_to_weekday).toBeCloseTo(2.27, 1);
  });
  it('데이터 없으면 0', () => {
    const p = weekdayPattern([]);
    expect(p.weekday_avg).toBe(0);
    expect(p.weekend_avg).toBe(0);
  });
});
