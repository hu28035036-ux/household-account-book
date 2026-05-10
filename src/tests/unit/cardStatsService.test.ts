import { describe, it, expect } from 'vitest';
import { makeMockSupabase } from './_supabaseMock';
import { getCardUsageReport } from '@/services/cardStatsService';

/**
 * cardStatsService.getCardUsageReport — 카드 0건 케이스만 mock 으로 검증.
 * 정상 집계(공유율·avg·top categories) 검증은 두 번째 from() 응답이 다른
 * Supabase chain 의 정교한 mock 이 필요해 후속 PR 에서 보강 예정.
 */
describe('cardStatsService.getCardUsageReport', () => {
  it('카드 type 결제수단 0건이면 빈 리포트 + early return', async () => {
    const { client } = makeMockSupabase({ data: [], error: null });
    const r = await getCardUsageReport(client, 'user-A', '2026-05');
    expect(r.total_card_spent).toBe(0);
    expect(r.total_card_count).toBe(0);
    expect(r.cards).toEqual([]);
    expect(r.range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('카드 type 결제수단 0건이면 transactions 조회는 skip', async () => {
    const { client, from } = makeMockSupabase({ data: [], error: null });
    await getCardUsageReport(client, 'user-A', '2026-05');
    // payment_methods 1회만 호출 — transactions 호출 X
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('payment_methods');
  });
});
