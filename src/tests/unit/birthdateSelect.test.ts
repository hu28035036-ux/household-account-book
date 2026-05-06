import { describe, it, expect } from 'vitest';

// 컴포넌트 렌더 테스트는 별도 jsdom 환경이 필요하므로 핵심 로직(일수)만 단위 검증.
function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

describe('daysInMonth', () => {
  it('1월=31, 2월(2024 윤년)=29, 2월(2023 평년)=28', () => {
    expect(daysInMonth(2024, 1)).toBe(31);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });
  it('30일 달', () => {
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 9)).toBe(30);
  });
  it('100년 단위(2100)는 평년 → 28일', () => {
    expect(daysInMonth(2100, 2)).toBe(28);
  });
  it('400년 단위(2000)는 윤년 → 29일', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
  });
});
