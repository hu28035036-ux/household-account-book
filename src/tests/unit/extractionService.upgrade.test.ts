import { describe, it, expect } from 'vitest';
import { shouldUpgradeToHigh, effectiveSourceType } from '@/services/extractionService';
import type { ExtractionResult } from '@/lib/ai/extractionSchema';

function makeResult(partials: Partial<ExtractionResult['transactions'][number]>[]): ExtractionResult {
  return {
    document_type: 'other',
    transactions: partials.map((p) => ({
      transaction_date: null,
      type: 'expense',
      merchant_name: null,
      description: '',
      amount: null,
      category_suggestion: null,
      payment_method_suggestion: null,
      confidence: 0.5,
      raw_text_basis: '',
      warnings: [],
      ...p,
    })),
    global_warnings: [],
  };
}

describe('shouldUpgradeToHigh', () => {
  it('transactions 가 비어있으면 승급 = true', () => {
    expect(shouldUpgradeToHigh(makeResult([]))).toBe(true);
  });

  it('모든 날짜가 null 이면 승급 = true', () => {
    const r = makeResult([
      { amount: 5000, transaction_date: null },
      { amount: 3000, transaction_date: null },
    ]);
    expect(shouldUpgradeToHigh(r)).toBe(true);
  });

  it('모든 금액이 null 이면 승급 = true', () => {
    const r = makeResult([
      { transaction_date: '2026-05-11', amount: null },
      { transaction_date: '2026-05-10', amount: null },
    ]);
    expect(shouldUpgradeToHigh(r)).toBe(true);
  });

  it('confidence 평균이 0.4 미만이면 승급 = true', () => {
    const r = makeResult([
      { transaction_date: '2026-05-11', amount: 5000, confidence: 0.2 },
      { transaction_date: '2026-05-10', amount: 3000, confidence: 0.3 },
    ]);
    expect(shouldUpgradeToHigh(r)).toBe(true);
  });

  it('정상 영수증 1건(날짜/금액/confidence 충분)이면 승급 = false (비용 회귀 방지)', () => {
    const r = makeResult([
      { transaction_date: '2026-05-11', amount: 5800, confidence: 0.9 },
    ]);
    expect(shouldUpgradeToHigh(r)).toBe(false);
  });

  it('confidence 평균이 정확히 0.4 면 승급 = false', () => {
    const r = makeResult([
      { transaction_date: '2026-05-11', amount: 5000, confidence: 0.4 },
      { transaction_date: '2026-05-10', amount: 3000, confidence: 0.4 },
    ]);
    expect(shouldUpgradeToHigh(r)).toBe(false);
  });
});

describe('effectiveSourceType', () => {
  it('document_type 이 bank_capture 면 그 값을 우선한다', () => {
    expect(effectiveSourceType('receipt_image', 'bank_capture')).toBe('bank_capture');
  });

  it('document_type 이 card_capture 면 그 값을 우선한다', () => {
    expect(effectiveSourceType('receipt_image', 'card_capture')).toBe('card_capture');
  });

  it('document_type 이 sms 면 그 값을 우선한다', () => {
    expect(effectiveSourceType('receipt_image', 'sms')).toBe('sms');
  });

  it('document_type 이 receipt 면 추론값(파일 MIME 기반)을 유지한다', () => {
    expect(effectiveSourceType('receipt_image', 'receipt')).toBe('receipt_image');
  });

  it('document_type 이 other 면 추론값을 유지한다', () => {
    expect(effectiveSourceType('pdf', 'other')).toBe('pdf');
  });
});
