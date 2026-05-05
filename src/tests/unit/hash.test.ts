import { describe, it, expect } from 'vitest';
import { inputHash } from '@/lib/learning/hash';

describe('inputHash', () => {
  it('공백/대소문자 차이를 무시', () => {
    const a = inputHash('스타벅스 5,800');
    const b = inputHash('  스타벅스    5,800  ');
    expect(a).toBe(b);
  });

  it('마스킹 후 동일하면 같은 hash', () => {
    const a = inputHash('카드 1234-5678-9012-3456 5,800');
    const b = inputHash('카드 0000-0000-0000-3456 5,800');
    expect(a).toBe(b);
  });

  it('서로 다른 텍스트는 다른 hash', () => {
    expect(inputHash('스타벅스 5,800')).not.toBe(inputHash('투썸 5,800'));
  });
});
