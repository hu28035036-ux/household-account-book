# RAG / Hallucination — 환각 검증 인프라

가계부 프로젝트에서 **에이전트가 가짜 인용을 만들지 않도록** 잡는 그물망.

운영 책임: `qa-harness` (도구 운영) + `verifier` (메타 흐름 5단계에서 호출) + `curator` (incident 기록).

---

## 1. 무엇을 hallucination 으로 정의하는가

### 종류 1 — 추출 단계 hallucination (AI 가 만들어내는 가짜 정보)
- 영수증 OCR 원문에 **없는** 가맹점/금액/카테고리를 후보에 채워 넣음
- 사용자 학습 규칙과 **정반대** 카테고리를 자신감 있게 추정
- 마스킹된 텍스트에서 마스킹 전 원본을 **추정**해 후보에 채워넣음

→ 책임: `ai-extraction` 영역. 이미 확률(confidence) + zod 검증으로 1차 방어. 본 폴더는 *회귀 케이스* 만 카탈로그.

### 종류 2 — 에이전트 답변 hallucination (가장 위험)
사용자에게 보내는 답변 / 코드 주석 / commit 메시지에:
- **존재하지 않는 파일경로** 인용 (예: `src/lib/budget/calculator.ts` 인데 실제로는 `budgetService.ts`)
- **가짜 CONTRACT 조항** 인용 (예: `§9-A-7` 인데 §9-A 는 §9-A-1~4 만 있음)
- **가짜 incident 번호** (예: `incident-0042` 인데 runbook 에 없음)
- **가짜 커밋 hash** (예: `abc1234` 인데 git log 에 없음)
- **가짜 PDF 페이지** 인용 (예: PDF p33 인데 24p 까지)
- **가짜 검색 결과** ("RAG 가 X를 1위로 반환했다" — 실제로는 미실행)

→ 책임: 모든 에이전트. 본 도구가 답변 텍스트에서 인용을 자동 추출 → 실제 존재 검증.

### 종류 3 — RAG 검색 결과 자체의 hallucination
- 검색 점수 임계 미달 결과를 자신 있게 인용 (예: 점수 < 1.0)
- 검색 결과 0건인데 "관련 문서 있다" 주장
- 검색 인덱스가 stale 인데 새 문서 인용

→ 책임: 본 도구 + Curator(인덱스 갱신).

---

## 2. 운영 명령

### 답변 텍스트의 인용 검증
```bash
# 텍스트 직접 입력
node rag/hallucination/verify-citations.mjs --text "src/services/budgetService.ts 의 §9-A-3 위반 — incident-0001 참조"

# 파일에서 입력
node rag/hallucination/verify-citations.mjs --file path/to/draft.md

# stdin 에서 입력
cat draft.md | node rag/hallucination/verify-citations.mjs

# JSON 출력 (머신 파싱)
node rag/hallucination/verify-citations.mjs --text "..." --json
```

종료 코드:
- `0` — 모든 인용 실재 확인
- `1` — 가짜 인용 발견
- `2` — 도구 자체 결함 (실행 환경 문제)

### 가계부 도메인 hallucination 패턴 카탈로그
[`patterns.json`](./patterns.json) — 가계부에서 자주 발생할 수 있는 hallucination 시나리오 카탈로그.
새 incident 발생 시 패턴 추가.

### 회귀 케이스
[`cases/*.json`](./cases/) — 실제 발생했거나 예방 가치 있는 hallucination 입력/기대 패턴.

---

## 3. 검증되는 인용 종류와 매처

| 인용 종류 | 정규식 | 검증 방법 |
|---|---|---|
| 파일경로 | `[a-zA-Z0-9_./\-]+\.(ts\|tsx\|js\|mjs\|json\|md\|sql\|css)` | `fs.access` 로 실재 확인 |
| CONTRACT 조항 | `§\d+(-[A-Z\d]+)*` | CONTRACT.md 에 헤딩 매칭 확인 |
| incident 번호 | `incident-\d{4}([-a-z]+)?` | runbook.md 에 헤딩 매칭 확인 |
| commit hash | 7자리 이상 16진수 | `git rev-parse --verify` 로 확인 (git 환경에서만) |
| PDF 페이지 | `(PDF \|p\.?)\s*\d+` | PDF 페이지 수 범위 확인 (참조된 PDF 가 명시된 경우) |

---

## 4. 흐름 통합

### Verifier 단계에서 호출
메타 흐름 [5] verifier 가 영역 에이전트의 작업 종료 보고 / 커밋 메시지 / plan 결과 섹션에 verify-citations 실행.
가짜 인용 발견 시 → 영역 환송 (수정사항 메시지 포함).

### loop-validator round 3 의 step 으로
ESLint / §9-A grep 과 함께 round 3 step 추가 가능 (이번 PR 에서는 추가하지 않음 — 이번엔 도구만).

### 자기 점검 ([AGENT_BEHAVIOR §1](../../docs/AGENT_BEHAVIOR.md))
사용자에게 답변 송출 전 본 도구로 자기 답변을 검증하는 게 정직 기록의 일환.

---

## 5. 알려진 한계

- **자연어 인용**: "거래 서비스 파일" 같은 자연어 인용은 검증 못 함. 정확 경로/번호만 잡힘.
- **부분 hash**: `abc12` 같은 5자리는 검증 안 함 (false positive 위험).
- **PDF 페이지 검증은 옵션**: 본 PDF 가 매핑된 경우만. 알려지지 않은 PDF 인용은 패스.
- **의미 hallucination 미검출**: 파일/조항이 실재해도 *의미* 가 잘못된 경우 (예: §9-A-3 의 내용을 §9-A-2 로 인용). 본 도구는 *실재 여부* 만.

의미 검증은 사람 검토 영역. 도구는 *명백한 가짜* 만 잡는다.

---

## 6. 폴더 구조

```
rag/hallucination/
├── README.md
├── verify-citations.mjs         CLI 진입점
├── lib/
│   ├── extractors.mjs           답변 텍스트 → 인용 추출
│   └── checkers.mjs             각 인용 종류 실재 검증
├── patterns.json                가계부 도메인 known hallucination 카탈로그
├── cases/                       회귀 케이스 (실제 발생 / 예방)
│   └── *.json
└── incidents.md                 hallucination 발생 사례 영구 기록
```

---

## 7. 비-목표

- 자동 hallucination 수정 — 본 도구는 *검출*. 수정은 영역 에이전트가 사람 승인 후.
- 의미 검증 (LLM 으로 "이 인용이 맥락에 맞나" 판단) — 비용 / 비결정성. 본 도구는 결정적.
- 답변 텍스트 자동 재작성 — 사용자 답변을 임의로 바꾸는 위험.
