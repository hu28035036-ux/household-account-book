import { describe, it, expect } from 'vitest';
import { makeMockSupabase } from './_supabaseMock';
import {
  createHousehold,
  renameHousehold,
  deleteHousehold,
} from '@/services/householdService';

describe('householdService — owner_id 격리', () => {
  it('createHousehold — insert payload 에 owner_id 강제', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'h1', name: '우리집' }, error: null });
    await createHousehold(client, 'user-A', '우리집');
    const insertCalls = chain._calls.filter((c: { method: string }) => c.method === 'insert');
    expect(insertCalls.length).toBeGreaterThan(0);
    const householdPayload = insertCalls[0].args[0] as Record<string, unknown>;
    expect(householdPayload.owner_id).toBe('user-A');
    expect(householdPayload.name).toBe('우리집');
  });

  it('createHousehold — household_members 에도 owner 로 자동 등록', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'h1', name: '우리집' }, error: null });
    await createHousehold(client, 'user-A', '우리집');
    const memberInsert = chain._calls
      .filter((c: { method: string }) => c.method === 'insert')
      .find((c: { args: unknown[] }) => {
        const payload = c.args[0] as Record<string, unknown>;
        return payload.role === 'owner';
      });
    expect(memberInsert).toBeTruthy();
    const payload = memberInsert!.args[0] as Record<string, unknown>;
    expect(payload.user_id).toBe('user-A');
    expect(payload.household_id).toBe('h1');
  });

  it('renameHousehold — eq("id", id) + eq("owner_id", userId) 둘 다 필터 (멤버는 rename 불가)', async () => {
    const { client, chain } = makeMockSupabase({ data: { id: 'h1' }, error: null });
    await renameHousehold(client, 'user-A', 'h1', '새이름');
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toContainEqual({ method: 'eq', args: ['id', 'h1'] });
    expect(eqs).toContainEqual({ method: 'eq', args: ['owner_id', 'user-A'] });
  });

  it('deleteHousehold — owner_id 필터 강제 (멤버는 모임 삭제 불가)', async () => {
    const { client, chain } = makeMockSupabase({ data: null, error: null });
    await deleteHousehold(client, 'user-A', 'h1');
    const eqs = chain._calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqs).toContainEqual({ method: 'eq', args: ['id', 'h1'] });
    expect(eqs).toContainEqual({ method: 'eq', args: ['owner_id', 'user-A'] });
  });
});
