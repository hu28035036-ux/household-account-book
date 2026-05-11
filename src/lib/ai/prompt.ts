import { BANKS } from '@/lib/banking/banks';

type LearningHints = {
  topMerchants: string[];        // 정규화된 가맹점명 (마스킹 통과)
  topCategories: string[];
  topPaymentMethods: string[];
};

export function buildExtractionPrompt(
  maskedOcrText: string,
  hints: LearningHints,
  todayKstISO?: string,
): string {
  const hintBlock = JSON.stringify({
    user_top_merchants: hints.topMerchants.slice(0, 20),
    user_top_categories: hints.topCategories.slice(0, 10),
    user_top_payment_methods: hints.topPaymentMethods.slice(0, 10),
    known_korean_banks_and_cards: BANKS.map((b) => b.name),
  });

  const todayBlock = todayKstISO ? `\n[TODAY_KST]\n${todayKstISO}\n` : '';

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

# 한국 은행/카드 앱 거래내역 캡처 (다행 모드 — 은행·카드사 무관 공통 규칙)
- 대상 앱 (예시): KB국민·신한·우리·하나·NH농협·IBK기업·SC제일·씨티·카카오뱅크·케이뱅크·토스뱅크·지방은행 / KB·신한·삼성·현대·롯데·우리·하나·NH·BC·씨티 카드. 그 외 한국 금융 앱도 동일하게 처리.
- 한 화면에 여러 거래가 위→아래로 나열된 경우 각 행을 별도 transaction 으로 분리 (영수증의 "1장 = 1거래" 규칙 적용 안 됨)
- 좌측 영역: 가맹점/상호/거래 설명 (예: "스타벅스 강남점", "ATM 출금", "○○에게 송금", "급여", "카드결제")
- 우측 영역: 금액. \`+\`/파랑 = 입금(income), \`-\`/빨강 = 출금(expense). 부호·색상이 모두 없으면 좌측 키워드("입금","출금","결제","이체","송금","급여","이자")로 type 추정
- 화면 최상단의 계좌 잔액·계좌번호·"보유 금액"·연도 표시는 거래로 만들지 않는다 (잔액은 amount 가 아님)
- 카드 명세서 하단 "총 결제금액"·"이번 달 합계"·"청구금액"은 합계이므로 거래로 만들지 않는다
- 페이지네이션 안내 ("더보기","이전 거래") 같은 UI 요소도 무시
- 한 거래 행 안에 시간(HH:MM)·거래번호·잔액이 함께 표시되면 해당 정보는 amount 가 아님

# document_type 판정
- 화면 상단에 "거래내역" / 계좌번호 / 잔액 표시 → "bank_capture"
- "이용내역" / "결제내역" / 카드번호 마스킹 → "card_capture"
- "SMS/알림톡" 형태 한 줄 → "sms"
- 영수증 한 장 사진 → "receipt"
- 그 외 → "other"

# 날짜 형식 다양성 (반드시 YYYY-MM-DD 로 정규화하여 출력)
- "YYYY-MM-DD", "YYYY/MM/DD", "YY.MM.DD", "YYYY.MM.DD" → ISO 변환
- "MM.DD", "MM/DD", "MM월 DD일" (연도 생략): 화면 어딘가에 연도가 보이면 그 연도, 아니면 TODAY_KST 의 연도. 단 그 결과가 TODAY_KST 보다 미래면 직전 연도로 보정
- "오늘" → TODAY_KST, "어제" → TODAY_KST - 1일, "그저께" → TODAY_KST - 2일
- 시간(HH:MM, "오후 2시")은 무시하고 날짜만 추출

# 날짜 정확도 (자주 틀리는 케이스 — 두 번 읽고 교차검증)
- "11.05" 는 11월 5일. 절대 "11.5" → 11월 50일 / 11월 5일 둘 중 하나로 추측하지 말고 원본 자릿수를 그대로 본다. 단자릿수 일자는 0 패딩(11.5 가 "11.05" 처럼 보인다면 11.05)
- "MM.D" 와 "MM.DD" 가 구분 안 되면 일자가 32 이상이면 자릿수 오류 — 반대로 해석
- 점/슬래시/대시(. / -)는 같은 구분자로 취급. "2026-05-11", "2026/05/11", "26.05.11" 모두 동일
- 날짜를 추출했다면 transaction_date 와 raw_text_basis 에 동일 표기가 나타나는지 확인 — 불일치면 confidence 를 낮추고 warning 부여

# 금액 처리
- 정수(원). 콤마/원/₩/KRW 제거
- "-12,800원", "-12,800", "(12,800)", "▼12,800", "출 12,800" 모두 절댓값 12800. 부호·출입금 키워드는 type 으로 표현
- "12,800원 결제" 처럼 텍스트 한 줄에 금액과 액션 키워드가 함께면 키워드로 type 결정

# 금액 정확도 (자주 틀리는 케이스 — 두 번 읽고 sanity check)
- 한국 영수증/거래내역 의 일반 금액 범위는 100원 ~ 1억원. 그 밖이 나오면 자릿수 오류 가능성 — 콤마/소수점 위치 재확인
- "12,800" 을 "1,280" 또는 "128,000" 으로 잘못 읽지 않도록 콤마 앞뒤 자릿수가 1-3 자리인지 확인 (한국 표기는 1,000 / 12,300 / 123,400 / 1,234,500 형태)
- 같은 행에 여러 숫자가 있을 때 (단가·수량·소계·합계) 가맹점/거래 행의 대표 금액 1개만 amount 로 쓴다. 영수증은 "합계/결제금액", 카드/은행 캡처는 가맹점 우측의 큰 금액
- 추출한 amount 의 자릿수와 raw_text_basis 의 자릿수가 일치하는지 검증. 불일치면 confidence 낮추고 warning 부여

# 금액 두 번 읽기 (필수 절차 — 자릿수 블렌딩 방지)
LLM 비전 모델은 인접 자릿수가 시각적으로 섞여 한 자리만 다른 값으로 잘못 읽는 사례가 있다.
예: 실제 "34,600" 인데 "33,460" 으로 추출 (자릿수는 같은데 각 위치의 숫자가 흐림). 이를 막기 위해 다음 절차를 반드시 수행:
  1) 이미지의 금액 영역을 **한 글자씩** 인식 (예: "3", "4", ",", "6", "0", "0")
  2) 통합해 정수로 변환 (예: 34600)
  3) raw_text_basis 에 **원본 표기 그대로** 기록 (예: "34,600원")
  4) 통합한 정수의 자릿수와 raw_text_basis 의 자릿수·각 자리 digit 이 일치하는지 비교
  5) 비교 결과 자신 없으면 amount=null + warning="amount_uncertain" 으로 보내라. 추측 금지.

# 숫자 글자 혼동 케이스 (영수증·은행 앱 폰트에서 자주 발생)
- 0 / 6 / 8 / O / B 혼동 (특히 작거나 흐린 폰트)
- 3 / 8 혼동
- 1 / 7 / I / l 혼동
- 4 / A / Y 혼동
- 2 / Z 혼동
- 5 / 6 / S 혼동
- 9 / g 혼동
한 글자라도 위 후보 중 둘 사이에서 헷갈리면 자릿수 단위로 다시 보고, 그래도 자신 없으면 amount=null 로 둔다.

# 일반 규칙
- 만든 정보 X — 불확실하면 null + warning
- 금액은 정수(원). 날짜는 ISO YYYY-MM-DD 또는 null
- description, raw_text_basis 는 string. 값 없으면 빈 문자열 ""
- warnings 는 배열. 없으면 []
- raw_text_basis: OCR 텍스트에 실제로 등장한 스니펫 (이미지에서만 본 거면 빈 문자열)
${todayBlock}
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
