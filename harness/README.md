# Harness — 도메인 회귀 + 프롬프트 eval

이 폴더는 가계부 핵심 흐름(영수증 → 후보, 가맹점 정규화, 카테고리 추정)이 **회귀하지 않게 잡아주는 그물망**이다.
vitest/Playwright 와는 별개로, **도메인 콘텐츠 회귀**(특정 영수증이 특정 후보로 안정적으로 나오는가) 를 다룬다.

운영 책임: `qa-harness` 에이전트

---

## 무엇을 잡는가

| 케이스 종류 | 위치 | 목적 |
|---|---|---|
| 영수증 → 후보 | `cases/extraction/*.json` | 영수증/카드명세 텍스트 → 거래 후보 (ai-extraction 회귀) |
| 가맹점 정규화 | `cases/merchant/*.json` | 원문 가맹점명 → 정규화된 표시명 |
| 카테고리 추정 | `cases/category/*.json` | 가맹점/메모 → 카테고리 |
| 마스킹 | `cases/masking/*.json` | 카드/계좌/주민/전화 마스킹 정확도 |
| 어시스턴트 의도 | `cases/assistant/*.json` | "5천원 점심" 등 자연어 → intent + slots |

각 케이스 파일 형식:

```json
{
  "id": "extraction-001",
  "tags": ["card-statement", "lotte-card"],
  "input": {
    "text": "<마스킹된 OCR 또는 카드 명세 텍스트>",
    "user_hints": { "merchants": ["스타벅스"], "categories": ["식비"] }
  },
  "expected": {
    "candidates": [
      {
        "merchant": "스타벅스",
        "amount": 5500,
        "category": "식비",
        "confidence_min": 0.7
      }
    ]
  },
  "tolerances": {
    "amount_pct": 0,
    "merchant_match": "exact-or-alias"
  }
}
```

---

## 실행

```bash
node harness/run.mjs                        # 전체
node harness/run.mjs --tag card-statement   # 태그 필터
node harness/run.mjs --case extraction-001  # 단건
node harness/run.mjs --domain extraction    # 도메인별
```

## Verify 게이트 (작업 종료 전)

CONTRACT §9-A-3 ("검증 없는 종료 막기") 강제용 통합 게이트.

```bash
node harness/verify.mjs              # typecheck + vitest + harness/run --mock
node harness/verify.mjs --full       # + smoke + RLS audit (dev 서버 + Supabase env 필요)
node harness/verify.mjs --smoke      # 위 + smoke 만
node harness/verify.mjs --rls        # 위 + RLS 만
node harness/verify.mjs --no-vitest  # 빠른 점검용 (vitest 생략)
```

첫 실패 단계에서 즉시 종료, 종료 코드 1. 게이트 실패한 채 작업을 종료하지 않는다.

종료 코드:
- `0` — 전체 통과
- `1` — 실패 케이스 존재
- `2` — 실행 환경 문제 (서버 다운, 누락 fixture 등)

---

## 새 케이스 추가

1. 실제 사용자 사고/회귀가 발생했거나, 도메인 함정을 발견했을 때
2. `cases/<도메인>/<id>.json` 작성 — 현재 코드에서 통과하는 상태로
3. 실패 상태로 추가하고 싶다면 `id` 끝에 `.skip` 붙이기 (`extraction-007.skip.json`)
4. 테스트 데이터(영수증 이미지)는 `harness/fixtures/` 에 두고 input.text 에서 참조

도메인 콘텐츠는 추가만, 삭제는 사용자 승인 후.

---

## 환경

- AI 추출 케이스는 로컬에서 OCR/LLM 서버가 살아 있어야 함 (`.env.local` + `npm run dev` 또는 직접 `extractionService` 호출 모드)
- `--mock` 플래그로 LLM 호출 없이 파서/마스킹/매핑 로직만 검증 가능

---

## 폴더 구조

```
harness/
├── README.md            ← 이 문서
├── run.mjs              ← 실행 진입점
├── lib/
│   ├── runner.mjs       ← 케이스 로딩 + 실행
│   ├── compare.mjs      ← expected vs actual 비교
│   └── report.mjs       ← 콘솔 리포트
├── cases/
│   ├── extraction/
│   ├── merchant/
│   ├── category/
│   ├── masking/
│   └── assistant/
└── fixtures/            ← 영수증 이미지/긴 텍스트
```
