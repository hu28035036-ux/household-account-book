type LearningHints = {
  topMerchants: string[];        // 정규화된 가맹점명 (마스킹 통과)
  topCategories: string[];
  topPaymentMethods: string[];
};

export function buildExtractionPrompt(maskedOcrText: string, hints: LearningHints): string {
  const hintBlock = JSON.stringify({
    user_top_merchants: hints.topMerchants.slice(0, 20),
    user_top_categories: hints.topCategories.slice(0, 10),
    user_top_payment_methods: hints.topPaymentMethods.slice(0, 10),
  });

  return `너는 한국어 가계부 영수증/카드내역/계좌내역 분석기다.
반드시 아래 JSON 스키마로만 출력한다. 설명, 코드블록, 추가 텍스트 금지.

# 입력 모드 (둘 중 하나 또는 둘 다 제공됨)
- 첨부 이미지가 있으면 이미지에서 직접 정보를 읽어라 (1순위)
- [OCR_MASKED] 텍스트는 이미지가 어두울 때를 위한 보조 (2순위)
- 둘 다 있으면 이미지 우선, OCR 은 hint
- 이미지 없고 OCR 만 있으면 OCR 만으로 판단 (보수적으로)

# 한국 영수증/카드내역 인식 팁
- '합계' '판매금액' '결제금액' '받은금액' '청구금액' 중 가장 큰 합계가 amount
- '카드' '신한' '국민' '삼성' '현대' '롯데' 같은 키워드 → payment_method_suggestion
- '스타벅스' 'GS25' 'CU' '이마트' 같은 가맹점명 → merchant_name (영수증 상단)
- 영수증 상단에 있는 'YYYY-MM-DD' 또는 'YYYY/MM/DD' → transaction_date
- 영수증 한 장 = 한 거래 (보통). 카드 명세서는 여러 거래 가능
- 부가세·할인·잔액·포인트 같은 줄은 거래로 만들지 마라
- 마스킹된 카드번호 (예: 123456******1234) 가 보이면 payment_method 의 일부로

# 일반 규칙
- 만든 정보 X — 불확실하면 null + warning
- 금액은 정수(원). 날짜는 ISO YYYY-MM-DD 또는 null
- description, raw_text_basis 는 string. 값 없으면 빈 문자열 ""
- warnings 는 배열. 없으면 []
- raw_text_basis: OCR 텍스트에 실제로 등장한 스니펫 (이미지에서만 본 거면 빈 문자열)

[USER_HINTS]
${hintBlock}

[OCR_MASKED]
${maskedOcrText || '(OCR 텍스트 없음 — 이미지에서 직접 판단)'}

[OUTPUT_JSON_SCHEMA]
{
  "document_type": "receipt|card_capture|bank_capture|sms|other",
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD or null",
      "type": "income|expense|transfer",
      "merchant_name": "string or null",
      "description": "string",
      "amount": number or null,
      "category_suggestion": "string or null",
      "payment_method_suggestion": "string or null",
      "confidence": number,
      "raw_text_basis": "OCR 텍스트에 등장한 스니펫 또는 빈 문자열",
      "warnings": ["string", ...]
    }
  ],
  "global_warnings": ["string", ...]
}`;
}
