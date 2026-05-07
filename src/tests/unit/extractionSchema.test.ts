import { describe, it, expect } from 'vitest';
import { parseExtractionLoose, ExtractionResult } from '@/lib/ai/extractionSchema';

describe('parseExtractionLoose', () => {
  it('정상 JSON 파싱', () => {
    const raw = JSON.stringify({
      document_type: 'receipt',
      transactions: [
        {
          transaction_date: '2026-05-05',
          type: 'expense',
          merchant_name: '스타벅스',
          description: '아메리카노',
          amount: 5800,
          confidence: 0.92,
          raw_text_basis: '스타벅스 5,800',
          warnings: [],
        },
      ],
      global_warnings: [],
    });
    const out = parseExtractionLoose(raw);
    expect(out.transactions[0].amount).toBe(5800);
    expect(out.document_type).toBe('receipt');
  });

  it('코드블록으로 감싼 JSON도 허용', () => {
    const raw = '```json\n{"document_type":"other","transactions":[],"global_warnings":[]}\n```';
    const out = parseExtractionLoose(raw);
    expect(out.transactions).toEqual([]);
  });

  it('앞뒤 텍스트가 섞인 응답에서도 JSON 추출', () => {
    const raw = '여기 결과입니다: {"document_type":"sms","transactions":[],"global_warnings":[]} 끝.';
    const out = parseExtractionLoose(raw);
    expect(out.document_type).toBe('sms');
  });

  it('잘못된 type은 expense 로 fallback (관대 모드)', () => {
    // 스키마의 type 필드는 .catch('expense') — 잘못된 값은 expense 로 안전 변환.
    // 거래는 throw 하지 않고 type 만 정정되어 보존됨.
    const raw = JSON.stringify({
      document_type: 'receipt',
      transactions: [{ type: 'unknown', confidence: 0.5 }],
      global_warnings: [],
    });
    const out = parseExtractionLoose(raw);
    expect(out.transactions).toHaveLength(1);
    expect(out.transactions[0].type).toBe('expense');
  });

  it('빈 transactions 허용 + 기본값', () => {
    const out = ExtractionResult.parse({});
    expect(out.transactions).toEqual([]);
    expect(out.global_warnings).toEqual([]);
    expect(out.document_type).toBe('other');
  });
});
