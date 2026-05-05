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
OCR 텍스트에 없는 정보를 만들지 마라. 불확실하면 null과 warning을 사용한다.
금액은 정수(원). 날짜는 ISO YYYY-MM-DD 또는 null.

[USER_HINTS]
${hintBlock}

[OCR_MASKED]
${maskedOcrText}

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
      "raw_text_basis": "OCR 텍스트에 실제로 등장한 짧은 스니펫",
      "warnings": ["string", ...]
    }
  ],
  "global_warnings": ["string", ...]
}`;
}
