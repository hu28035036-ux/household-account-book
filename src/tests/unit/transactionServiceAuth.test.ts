import { describe, it, expect } from 'vitest';
import { makeMockSupabase } from './_supabaseMock';
import {
  deleteTransaction,
  deleteTransactionsBulk,
  updateTransaction,
} from '@/services/transactionService';

/**
 * RLS 외에 service 단에서도 user_id 필터를 강제하는지 검증.
 * service_role 클라이언트로 호출되더라도 본인 row 만 영향받게 하기 위한 추가 방어선.
 */
describe('transactionService — user_id 격리', () => {
  it('deleteTransaction — eq("user_id", userId) 와 eq("id", id) 둘 다 호출', async () => {
    const { client, chain } = makeMockSupabase({ data: null, error: null });
    await deleteTransaction(client, 'user-A', 'tx-1');
    const eqCalls = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqCalls).toEqual([
      { method: 'eq', args: ['user_id', 'user-A'] },
      { method: 'eq', args: ['id', 'tx-1'] },
    ]);
  });

  it('updateTransaction — eq("user_id", userId) 강제', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'tx-1' }, error: null });
    await updateTransaction(client, 'user-A', 'tx-1', { merchant_name: '스벅' } as never);
    const eqArgs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqArgs.some((c: { args: unknown[] }) => c.args[0] === 'user_id' && c.args[1] === 'user-A')).toBe(true);
  });

  it('deleteTransactionsBulk — eq("user_id") + in("id", ids) 둘 다 호출', async () => {
    const { client, chain } = makeMockSupabase({ data: [{ id: 'tx-1' }, { id: 'tx-2' }], error: null });
    const r = await deleteTransactionsBulk(client, 'user-A', ['tx-1', 'tx-2']);
    const userIdFilter = chain._calls.find(
      (c: { method: string; args: unknown[] }) => c.method === 'eq' && c.args[0] === 'user_id',
    );
    const idIn = chain._calls.find(
      (c: { method: string; args: unknown[] }) => c.method === 'in' && c.args[0] === 'id',
    );
    expect(userIdFilter).toBeTruthy();
    expect(userIdFilter?.args[1]).toBe('user-A');
    expect(idIn).toBeTruthy();
    expect(idIn?.args[1]).toEqual(['tx-1', 'tx-2']);
    expect(r.deletedIds).toEqual(['tx-1', 'tx-2']);
  });

  it('deleteTransactionsBulk — ids 가 빈 배열이면 short-circuit (DB 호출 X)', async () => {
    const { client, from } = makeMockSupabase();
    const r = await deleteTransactionsBulk(client, 'user-A', []);
    expect(from).not.toHaveBeenCalled();
    expect(r.deletedIds).toEqual([]);
  });
});
