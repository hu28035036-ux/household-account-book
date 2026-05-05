import { describe, it, expect } from 'vitest';

/**
 * BudgetProgressItem 상태 계산 로직을 격리해 테스트.
 * (실제 함수는 service 내 인라인이라, 동일 규칙을 재현해 검증.)
 */
function status(percent: number, threshold: number): 'safe' | 'caution' | 'over' {
  if (percent >= 100) return 'over';
  if (percent >= Math.round(threshold * 100)) return 'caution';
  return 'safe';
}

describe('budget status', () => {
  it('100% 이상은 over', () => {
    expect(status(100, 0.8)).toBe('over');
    expect(status(150, 0.8)).toBe('over');
  });
  it('threshold 이상이면 caution', () => {
    expect(status(80, 0.8)).toBe('caution');
    expect(status(90, 0.8)).toBe('caution');
  });
  it('threshold 미만은 safe', () => {
    expect(status(0, 0.8)).toBe('safe');
    expect(status(79, 0.8)).toBe('safe');
  });
  it('threshold 0.5 적용', () => {
    expect(status(49, 0.5)).toBe('safe');
    expect(status(50, 0.5)).toBe('caution');
  });
});
