import { describe, it, expect, vi } from 'vitest';
import { makeMockSupabase } from './_supabaseMock';
import {
  listCandidates,
  updateCandidate,
  rejectCandidate,
  rejectBulk,
} from '@/services/candidateService';

// learningService.logCorrection 은 reject 후 호출됨 — 테스트에서는 noop 으로 mock
vi.mock('@/services/learningService', () => ({
  logCorrection: vi.fn(() => Promise.resolve()),
  recordMerchantLearning: vi.fn(() => Promise.resolve()),
}));

describe('candidateService — user_id 격리', () => {
  it('listCandidates — eq("user_id", userId) 강제', async () => {
    const { client, chain } = makeMockSupabase({ data: [], error: null });
    await listCandidates(client, 'user-A', 'pending');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-A');
    expect(chain.eq).toHaveBeenCalledWith('user_action', 'pending');
  });

  it('listCandidates — status="all" 면 user_action 필터 X', async () => {
    const { client, chain } = makeMockSupabase({ data: [], error: null });
    await listCandidates(client, 'user-A', 'all');
    const userActionCalls = chain._calls.filter(
      (c: { method: string; args: unknown[] }) => c.method === 'eq' && c.args[0] === 'user_action',
    );
    expect(userActionCalls).toHaveLength(0);
  });

  it('updateCandidate — user_id + id 필터 + user_action="edited" 강제', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'c1' }, error: null });
    await updateCandidate(client, 'user-A', 'c1', { merchant_name: '스벅' });
    const updateCall = chain._calls.find((c: { method: string }) => c.method === 'update');
    expect(updateCall).toBeTruthy();
    const payload = updateCall!.args[0] as Record<string, unknown>;
    expect(payload.user_action).toBe('edited');
    expect(payload.merchant_name).toBe('스벅');
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toContainEqual({ method: 'eq', args: ['user_id', 'user-A'] });
    expect(eqs).toContainEqual({ method: 'eq', args: ['id', 'c1'] });
  });

  it('rejectCandidate — update user_action="rejected" + user_id 필터', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'c1' }, error: null });
    await rejectCandidate(client, 'user-A', 'c1');
    const updateCall = chain._calls.find((c: { method: string }) => c.method === 'update');
    expect((updateCall!.args[0] as Record<string, unknown>).user_action).toBe('rejected');
    const userIdEq = chain._calls.find(
      (c: { method: string; args: unknown[] }) => c.method === 'eq' && c.args[0] === 'user_id',
    );
    expect(userIdEq?.args[1]).toBe('user-A');
  });

  it('rejectBulk — user_id + in("id", ids) + update user_action="rejected"', async () => {
    const { client, chain } = makeMockSupabase({
      data: [{ id: 'c1' }, { id: 'c2' }],
      error: null,
    });
    const r = await rejectBulk(client, 'user-A', ['c1', 'c2']);
    const userIdEq = chain._calls.find(
      (c: { method: string; args: unknown[] }) => c.method === 'eq' && c.args[0] === 'user_id',
    );
    const idIn = chain._calls.find(
      (c: { method: string; args: unknown[] }) => c.method === 'in' && c.args[0] === 'id',
    );
    expect(userIdEq?.args[1]).toBe('user-A');
    expect(idIn?.args[1]).toEqual(['c1', 'c2']);
    expect(r.rejectedIds).toEqual(['c1', 'c2']);
  });

  it('rejectBulk — ids 빈 배열이면 DB 호출 X', async () => {
    const { client, from } = makeMockSupabase();
    const r = await rejectBulk(client, 'user-A', []);
    expect(from).not.toHaveBeenCalled();
    expect(r.rejectedIds).toEqual([]);
  });
});
