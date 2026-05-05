# AI_EXTRACTION_FLOW

## 전체 흐름 (단계별)
1. **사용자 업로드** — 이미지 1장 또는 다수 업로드.
2. **Supabase Storage 저장** — 원본 파일을 `user_id/yyyy/mm/uuid.ext` 경로에.
3. **uploaded_files insert** — 상태 `uploaded`.
4. **OCR 실행** — Tesseract.js로 텍스트 추출. 상태 `ocr_processing` → `ocr_done`.
5. **OCR 텍스트 미리보기 + 마스킹** — 사용자 확인용 미리보기, 저장본은 마스킹된 텍스트.
6. **앱 학습데이터 사전 매칭** — `merchant_learning_rules`, `analysis_cache`, `category_learning_rules`, `payment_method_learning_rules` 조회.
7. **Ollama gemma4:e4b 호출** — 마스킹된 OCR 텍스트 + 사용자 패턴 힌트를 프롬프트에 포함. 상태 `ai_processing`.
8. **JSON 검증** — zod 스키마로 형식 검증. 실패 시 1회 재시도, 그래도 실패하면 `ai_extraction_jobs.status='failed'`로 기록하고 사용자에게 안내.
9. **앱 학습데이터 후처리 보정** — 사용자 패턴과 다르면 confidence 하향 + warning. 자주 보던 가맹점이면 카테고리 자동 보정.
10. **중복 검사** — 날짜+금액+가맹점+결제수단+source_type 기준 유사도 산출.
11. **transaction_candidates insert** — `user_action='pending'`, `duplicate_status` 설정.
12. **사용자 표시** — 카드/표 UI에서 후보 확인.
13. **사용자 수정/제외/승인** — 카드 단위 또는 일괄.
14. **transactions insert** — 승인된 것만 저장. `is_ai_generated=true`, `is_confirmed=true`.
15. **학습 반영** — `user_correction_logs` 기록 + 가맹점·카테고리·결제수단 학습 규칙 갱신.
16. **통계 갱신** — 대시보드 집계는 view나 on-the-fly 쿼리로 계산.

## 단계별 상태머신 (uploaded_files.status)
```
uploaded → ocr_processing → ocr_done
        → ai_processing → parsed   (또는 failed)
        → approved
        → deleted (사용자 삭제 시)
```

## 후보 객체 스키마 (서버 내부 표준)
```ts
type Candidate = {
  id: string;
  uploadedFileId: string;
  transactionDate: string | null;     // ISO date
  type: 'income' | 'expense' | 'transfer';
  amount: number | null;
  merchantName: string | null;
  description: string;
  categorySuggestion: string | null;
  paymentMethodSuggestion: string | null;
  confidence: number;                 // 0..1
  duplicateStatus: 'none'|'suspected'|'duplicate';
  rawTextBasis: string;               // 마스킹된 스니펫
  warnings: string[];
  userAction: 'pending'|'approved'|'rejected'|'edited';
};
```

## 에러/엣지 케이스
| 케이스 | 처리 |
|---|---|
| OCR 실패 | 사용자가 텍스트를 직접 입력/수정한 후 분석 재시도 가능 |
| Ollama 서버 연결 실패 | 안내 + 수동 입력 또는 OCR 텍스트 기반 후보 생성 옵션 제공 |
| AI가 잘못된 JSON 반환 | 자동 1회 재시도 → 실패 시 사용자에게 "AI 분석 실패. 수동 입력으로 진행하시겠어요?" |
| AI가 없는 정보 생성 (환각) | 검증기에서 raw_text_basis가 OCR 텍스트에 실제로 존재하는지 substring 검사 → 없으면 warning 부착 |
| 날짜 불확실 | `transaction_date=null` + warning `"date_uncertain"` |
| 금액 불확실 | `amount=null` + warning `"amount_uncertain"` |
| 가맹점 불확실 | `merchant_name=null` + warning `"merchant_uncertain"` |
| 동일 OCR 재업로드 | `analysis_cache.input_hash` 매칭 시 캐시 결과 반환 (Ollama 미호출) |

## 사용자 액션
- **승인 (approve)** — 후보 → transactions로 이동, candidate.user_action = approved.
- **수정 후 승인 (edit + approve)** — 사용자 수정 반영 → transactions, correction_logs 기록.
- **제외 (reject)** — transactions에 들어가지 않음. user_correction_logs에 reject 기록(학습용).
- **전체 승인 / 전체 제외** — 일괄 처리. 단, **중복 의심·확인 필요는 일괄 승인에서 자동 제외** 후 사용자에게 따로 표시.

## 자동 최종 저장 금지
- "반복 패턴이라 확실해 보임"도 자동 저장 금지.
- "전과 동일한 가맹점/금액/결제수단"도 후보로만 만들고, 사용자 한 번의 클릭(또는 일괄 승인)을 거쳐야 transactions에 들어간다.
- 일괄 승인 UX는 모바일에서 sticky bar로 제공하되, 의심 항목은 일괄 대상에서 제외해 별도 영역으로 모은다.
