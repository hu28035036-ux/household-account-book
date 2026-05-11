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

---

## 변경사항 적용 후 흐름 (2026-05-11, 은행/카드 거래내역 캡처 인식률 개선)

### 1) 이미지 업로드 → AI 비전 (OCR 스킵)
사진(JPG/PNG/WebP)은 클라이언트 OCR을 거치지 않는다. 곧장 서버 `runExtractionForFile` 이 OpenAI `gpt-4o-mini` Vision 으로 이미지 자체를 분석한다 ([UploadClient.tsx](../src/components/upload/UploadClient.tsx) 라인 66-76, [extractionService.ts](../src/services/extractionService.ts) 라인 26-55). PDF만 브라우저에서 `pdfjs-dist` 로 텍스트 추출 후 `ocr_results` 저장 → 서버는 텍스트 모드로 LLM 호출.

### 2) 자동 승급(2-stage Vision) — 핵심 변경
이미지 파일 흐름에서:
- **1차 호출** — `imageDetail: 'low'`, `temperature: 0.1`. 512px 다운샘플, 빠르고 저렴. 영수증 1장 케이스는 보통 여기서 끝나 비용 회귀 없음.
- **2차 호출(자동 승급 조건)** — 이미지가 있고 다음 중 하나라도 만족하면 `imageDetail: 'high'`, `temperature: 0`, `maxTokens: 2500`, `timeoutMs: 90s` 로 재호출:
  1. 1차 JSON 파싱 실패
  2. `transactions` 배열이 비어있음
  3. 모든 거래의 `transaction_date` 가 null **또는** 모든 거래의 `amount` 가 null
  4. 거래 confidence 평균이 0.4 미만

  카카오뱅크/KB/신한/토스 등 은행 앱이나 카드사 앱처럼 한 화면에 작은 글자가 다행으로 빽빽한 캡처가 1차에서 빈약하게 인식되면 자동으로 high 해상도 재시도. `ai_extraction_jobs.model_name` 에 `:high` 접미사가 붙어 모니터링 가능. ([extractionService.ts](../src/services/extractionService.ts) `shouldUpgradeToHigh`)

### 3) 프롬프트 강화
[prompt.ts](../src/lib/ai/prompt.ts) `buildExtractionPrompt` 가 `todayKstISO` 인자를 받고, 다음 블록을 추가로 포함:
- **한국 은행/카드 앱 거래내역 캡처 (다행 모드)** — 한 화면 다행 분리, 좌측 가맹점/우측 ±금액, 색상·키워드 기반 type 추정, 상단 잔액·하단 합계 제외 규칙.
- **document_type 판정** — `bank_capture | card_capture | sms | receipt | other` 분류 가이드.
- **날짜 형식 다양성** — `MM.DD`, `MM/DD`, "오늘/어제/그저께", 연도 생략 시 `TODAY_KST` 기반 추론 + 미래면 직전 연도 보정.
- **금액 처리** — `-12,800원`, `(12,800)`, `▼12,800`, `출 12,800` 등 다양한 ±/접두 표기를 절댓값으로 정규화.
- **학습 힌트 hintBlock** 에 [banks.ts](../src/lib/banking/banks.ts) 의 `BANKS.map(b => b.name)` 를 `known_korean_banks_and_cards` 키로 주입 — LLM 이 21개 은행 + 10개 카드사 이름을 정확히 매칭.

### 4) 환각 가드 완화 (이미지 단독에서)
이미지 단독(`imageUrls && !masked`)이면 OCR 텍스트가 없으므로 `raw_text_basis` substring 검사는 항상 실패한다. 이 케이스에선 검사를 스킵해 정상 거래에 `basis_not_found` 페널티가 누적되는 노이즈를 제거. 이미지+OCR 병존이거나 PDF/텍스트(OCR-only) 흐름에서는 기존 환각 검증 유지 ([extractionService.ts](../src/services/extractionService.ts) `hasOcr` 조건).

### 5) source_type 자동 보정
업로드 시점의 `inferSourceType` 은 파일 MIME 만 보고 결정하므로 카카오뱅크 캡처도 `receipt_image` 로 들어간다. 이번 변경에서 `extraction.document_type` 이 `bank_capture | card_capture | sms` 면 캐시 row 의 `source_type` 을 같은 값으로 보정 (`effectiveSourceType`). `analysis_cache` 키 자체에는 영향 없어 캐시 무효화는 발생하지 않음. ([extractionService.ts](../src/services/extractionService.ts) `effectiveSourceType`)

### 6) 옵션 패스스루
- [openaiClient.ts](../src/lib/ai/openaiClient.ts): `imageDetail`, `timeoutMs` 옵션 추가. 라인 63 의 `detail: 'low'` 하드코딩 제거.
- [llmRouter.ts](../src/lib/ai/llmRouter.ts): `imageDetail`, `maxTokens`, `timeoutMs` 를 OpenAI 분기로 패스스루 (Ollama 는 vision 미지원이라 무시).

### 7) UI 안내 정정
[UploadClient.tsx](../src/components/upload/UploadClient.tsx) 라인 155 배지 + 라인 184-197 처리 흐름 안내가 "사진도 브라우저 OCR을 한다"고 잘못 안내하던 부분을 "**사진은 AI 비전이 직접 분석, PDF는 브라우저에서 텍스트 추출**" 로 정정.

### 갱신된 상태머신
```
uploaded
  → (이미지) ocr_done(text='')          ↘
                                          ai_processing
                                          ├─ 1차 LLM(low) → 빈약 판정 시 2차 LLM(high)
                                          └─ 또는 1차 충분 → 채택
                                          ↘
                                          parsed | failed
  → (PDF/CSV) ocr_processing → ocr_done(text=...) ↗
```

### 갱신된 후보 객체 영향
스키마 자체는 동일하나 데이터 분포가 다음과 같이 바뀐다:
- 은행/카드 캡처 1장에서 N개 후보가 생성 (이전: 0~1개)
- `confidence` 가 자동 승급으로 상승 (low 단독 대비)
- 이미지 단독에서 `basis_not_found` warning 빈도 급감 → 정상 거래는 깨끗한 warning 배열
- `analysis_cache.source_type` 이 `bank_capture` / `card_capture` / `sms` 로 분류되어 향후 통계·학습에서 영수증과 분리 가능

### 영향받지 않는 것
- `transaction_candidates` 와 `transactions` 테이블 스키마, RLS 정책
- OCR API 라우트(`/api/ocr/[fileId]`) 와 사용자 인증 게이트 (Supabase `auth.getUser()`)
- 중복 검사 30일 윈도, 학습 후처리(`applyLearningPostprocess`)
- gpt-4o-mini 모델 자체 (상위 모델 전환 없음)
- 캐시 키 전략 (이미지 단독은 `image:${fileId}`, 텍스트는 `inputHash(masked)`)
