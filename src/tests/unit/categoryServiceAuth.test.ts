import { describe, it, expect } from 'vitest';
import { makeMockSupabase } from './_supabaseMock';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categoryService';
import {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from '@/services/paymentMethodService';

describe('categoryService — user_id 격리', () => {
  it('listCategories — eq("user_id", userId)', async () => {
    const { client, chain } = makeMockSupabase({ data: [], error: null });
    await listCategories(client, 'user-A');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-A');
  });

  it('createCategory — insert payload 에 user_id + is_default=false 강제', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'c1' }, error: null });
    await createCategory(client, 'user-A', { name: '카페', type: 'expense', color: '#A3E635' } as never);
    const insertCall = chain._calls.find((c: { method: string }) => c.method === 'insert');
    expect(insertCall).toBeTruthy();
    const payload = insertCall!.args[0] as Record<string, unknown>;
    expect(payload.user_id).toBe('user-A');
    expect(payload.is_default).toBe(false);
  });

  it('updateCategory — user_id + id 둘 다 필터', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'c1' }, error: null });
    await updateCategory(client, 'user-A', 'c1', { name: '카페수정' } as never);
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toEqual([
      { method: 'eq', args: ['user_id', 'user-A'] },
      { method: 'eq', args: ['id', 'c1'] },
    ]);
  });

  it('deleteCategory — user_id + id 둘 다 필터', async () => {
    const { client, chain } = makeMockSupabase({ data: null, error: null });
    await deleteCategory(client, 'user-A', 'c1');
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toEqual([
      { method: 'eq', args: ['user_id', 'user-A'] },
      { method: 'eq', args: ['id', 'c1'] },
    ]);
    expect(eqs.some((c: { args: unknown[] }) => c.args[0] === 'is_default')).toBe(false);
  });
});

describe('paymentMethodService — user_id 격리', () => {
  it('listPaymentMethods — eq("user_id", userId)', async () => {
    const { client, chain } = makeMockSupabase({ data: [], error: null });
    await listPaymentMethods(client, 'user-A');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-A');
  });

  it('createPaymentMethod — insert payload 에 user_id 강제 + is_default=false', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'p1' }, error: null });
    await createPaymentMethod(client, 'user-A', { name: '신한카드', type: 'card' } as never);
    const insertCall = chain._calls.find((c: { method: string }) => c.method === 'insert');
    expect(insertCall).toBeTruthy();
    const payload = insertCall!.args[0] as Record<string, unknown>;
    expect(payload.user_id).toBe('user-A');
    expect(payload.is_default).toBe(false);
  });

  it('deletePaymentMethod — user_id + id 둘 다 필터', async () => {
    const { client, chain } = makeMockSupabase({ data: null, error: null });
    await deletePaymentMethod(client, 'user-A', 'p1');
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toEqual([
      { method: 'eq', args: ['user_id', 'user-A'] },
      { method: 'eq', args: ['id', 'p1'] },
    ]);
    expect(eqs.some((c: { args: unknown[] }) => c.args[0] === 'is_default')).toBe(false);
  });

  it('updatePaymentMethod — user_id + id 둘 다 필터', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'p1' }, error: null });
    await updatePaymentMethod(client, 'user-A', 'p1', { name: '체크카드' } as never);
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toEqual([
      { method: 'eq', args: ['user_id', 'user-A'] },
      { method: 'eq', args: ['id', 'p1'] },
    ]);
  });
});
