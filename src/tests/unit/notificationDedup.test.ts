import { describe, it, expect } from 'vitest';

/**
 * 알림 dedup 키 규칙: `<type>:<categoryIdOrTotal>:<YYYY-MM>`
 * 같은 사용자 + 같은 dedupKey는 unique → 같은 사건 1회만 알림.
 */

function buildKey(
  type: 'budget_caution' | 'budget_over',
  categoryId: string | null,
  ym: string,
): string {
  return `${type}:${categoryId ?? 'total'}:${ym}`;
}

describe('notification dedup key', () => {
  it('동일 카테고리/월/타입은 같은 키', () => {
    expect(buildKey('budget_over', 'cat-1', '2026-05')).toBe(buildKey('budget_over', 'cat-1', '2026-05'));
  });
  it('월이 바뀌면 다른 키', () => {
    expect(buildKey('budget_over', 'cat-1', '2026-05')).not.toBe(buildKey('budget_over', 'cat-1', '2026-06'));
  });
  it('타입이 바뀌면 다른 키 (caution → over)', () => {
    expect(buildKey('budget_caution', 'cat-1', '2026-05')).not.toBe(buildKey('budget_over', 'cat-1', '2026-05'));
  });
  it('전체 예산은 total 키', () => {
    expect(buildKey('budget_over', null, '2026-05')).toBe('budget_over:total:2026-05');
  });
});
