import { describe, it, expect } from 'vitest';
import { buildExtractionPrompt } from '@/lib/ai/prompt';

const baseHints = { topMerchants: [], topCategories: [], topPaymentMethods: [] };

describe('buildExtractionPrompt', () => {
  it('은행/카드 다행 모드 가이드 블록을 포함한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('한국 은행/카드 앱 거래내역 캡처 (다행 모드');
    expect(p).toContain('document_type 판정');
  });

  it('todayKstISO 인자가 [TODAY_KST] 블록으로 주입된다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('[TODAY_KST]');
    expect(p).toContain('2026-05-11');
  });

  it('todayKstISO 가 없으면 [TODAY_KST] 블록을 생략한다', () => {
    const p = buildExtractionPrompt('', baseHints);
    expect(p).not.toContain('[TODAY_KST]');
  });

  it('다양한 날짜 형식 가이드("MM.DD", "어제")를 포함한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('MM.DD');
    expect(p).toContain('어제');
  });

  it('날짜 정확도 sanity check 가이드("11.05", "0 패딩")를 포함한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('날짜 정확도');
    expect(p).toContain('11.05');
    expect(p).toContain('0 패딩');
  });

  it('금액 정확도 sanity check 가이드(100원 ~ 1억원 범위, 콤마 자릿수)를 포함한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('금액 정확도');
    expect(p).toContain('100원');
    expect(p).toContain('1억원');
    expect(p).toContain('1,280');
    expect(p).toContain('128,000');
  });

  it('금액 두 번 읽기 절차(자릿수 블렌딩 방지, 한 글자씩 인식)를 포함한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('금액 두 번 읽기');
    expect(p).toContain('한 글자씩');
    expect(p).toContain('34,600');
    expect(p).toContain('33,460');
  });

  it('숫자 글자 혼동 케이스(0/6/8, 3/8, 1/7, 4/A 등)를 포함한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('숫자 글자 혼동');
    expect(p).toContain('0 / 6 / 8');
    expect(p).toContain('3 / 8');
    expect(p).toContain('1 / 7');
  });

  it('학습 힌트 hintBlock 에 한국 은행/카드사 이름을 함께 주입한다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('known_korean_banks_and_cards');
    expect(p).toContain('카카오뱅크');
    expect(p).toContain('KB국민카드');
  });

  it('OCR 텍스트가 비어있을 때 안내 fallback 을 넣는다', () => {
    const p = buildExtractionPrompt('', baseHints, '2026-05-11');
    expect(p).toContain('OCR 텍스트 없음');
  });

  it('OCR 텍스트가 있으면 그대로 [OCR_MASKED] 블록에 포함된다', () => {
    const p = buildExtractionPrompt('스타벅스 5,800원', baseHints, '2026-05-11');
    expect(p).toContain('[OCR_MASKED]');
    expect(p).toContain('스타벅스 5,800원');
  });
});
