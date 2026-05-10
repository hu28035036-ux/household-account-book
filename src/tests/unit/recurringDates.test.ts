import { describe, it, expect } from 'vitest';
import { computeNextRun, computeAfter, type RecurringRuleInput, type RecurringRule } from '@/services/recurringService';

const baseDaily: RecurringRuleInput = {
  type: 'expense',
  amount: 5000,
  frequency: 'daily',
  start_date: '2026-05-01',
};

function rule(o: Partial<RecurringRuleInput>): RecurringRuleInput {
  return { ...baseDaily, ...o };
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

describe('computeNextRun', () => {
  it('daily — fromDate 가 start_date 이전이면 start_date 반환', () => {
    const next = computeNextRun(rule({}), new Date('2026-04-20T00:00:00Z'));
    expect(ymd(next)).toBe('2026-05-01');
  });

  it('daily — fromDate 가 start_date 이후면 그 날 반환', () => {
    const next = computeNextRun(rule({}), new Date('2026-05-15T00:00:00Z'));
    expect(ymd(next)).toBe('2026-05-15');
  });

  it('weekly — day_of_week 로 정확한 요일 매칭 (월=1)', () => {
    // 2026-05-04 (월) 기준 day_of_week=3 (수) → 2026-05-06
    const next = computeNextRun(
      rule({ frequency: 'weekly', day_of_week: 3 }),
      new Date('2026-05-04T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-05-06');
  });

  it('weekly — 같은 요일이면 당일 반환', () => {
    // 2026-05-04 (월) 기준 day_of_week=1 (월) → 당일
    const next = computeNextRun(
      rule({ frequency: 'weekly', day_of_week: 1 }),
      new Date('2026-05-04T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-05-04');
  });

  it('monthly — 그 달에 day_of_month 가 아직 안 지났으면 그 날', () => {
    const next = computeNextRun(
      rule({ frequency: 'monthly', day_of_month: 25 }),
      new Date('2026-05-10T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-05-25');
  });

  it('monthly — 그 달에 day_of_month 가 지났으면 다음 달', () => {
    const next = computeNextRun(
      rule({ frequency: 'monthly', day_of_month: 1 }),
      new Date('2026-05-10T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-06-01');
  });

  it('monthly — day_of_month=31 이지만 그 달이 30일이면 마지막 날로 클램프', () => {
    // 6월은 30일까지. day_of_month=31 → 6월 30일
    const next = computeNextRun(
      rule({ frequency: 'monthly', day_of_month: 31 }),
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-06-30');
  });

  it('yearly — month_of_year + day_of_month 매칭', () => {
    const next = computeNextRun(
      rule({ frequency: 'yearly', month_of_year: 12, day_of_month: 25, start_date: '2026-01-01' }),
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-12-25');
  });

  it('yearly — 그 해 일정이 지나면 내년', () => {
    const next = computeNextRun(
      rule({ frequency: 'yearly', month_of_year: 1, day_of_month: 1, start_date: '2026-01-01' }),
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2027-01-01');
  });
});

describe('computeAfter — 한 번 발생 후 다음', () => {
  const ruleD: RecurringRule = {
    id: 'r1', user_id: 'u1', household_id: null,
    type: 'expense', amount: 5000,
    merchant_name: null, description: null,
    category_id: null, payment_method_id: null,
    frequency: 'daily', day_of_week: null, day_of_month: null, month_of_year: null,
    start_date: '2026-05-01', end_date: null,
    next_run_date: null, last_run_date: null,
    active: true, auto_post: true, notify_days_before: 0,
    last_notified_for: null, memo: null,
  };

  it('daily — 다음 날', () => {
    const next = computeAfter(ruleD, new Date('2026-05-10T00:00:00Z'));
    expect(ymd(next)).toBe('2026-05-11');
  });

  it('weekly — 7일 후', () => {
    const next = computeAfter({ ...ruleD, frequency: 'weekly' }, new Date('2026-05-10T00:00:00Z'));
    expect(ymd(next)).toBe('2026-05-17');
  });

  it('monthly — 다음 달 같은 day_of_month', () => {
    const next = computeAfter(
      { ...ruleD, frequency: 'monthly', day_of_month: 25 },
      new Date('2026-05-25T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-06-25');
  });

  it('monthly — day_of_month=31 + 다음달이 30일 → 클램프', () => {
    const next = computeAfter(
      { ...ruleD, frequency: 'monthly', day_of_month: 31 },
      new Date('2026-05-31T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2026-06-30');
  });

  it('yearly — 1년 후', () => {
    const next = computeAfter(
      { ...ruleD, frequency: 'yearly', month_of_year: 12, day_of_month: 25 },
      new Date('2026-12-25T00:00:00Z'),
    );
    expect(ymd(next)).toBe('2027-12-25');
  });
});
