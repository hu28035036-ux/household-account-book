# OLLAMA_GEMMA_FLOW

## 모델 / 서버
- 모델: **gemma4:e4b** (Ollama).
- 서버: **사용자 로컬 PC 또는 별도 AI 서버**. Vercel 내부에서 실행하지 않는다.
- 환경변수
  - `OLLAMA_API_BASE_URL` — 예: `https://ollama.example.com` 또는 `http://192.168.0.10:11434`
  - `OLLAMA_MODEL=gemma4:e4b`

## 호출 인터페이스
- HTTP POST `${OLLAMA_API_BASE_URL}/api/generate`
  - body 예: `{ "model": "gemma4:e4b", "prompt": "...", "format": "json", "stream": false, "options": { "temperature": 0.1 } }`
- 또는 `/api/chat` (메시지 기반). 본 프로젝트는 **JSON 강제 모드**(`format: "json"`)로 시작.

## 프롬프트 구조 (요약)
```
[SYSTEM]
너는 한국어 가계부 영수증/카드내역/계좌내역 분석기다.
반드시 지정된 JSON 스키마로만 출력한다.
OCR 텍스트에 없는 정보를 만들지 마라.
불확실하면 null과 warning을 사용한다.

[USER 컨텍스트]
- 사용자 자주 쓰는 가맹점: [normalized_pattern, ...]   (마스킹/정규화된 형태)
- 사용자 자주 쓰는 결제수단: [...]
- 사용자 자주 쓰는 카테고리: [...]

[OCR_TEXT_MASKED]
<<masked OCR text here>>

[OUTPUT JSON SCHEMA]
{
  "document_type": "receipt|card_capture|bank_capture|sms|other",
  "transactions": [{
    "transaction_date": "YYYY-MM-DD|null",
    "type": "income|expense|transfer",
    "merchant_name": "string|null",
    "description": "string",
    "amount": number|null,
    "category_suggestion": "string|null",
    "payment_method_suggestion": "string|null",
    "confidence": number,
    "raw_text_basis": "string",
    "warnings": ["string", ...]
  }],
  "global_warnings": ["string", ...]
}
```

## 출력 검증 (zod)
- 필드 누락/타입 오류는 즉시 reject.
- `transactions[].raw_text_basis`가 OCR 텍스트의 substring인지 검증 → 아니면 warning `"basis_not_found"` 부착하고 confidence 하향.
- 금액이 숫자가 아니거나 음수면 null로 변환 + warning.
- date 형식이 ISO가 아니면 null로 변환 + warning.

## 재시도 정책
- 1차 호출 실패(파싱 실패) → temperature 0으로 1회 재시도.
- 2회 모두 실패 → `ai_extraction_jobs.status='failed'`, error_message 저장, 사용자에게 "AI 분석 실패. 수동 입력으로 진행하시겠어요?" 안내.

## 환경변수 누락 시
- `OLLAMA_API_BASE_URL` 미설정 → API 라우트에서 503 + 사용자에게 "AI 서버 미구성" 안내.
- 연결 timeout(예: 60s) → 사용자에게 "AI 분석 서버 연결 실패. OCR 텍스트로 수동 입력하시겠어요?".

## 보안
- AI 서버에 보내는 내용은 **마스킹된 OCR 텍스트**.
- AI 서버를 인터넷에 직접 노출하지 않는다. 옵션:
  - Cloudflare Tunnel + 토큰 기반 인증
  - Tailscale 등 사설망
  - Vercel ↔ AI 서버 사이의 공유 시크릿 헤더 (예: `x-ai-token`)
- AI 서버 응답 로그에 사용자 식별 정보 포함 금지.

## 비용/성능
- gemma4:e4b는 로컬 실행이므로 호출 비용 없음. 단, **PC가 꺼지면 분석 불가**.
- 분석 시간: 영수증 1장 기준 수 초~수십 초 예상. 사용자에게 진행 상태 표시 필수.
- 동시 요청 큐잉: 같은 사용자가 다수 파일을 한 번에 올리면 서버에서 직렬 처리 큐를 둔다(향후 BullMQ 등 검토).

## 분석 전 학습 힌트
- 프롬프트 USER 컨텍스트에 사용자 학습 패턴을 **요약(상위 N개)** 으로 주입.
- 너무 많이 주입하면 토큰 낭비/혼란 → 가맹점 상위 20개, 카테고리 상위 10개 권장.

## 분석 후 후처리
- 사용자 패턴과 비교해 카테고리 자동 보정(자주 같은 카테고리로 분류했던 가맹점이면 confidence 상향).
- 사용자 패턴과 어긋나면 confidence 하향 + warning `"differs_from_user_pattern"`.
