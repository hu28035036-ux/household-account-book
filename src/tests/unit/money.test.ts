import { describe, it, expect } from 'vitest';
import { formatKRW, parseKRWInput } from '@/lib/formatting/money';

describe('money', () => {
  it('formatKRW 천 단위 콤마 + 원', () => {
    expect(formatKRW(1234567)).toBe('1,234,567원');
    expect(formatKRW(0)).toBe('0원');
  });
  it('null/undefined 안전', () => {
    expect(formatKRW(null)).toBe('-');
    expect(formatKRW(undefined as any)).toBe('-');
  });
  it('parseKRWInput 콤마/원 제거', () => {
    expect(parseKRWInput('1,234,567원')).toBe(1234567);
    expect(parseKRWInput('  5800  ')).toBe(5800);
    expect(parseKRWInput('')).toBe(null);
    expect(parseKRWInput('abc')).toBe(null);
  });
});
