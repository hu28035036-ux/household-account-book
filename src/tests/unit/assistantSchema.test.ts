import { describe, it, expect } from 'vitest';
import { parseIntent, Intent } from '@/lib/ai/assistantSchema';

describe('parseIntent — 단위', () => {
  it('add_transaction 정상 파싱', () => {
    const raw = JSON.stringify({
      type: 'add_transaction',
      data: {
        type: 'expense',
        date: '2026-05-07',
        amount: 5000,
        merchant_name: '스타벅스',
        category_name: '카페/간식',
      },
    });
    const out = parseIntent(raw);
    expect(out.type).toBe('add_transaction');
    if (out.type === 'add_transaction') {
      expect(out.data.amount).toBe(5000);
      expect(out.data.merchant_name).toBe('스타벅스');
    }
  });

  it('navigate 정상 파싱 (year_month_hint 포함)', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'navigate',
        data: { destination: 'stats', year_month_hint: 'this_month' },
      }),
    );
    expect(out.type).toBe('navigate');
    if (out.type === 'navigate') {
      expect(out.data.destination).toBe('stats');
      expect(out.data.year_month_hint).toBe('this_month');
    }
  });

  it('update_transaction last selector', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'update_transaction',
        target: { selector: 'last' },
        patch: { amount: 15000 },
      }),
    );
    expect(out.type).toBe('update_transaction');
    if (out.type === 'update_transaction') {
      expect(out.target.selector).toBe('last');
      expect(out.patch.amount).toBe(15000);
    }
  });

  it('delete_transaction date_merchant', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'delete_transaction',
        target: { selector: 'date_merchant', date: '2026-05-06', merchant_name: '스타벅스' },
      }),
    );
    expect(out.type).toBe('delete_transaction');
  });

  it('create_category', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'create_category',
        data: { name: '운동', type: 'expense' },
      }),
    );
    expect(out.type).toBe('create_category');
  });

  it('set_budget — 카테고리별', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'set_budget',
        data: { year_month: '2026-05', amount: 300000, category_name: '식비' },
      }),
    );
    expect(out.type).toBe('set_budget');
    if (out.type === 'set_budget') {
      expect(out.data.year_month).toBe('2026-05');
      expect(out.data.category_name).toBe('식비');
    }
  });

  it('create_recurring monthly day_of_month', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'create_recurring',
        data: {
          type: 'income',
          amount: 3500000,
          merchant_name: '월급',
          frequency: 'monthly',
          day_of_month: 25,
          category_name: '급여',
          auto_post: true,
        },
      }),
    );
    expect(out.type).toBe('create_recurring');
  });

  it('clarify', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'clarify',
        question: '어디에서 쓰셨어요?',
        suggestions: ['스벅 5천', 'GS 5천'],
      }),
    );
    expect(out.type).toBe('clarify');
    if (out.type === 'clarify') {
      expect(out.suggestions).toHaveLength(2);
    }
  });

  it('잘못된 JSON → unknown', () => {
    const out = parseIntent('{ this is not json');
    expect(out.type).toBe('unknown');
  });

  it('알 수 없는 type → unknown', () => {
    const out = parseIntent(JSON.stringify({ type: 'fly_to_moon' }));
    expect(out.type).toBe('unknown');
  });

  it('필수 필드 누락 (add_transaction.amount) → unknown', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'add_transaction',
        data: { type: 'expense', date: '2026-05-07' },
      }),
    );
    expect(out.type).toBe('unknown');
  });

  it('amount 음수 거부 → unknown', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'add_transaction',
        data: { type: 'expense', date: '2026-05-07', amount: -100 },
      }),
    );
    expect(out.type).toBe('unknown');
  });

  it('잘못된 날짜 형식 → unknown', () => {
    const out = parseIntent(
      JSON.stringify({
        type: 'add_transaction',
        data: { type: 'expense', date: '2026/05/07', amount: 5000 },
      }),
    );
    expect(out.type).toBe('unknown');
  });

  it('navigate destination 누락 → unknown', () => {
    const out = parseIntent(JSON.stringify({ type: 'navigate', data: {} }));
    expect(out.type).toBe('unknown');
  });

  it('빈 문자열 → unknown', () => {
    const out = parseIntent('');
    expect(out.type).toBe('unknown');
  });

  it('Intent.parse 직접 호출 (api/execute 가 사용) — add 케이스', () => {
    const result = Intent.parse({
      type: 'add_transaction',
      data: {
        type: 'expense',
        date: '2026-05-07',
        amount: 5000,
        merchant_name: '스타벅스',
      },
    });
    expect(result.type).toBe('add_transaction');
  });

  it('Intent.parse — 잘못된 입력은 throw', () => {
    expect(() => Intent.parse({ type: 'add_transaction', data: {} })).toThrow();
  });
});
