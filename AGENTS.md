# AI 가계부 — Agent Guide

> 이 프로젝트에서 작업하는 모든 AI 에이전트(Claude Code, Codex 등)가 **세션 시작 시 먼저 읽는 입구 문서**.
> 세부 내용은 여기 담지 않는다 — 각 영역 문서로 라우팅만 한다.

작성 기준 모델: `claude-opus-4-7` / `gpt-5.x`
모델 업그레이드 시 본 문서, CONTRACT.md, hooks, `.claude/agents/*` 를 재점검한다.

---

## 1. 이 프로젝트가 뭔가

**AI 가계부**: 영수증·카드/계좌 캡처를 OCR + 로컬 LLM(또는 OpenAI Vision)으로 분석해 거래 후보를 만들고, **사용자가 승인한 항목만** 가계부에 저장하는 다중 사용자 웹앱.

- 사용자: 개인 + 가족 단위 공유(households)
- 스택: Next.js 14 (App Router) · TypeScript · Tailwind · Supabase(Auth+DB+RLS+Storage) · Tesseract.js / OpenAI Vision · Vercel(`icn1`)
- 차별화: AI는 후보만 제안, 사람이 승인 → 학습 → 다음번 정확도 ↑. 가족 공유 + 학습 누적이 moat.

---

## 2. 작업 전 반드시 읽을 문서 (우선순위 순)

| 우선 | 문서 | 용도 |
|---|---|---|
| 🔴 1 | [`CONTRACT.md`](./CONTRACT.md) | 절대 위반 금지. 금융·개인정보·RLS 계약. **충돌 시 항상 최우선** |
| 🔴 2 | [`docs/AGENT_BEHAVIOR.md`](./docs/AGENT_BEHAVIOR.md) | 행동 규범. 냉정 판단 / 자만 금지 / 대안 제시 / 실수 기록 의무 |
| 🟡 3 | [`docs/design-log/00-overview.md`](./docs/design-log/00-overview.md) | 시스템 설계 철학 — 왜 이렇게 만들었나 |
| 🟡 4 | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | 시스템 구조·레이어·데이터 흐름 |
| 🟡 5 | [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | 테이블/RLS/인덱스 |
| 🟡 6 | [`docs/SECURITY_PRIVACY_RULES.md`](./docs/SECURITY_PRIVACY_RULES.md) | 마스킹·로깅·시크릿 규칙 |
| 🟢 7 | [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md) | Phase별 구현 현황 (가장 빠르게 변하는 문서) |
| 🟢 8 | [`docs/PITFALLS.md`](./docs/PITFALLS.md) | 과거에 한번 밟은 함정 모음 |
| 🟢 9 | [`harness/runbook.md`](./harness/runbook.md) | 검증/테스트 실수 영구 기록 (incident 누적) |

설계 의도 누적 (영구 보존):
- [`docs/design-log/`](./docs/design-log/) — 00 overview · 01 meta-agents · 02 area-agents · 03 harness · 04 rag · 05 flow

전체 docs는 [`README.md`](./README.md) 하단 목록 참조.

---

## 3. 폴더 구조 (한눈에)

```
가계부/
├── AGENTS.md              ← 지금 이 문서 (입구/목차)
├── CONTRACT.md            ← 절대 규칙 (금융/개인정보/RLS)
├── README.md              ← 사용자/배포 가이드
├── .claude/
│   ├── agents/            ← 영역별 서브에이전트 5개 (병렬 작업 단위)
│   ├── settings.json
│   └── settings.local.json
├── docs/                  ← 30+ 설계 문서
├── harness/               ← 도메인 회귀 케이스 + 프롬프트 eval
├── rag/                   ← docs/ 인덱스 + 검색 (에이전트가 컨텍스트 빠르게 끌어오기 위함)
├── src/
│   ├── app/               App Router 라우트 + API
│   ├── components/        UI (25개 도메인 폴더)
│   ├── lib/               인프라 (supabase, ocr, ollama, ai, security, learning…)
│   ├── services/          도메인 로직 21개
│   └── tests/             단위 + 하네스
├── e2e/                   Playwright (smoke, responsive, visual)
├── scripts/               smoke / audit / 데이터 생성
├── supabase/migrations/   0001 ~ 0016
└── samples/               샘플 xlsx + 은행 명세
```

---

## 4. 영역 분할 — 병렬 작업 단위

각 에이전트는 **자기 영역만 수정**한다. 영역 경계는 `.claude/agents/<name>.md` 의 `# Scope` 섹션에 절대적 화이트리스트로 명시되어 있다. 다른 영역 파일을 건드려야 하면 **그 영역의 에이전트에게 위임**한다.

### 4-1. 메타 에이전트 (흐름 제어)

| 단계 | 에이전트 | 한 줄 책임 | 정의 파일 |
|---|---|---|---|
| 1 | `conductor` | 질문 파악 + 의도 분석 + 종료 보고 | [`.claude/agents/conductor.md`](./.claude/agents/conductor.md) |
| 2 | `orchestrator` | 영역 매핑 + 병렬/직렬 결정 + plan-first 트리거 | [`.claude/agents/orchestrator.md`](./.claude/agents/orchestrator.md) |
| 3 | `sentinel` | 사전 안전 가드 (CONTRACT 위반 / 자동 진행 금지 분류) | [`.claude/agents/sentinel.md`](./.claude/agents/sentinel.md) |
| 5 | `verifier` | 1차 사후 검증 (verify 게이트 + §9-A 사후 점검) | [`.claude/agents/verifier.md`](./.claude/agents/verifier.md) |
| 6 | `loop-validator` | **5회 연속 통과 강제** — 회차마다 점진적 검증, 실패 시 카운터 리셋 | [`.claude/agents/loop-validator.md`](./.claude/agents/loop-validator.md) |
| 7 | `curator` | 사후 큐레이션 (RAG 재인덱싱 + plan 기록 + memory 갱신) | [`.claude/agents/curator.md`](./.claude/agents/curator.md) |

### 4-2. 영역 에이전트 (실제 작업, 4단계)

| 에이전트 | 한 줄 책임 | 정의 파일 |
|---|---|---|
| `ai-extraction` | OCR · Vision · LLM 추출 · 후보 · 학습 | [`.claude/agents/ai-extraction.md`](./.claude/agents/ai-extraction.md) |
| `finance-core` | 거래 · 예산 · 카테고리 · 결제수단 · 반복 · 가져오기 | [`.claude/agents/finance-core.md`](./.claude/agents/finance-core.md) |
| `collab-security` | households · RLS · 개인정보 · 마스킹 · 관리자 | [`.claude/agents/collab-security.md`](./.claude/agents/collab-security.md) |
| `ux-design` | UI 컴포넌트 · 디자인 토큰 · 반응형 · PWA | [`.claude/agents/ux-design.md`](./.claude/agents/ux-design.md) |
| `qa-harness` | vitest · Playwright · smoke · 하네스 · RAG 운영 | [`.claude/agents/qa-harness.md`](./.claude/agents/qa-harness.md) |

### 4-3. 7단계 메타 흐름

```
사용자 입력
   │
   ▼
[1] conductor          ← 의도 분석. 모호하면 1회 질문.
   │
   ▼
[2] orchestrator       ← 영역 매핑 + 병렬/직렬 + plan-first 결정
   │
   ▼
[3] sentinel           ← 사전 가드. RLS / 마이그레이션 / 시크릿 / PII / 모델 교체 등
   │                      자동 진행 금지 항목 분류 → 위반 시 conductor 환송.
   ▼
[4] 영역 에이전트 (병렬 가능)
       ai-extraction ⊕ finance-core ⊕ ux-design   (3-way 동시)
       collab-security                              (단독)
       qa-harness                                   (read-only 병행)
   │
   ▼
[5] verifier           ← 1차 빠른 게이트 (typecheck + vitest + harness/run + smoke + RLS)
   │                      실패 시 영역 환송 (수정사항 + 사유)
   ▼
[6] loop-validator     ← **5회 연속 통과 강제**  (node harness/loop.mjs)
   │                      회차 1: typecheck + vitest
   │                      회차 2: + harness/run --mock
   │                      회차 3: + ESLint + §9-A grep
   │                      회차 4: + smoke:all
   │                      회차 5: + audit-rls + responsive
   │                      어느 회차든 실패 → 카운터 리셋 + 영역 환송
   │                      → 수정 → [5] verifier → [6] **1회차부터** 재시작
   │                      환송 5사이클(누적 25회) 한도 도달 시 conductor 보고
   ▼
[7] curator            ← RAG 재인덱싱 + execute-plans 결과 기록 + memory 갱신
   │
   ▼
[1] conductor 로 보고 → 사용자
```

**환송 흐름 요약**:

| 단계 | 환송 대상 | 의미 |
|---|---|---|
| [3] sentinel 차단 | [1] conductor | 사용자 승인 필요 (자동 진행 금지) |
| [5] verifier 실패 | [4] 영역 | 큰 결함 즉시 차단 |
| [6] loop-validator 실패 | [4] 영역 (카운터 리셋) | flaky / 안정성 결함 — 다시 1회차부터 |
| [6] loop-validator 한도 도달 | [1] conductor | 작업 의도 재검토 신호 |

### 4-4. 병렬 동시 작업 가능 조합 (영역 에이전트만)

- `ai-extraction` ⊕ `finance-core` ⊕ `ux-design` (3개 동시)
- `collab-security` 는 RLS / 마이그레이션 영향이 광범위 → **단독 실행 권장**
- `qa-harness` 는 read-only 로 다른 모든 에이전트와 병행 가능

메타 에이전트(conductor/orchestrator/sentinel/verifier/curator)는 **순차 실행**. 단계가 곧 의존성.

---

## 5. 작업 흐름 (모든 비자명한 작업)

1. **CONTRACT.md** 의 관련 조항 먼저 확인
2. 본인 영역 에이전트의 `# Scope`, `# Forbidden`, `# Read first` 섹션 확인
3. 비자명한 변경은 `docs/execute-plans/YYYY-MM-DD-제목.md` 에 **계획 먼저 작성** → 사용자 승인 → 구현
4. 마이그레이션 / RLS / 시크릿 / 외부 의존성 추가는 **자동 진행 금지** — 사람 승인 필수
5. 작업 종료 시 실행 계획 문서에 결과·이슈·다음 액션 기록
6. 검증: `npm run verify` (typecheck + test + build) → 영역별 smoke

---

## 6. 자주 쓰는 명령

```bash
npm run dev           # 개발 서버 http://localhost:3000
npm run typecheck
npm test              # vitest run
npm run e2e           # Playwright
npm run smoke:all     # 통합 smoke (auth/pages/content/mutation/assistant/rls)
npm run verify        # typecheck + test + build (PR 직전)
```

---

## 7. 사람 확인이 필요한 상황

- RLS 정책 변경 / 약화
- 새 PII 수집 항목 추가 (카드/계좌/주민/전화/사업자 관련)
- 마이그레이션 (특히 down 없는 변경)
- 새 외부 의존성 (npm 패키지 / 외부 API)
- AI 프롬프트 / 모델 교체 (Ollama ↔ OpenAI Vision)
- 7일 raw_text 폐기 정책 변경
- 가족 공유 권한 모델 변경

> 도메인 판단(어떤 카테고리 분류가 맞는지, 어떤 가맹점 정규화 키워드를 쓸지)은 사람이.

---

## 8. RAG / 하네스 / 행동 규범 / 실수 기록

- **RAG**: `rag/index.json` 에 `docs/` + `.claude/agents` + `harness/references` 인덱싱. 에이전트가 컨텍스트 빠르게 끌어올 때 `rag/search.mjs "키워드"` 사용.
- **하네스**: `harness/cases/*.json` 에 도메인 회귀 케이스(영수증 → 후보 추출 결과 기대값). `harness/run.mjs` 로 일괄 실행.
- **검증 게이트**: `harness/verify.mjs` (1차 빠른) + `harness/loop.mjs` (5회 안정성).
- **행동 규범** ([`docs/AGENT_BEHAVIOR.md`](./docs/AGENT_BEHAVIOR.md)): 냉정 판단 / 자만 금지 / 수정 불가 시 대안 제시 / 실수 영구 기록 / **hallucination 금지**.
- **실수 기록** ([`harness/runbook.md`](./harness/runbook.md)): 모든 검증·테스트 실수는 incident 양식으로 누적. 거짓 채움 = CONTRACT §9-A-3 위반.
- **Hallucination 검증** ([`rag/hallucination/`](./rag/hallucination/)): 답변 송출 전 `node rag/hallucination/verify-citations.mjs --text "..."` 로 가짜 인용(파일·조항·incident·commit·PDF 페이지) 자동 검출. hi-NNNN 사례는 [`rag/hallucination/incidents.md`](./rag/hallucination/incidents.md) 에 누적.
- **보고서 형식** ([`docs/AGENT_BEHAVIOR.md`](./docs/AGENT_BEHAVIOR.md) §4-A): 사용자에게 보내는 모든 작업 종료 보고는 5섹션 — ① 목적 ② 어떤 에이전트 사용했는지 ③ 코드작성 단위화로 잘 진행됐는지 ④ 검증/테스트 제대로 진행했는지 ⑤ 하네스로 막힌 할루시네이션 제대로 막혔는지. 자동 검증: `node harness/lib/report-lint.mjs --text "..."`.

자세한 사용법:
- [`harness/README.md`](./harness/README.md) — 도메인 회귀 운영
- [`rag/README.md`](./rag/README.md) — 인덱스 / 검색
- [`docs/design-log/`](./docs/design-log/) — 설계 의도 누적 (왜 이렇게 만들었나)

---

## 9. 하네스 4요소 — 가계부 매핑

이 프로젝트의 하네스가 **무엇을 다루는지** 한눈에 보는 매핑.
출처: [`harness/references/하네스엔지니어링-요약.md`](./harness/references/하네스엔지니어링-요약.md) §3.

| 요소 | 가계부 어디 | 핵심 규칙 |
|---|---|---|
| **Tools** (도구 관리) | `src/services/*` (transaction/budget/extraction/...), `scripts/*.mjs` | 입력·출력·부수효과는 zod 1차 검증. 도메인 상수 매직 넘버 금지 (CONTRACT §7-3). |
| **Action Loop** (액션 루프) | candidate → approve → transactions, plan→implement→verify | 검증 없이 종료 금지. AI 후보는 사람 승인 단방향. |
| **State** (상태 관리·평가) | `docs/IMPLEMENTATION_STATUS.md`, `docs/execute-plans/*` (있을 시), `analysis_cache` | Phase별 완료 기준 분명히. 평가 결과를 다음 우선순위로 연결. |
| **Memory** (메모리) | `analysis_cache`, `merchant_learning_rules`, `correction_logs`, `~/.claude/.../memory/` | 사용자별 격리. `global_learning_rules`에 PII 금지. |

**3계층 모델** (Runtime → Capabilities → Safety):

```
Safety   : audit-rls.mjs · CONTRACT.md · 에이전트 Forbidden · gitleaks
Capabil. : services/* · lib/* · learning · context (RAG)
Runtime  : lib/ollama|ai · zod 검증 · try/catch · ai-status 게이트
```

---

## 10. 5가지 원칙 (모든 에이전트 공통 점검)

작업 끝날 때 이 5가지를 자체 점검 — 출처: PDF p24.

1. **업무 분리** — 자동 진행 가능한 일과 사람 승인 필요한 일을 본인 에이전트의 `Forbidden` / `Hand-off triggers` 와 비교
2. **예측 가능** — 입력 zod 스키마 / 완료 기준 / 실패 처리 규칙이 명확한가
3. **단일 오케스트레이션** — 작업 지시·상태·로그가 한 흐름(`docs/execute-plans/` + git commit + 본 세션)에 모이는가
4. **모델 비종속** — 이번 변경이 LLM 모델·OCR 엔진 교체에도 살아남는가 (Ollama → OpenAI Vision 전환 사례 참고)
5. **인프라 지속 관리** — RAG 인덱스 / 하네스 케이스 / `.claude/agents` Scope 가 본 변경 후에도 정합한가
