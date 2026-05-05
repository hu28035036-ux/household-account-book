import { describe, it, expect } from 'vitest';
import { parseDate, parseAmount, normalizeRow } from '@/lib/import/normalize';
import { autoDetectMapping } from '@/lib/import/columnMapping';

describe('parseDate', () => {
  it('ISO YYYY-MM-DD', () => {
    expect(parseDate('2026-05-05')).toBe('2026-05-05');
    expect(parseDate('2026-05-05 14:23')).toBe('2026-05-05');
  });
  it('한국어 점 / 슬래시 / 하이픈', () => {
    expect(parseDate('2026.05.05')).toBe('2026-05-05');
    expect(parseDate('2026/5/5')).toBe('2026-05-05');
    expect(parseDate('2026-5-5')).toBe('2026-05-05');
  });
  it('한글 월일', () => {
    expect(parseDate('2026년 5월 5일')).toBe('2026-05-05');
  });
  it('빈/잘못된 입력은 null', () => {
    expect(parseDate('')).toBe(null);
    expect(parseDate('abc')).toBe(null);
  });
});

describe('parseAmount', () => {
  it('콤마/원 제거', () => {
    expect(parseAmount('1,234,567원')).toBe(1234567);
    expect(parseAmount('5,800')).toBe(5800);
  });
  it('소수점 반올림', () => {
    expect(parseAmount('1234.4')).toBe(1234);
    expect(parseAmount('1234.6')).toBe(1235);
  });
  it('빈/잘못된 입력은 null', () => {
    expect(parseAmount('')).toBe(null);
    expect(parseAmount('abc')).toBe(null);
  });
});

describe('autoDetectMapping', () => {
  it('카드 명세서 헤더', () => {
    const m = autoDetectMapping(['이용일자', '가맹점명', '이용금액', '메모']);
    expect(m.transaction_date).toBe('이용일자');
    expect(m.merchant_name).toBe('가맹점명');
    expect(m.amount).toBe('이용금액');
    expect(m.description).toBe('메모');
  });
  it('계좌 입출금 헤더', () => {
    const m = autoDetectMapping(['거래일', '적요', '입금', '출금', '잔액']);
    expect(m.transaction_date).toBe('거래일');
    expect(m.merchant_name).toBe('적요');
    expect(m.amount_in).toBe('입금');
    expect(m.amount_out).toBe('출금');
  });
});

describe('normalizeRow', () => {
  it('입금/출금 두 컬럼: 출금 → expense', () => {
    const m = autoDetectMapping(['거래일', '적요', '입금', '출금']);
    const row = { '거래일': '2026-05-05', '적요': '스타벅스', '입금': '', '출금': '5800' };
    const out = normalizeRow(row, m);
    expect(out.transaction_date).toBe('2026-05-05');
    expect(out.amount).toBe(5800);
    expect(out.type).toBe('expense');
    expect(out.merchant_name).toBe('스타벅스');
  });
  it('입금만 있으면 income', () => {
    const m = autoDetectMapping(['거래일', '적요', '입금', '출금']);
    const row = { '거래일': '2026-05-01', '적요': '월급', '입금': '3000000', '출금': '' };
    const out = normalizeRow(row, m);
    expect(out.amount).toBe(3000000);
    expect(out.type).toBe('income');
  });
  it('금액 누락 시 amount_uncertain', () => {
    const m = autoDetectMapping(['이용일자', '가맹점명', '이용금액']);
    const row = { '이용일자': '2026-05-05', '가맹점명': '스타벅스', '이용금액': '' };
    const out = normalizeRow(row, m);
    expect(out.amount).toBe(null);
    expect(out.warnings).toContain('amount_uncertain');
  });
});
