import { describe, it, expect } from 'vitest';
import { checkDuplicate } from '@/lib/duplicate/check';

const existing = [
  { transaction_date: '2026-05-05', amount: 5800, merchant_name: '스타벅스 강남점', payment_method_id: null },
];

describe('checkDuplicate', () => {
  it('완전 일치 → duplicate', () => {
    expect(
      checkDuplicate(
        {
          transaction_date: '2026-05-05',
          amount: 5800,
          merchant_name: '스타벅스 강남점',
          payment_method_suggestion: null,
        },
        existing,
      ),
    ).toBe('duplicate');
  });

  it('가맹점 부분 일치 → suspected', () => {
    expect(
      checkDuplicate(
        {
          transaction_date: '2026-05-05',
          amount: 5800,
          merchant_name: '스타벅스',
          payment_method_suggestion: null,
        },
        existing,
      ),
    ).toBe('suspected');
  });

  it('가맹점 다름 → none', () => {
    expect(
      checkDuplicate(
        {
          transaction_date: '2026-05-05',
          amount: 5800,
          merchant_name: '투썸',
          payment_method_suggestion: null,
        },
        existing,
      ),
    ).toBe('none');
  });

  it('금액 다르면 none', () => {
    expect(
      checkDuplicate(
        {
          transaction_date: '2026-05-05',
          amount: 5900,
          merchant_name: '스타벅스 강남점',
          payment_method_suggestion: null,
        },
        existing,
      ),
    ).toBe('none');
  });

  it('날짜/금액 둘 중 하나 없으면 none', () => {
    expect(
      checkDuplicate(
        { transaction_date: null, amount: 5800, merchant_name: '스타벅스', payment_method_suggestion: null },
        existing,
      ),
    ).toBe('none');
  });

  it('가맹점이 양쪽 다 비면 suspected', () => {
    expect(
      checkDuplicate(
        { transaction_date: '2026-05-05', amount: 5800, merchant_name: null, payment_method_suggestion: null },
        [{ transaction_date: '2026-05-05', amount: 5800, merchant_name: null, payment_method_id: null }],
      ),
    ).toBe('suspected');
  });
});
