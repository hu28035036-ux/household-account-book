import { describe, it, expect, vi } from 'vitest';
import { executeIntent } from '@/services/assistantService';

/**
 * executeIntent 단위테스트 — Supabase 클라이언트를 mock 하여
 * Intent → DB call 의 매핑이 정확한지 검증.
 */

function makeMockSupabase(opts?: {
  categoryRow?: { id: string } | null;
  paymentMethodRow?: { id: string } | null;
  insertReturn?: unknown;
}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

  function fromImpl(table: string) {
    // chain-safe self-reference: op 를 빈 객체로 먼저 만들고 메서드 할당
    const op: Record<string, unknown> = {
      _table: table,
      _selectCols: '',
      _filters: [] as Array<[string, string, unknown]>,
    };
    op.select = vi.fn().mockImplementation((cols: string) => {
      op._selectCols = cols;
      return op;
    });
    op.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      (op._filters as Array<[string, string, unknown]>).push(['eq', col, val]);
      return op;
    });
    op.ilike = vi.fn().mockImplementation((col: string, val: unknown) => {
      (op._filters as Array<[string, string, unknown]>).push(['ilike', col, val]);
      return op;
    });
    op.is = vi.fn().mockReturnValue(op);
    op.order = vi.fn().mockReturnValue(op);
    op.limit = vi.fn().mockReturnValue(op);
    op.maybeSingle = vi.fn().mockImplementation(() => {
      if (table === 'categories') return { data: opts?.categoryRow ?? null, error: null };
      if (table === 'payment_methods')
        return { data: opts?.paymentMethodRow ?? null, error: null };
      return { data: null, error: null };
    });
    op.single = vi.fn().mockImplementation(() => {
      return { data: opts?.insertReturn ?? { id: 'new-id' }, error: null };
    });
    op.insert = vi.fn().mockImplementation((payload: unknown) => {
      calls.push({ table, op: 'insert', payload });
      return op;
    });
    op.update = vi.fn().mockImplementation((payload: unknown) => {
      calls.push({ table, op: 'update', payload });
      return op;
    });
    op.delete = vi.fn().mockImplementation(() => {
      calls.push({ table, op: 'delete' });
      return op;
    });
    return op;
  }

  return {
    client: { from: fromImpl } as unknown as Parameters<typeof executeIntent>[0],
    calls,
  };
}

describe('executeIntent — add_transaction', () => {
  it('카테고리/결제수단 모두 매칭됨', async () => {
    const mock = makeMockSupabase({
      categoryRow: { id: 'cat-1' },
      paymentMethodRow: { id: 'pm-1' },
      insertReturn: { id: 'tx-1', amount: 5000 },
    });
    const result = await executeIntent(mock.client, 'user-1', null, {
      type: 'add_transaction',
      data: {
        type: 'expense',
        date: '2026-05-07',
        amount: 5000,
        merchant_name: '스타벅스',
        category_name: '카페/간식',
        payment_method_name: '신한카드',
      },
    });
    if (!result.ok) console.error('error:', result.error);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('add_transaction');
    expect(result.message).toContain('5,000');

    const insert = mock.calls.find((c) => c.table === 'transactions' && c.op === 'insert');
    expect(insert).toBeTruthy();
    const payload = insert!.payload as Record<string, unknown>;
    expect(payload.user_id).toBe('user-1');
    expect(payload.transaction_date).toBe('2026-05-07');
    expect(payload.type).toBe('expense');
    expect(payload.amount).toBe(5000);
    expect(payload.merchant_name).toBe('스타벅스');
    expect(payload.category_id).toBe('cat-1');
    expect(payload.payment_method_id).toBe('pm-1');
    expect(payload.source_type).toBe('manual');
  });

  it('카테고리 미매칭 → category_id null', async () => {
    const mock = makeMockSupabase({
      categoryRow: null, // 매칭 안 됨
      paymentMethodRow: null,
    });
    const result = await executeIntent(mock.client, 'user-1', null, {
      type: 'add_transaction',
      data: {
        type: 'expense',
        date: '2026-05-07',
        amount: 1500,
        merchant_name: '동네카페',
        category_name: '카페/간식',
      },
    });
    expect(result.ok).toBe(true);
    const insert = mock.calls.find((c) => c.table === 'transactions' && c.op === 'insert');
    const payload = insert!.payload as Record<string, unknown>;
    expect(payload.category_id).toBeNull();
  });

  it('수입 — message 에 + 부호', async () => {
    const mock = makeMockSupabase({
      categoryRow: { id: 'cat-salary' },
    });
    const result = await executeIntent(mock.client, 'user-1', null, {
      type: 'add_transaction',
      data: {
        type: 'income',
        date: '2026-05-07',
        amount: 3500000,
        merchant_name: '월급',
        category_name: '급여',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain('+');
    expect(result.message).toContain('3,500,000');
  });

  it('household 컨텍스트 → household_id 채워짐', async () => {
    const mock = makeMockSupabase();
    await executeIntent(mock.client, 'user-1', 'household-X', {
      type: 'add_transaction',
      data: {
        type: 'expense',
        date: '2026-05-07',
        amount: 5000,
      },
    });
    const insert = mock.calls.find((c) => c.table === 'transactions' && c.op === 'insert');
    const payload = insert!.payload as Record<string, unknown>;
    expect(payload.household_id).toBe('household-X');
  });
});

describe('executeIntent — create_category', () => {
  it('카테고리 생성', async () => {
    const mock = makeMockSupabase({
      insertReturn: { id: 'cat-new', name: '운동' },
    });
    const result = await executeIntent(mock.client, 'user-1', null, {
      type: 'create_category',
      data: { name: '운동', type: 'common' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain('운동');
    expect(result.message).toContain('카테고리');
  });
});

describe('executeIntent — set_budget', () => {
  it('전체 예산 설정', async () => {
    const mock = makeMockSupabase({
      categoryRow: null,
      insertReturn: { id: 'b-1', amount: 800000 },
    });
    const result = await executeIntent(mock.client, 'user-1', null, {
      type: 'set_budget',
      data: { year_month: '2026-05', amount: 800000, category_name: null },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain('800,000');
    expect(result.message).toContain('2026-05');
  });
});

describe('executeIntent — navigate / clarify / unknown', () => {
  it('navigate 는 클라이언트가 처리해야 함 — server execute 거부', async () => {
    const mock = makeMockSupabase();
    const result = await executeIntent(mock.client, 'user-1', null, {
      type: 'navigate',
      data: { destination: 'stats' },
    });
    expect(result.ok).toBe(false);
  });
});
