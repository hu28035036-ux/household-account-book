# Design Log 00 — 전체 설계 철학

작성: 2026-05-08
대상 독자: 다음 세션의 본인 / 다른 AI 에이전트 / 협력자

이 폴더는 "**왜 이렇게 만들었는가**"의 영구 기록이다.
"어떻게 작동하는가"는 [`AGENTS.md`](../../AGENTS.md) / [`CONTRACT.md`](../../CONTRACT.md) / 각 에이전트 정의에 있다.
설계 의도가 시간이 지나 잊히면 잘못된 보강이 들어오기 쉬워서 별도로 둔다.

---

## 1. 출발점 — 1인 빌더의 제약

가계부 프로젝트의 사용자(=본인)는 **정형외과 의원 PT 본업 + 1인 창업** 구조.

세 가지 구조적 제약:

1. **모니터링 한계**: 본업 중 자동화된 작업을 매번 지켜볼 수 없다
2. **반복 업무 부담**: 가계부 외에도 ortho-rx 등 병행 — 컨텍스트 스위칭 비용 큼
3. **지식 휘발**: 다음 세션이 이번 결정의 이유를 모르면 같은 실수 반복

이 세 가지가 모든 설계의 근본 동기.
PDF [`/harness/references/하네스엔지니어링-요약.md`](../../harness/references/하네스엔지니어링-요약.md) §5 ("1인 빌더에게 왜 하네스가 중요한가") 와 동일.

---

## 2. 도메인 위험도 — 금융 + 개인정보

가계부는 **금융 + 개인정보 도메인**:

- 카드/계좌 번호, 영수증 OCR 원문, 가맹점 패턴이 한 사람의 소비 행적을 그대로 드러냄
- 신용정보의 이용 및 보호에 관한 법률 (한국) 적용 가능성
- 가족 공유(households)는 권한 분기를 잘못 만들면 다른 가족 거래 노출

이 위험도가 **collab-security 를 단독 실행 영역으로 고립**시킨 이유, **마스킹 단일 진실** 원칙, **raw_text 7일 자동 폐기** 정책의 출처.

---

## 3. 설계 4축

이 시스템 전반에 일관되게 박혀 있는 4가지 축:

### 3-1. 단방향
- 후보(candidates) → 승인 → transactions  *역방향 자동 흐름 금지*
- 영역 에이전트의 Scope/Forbidden  *경계 무단 확장 금지*
- 메타 흐름 1→7  *역행 금지 (단, 환송은 명시 분기로만)*
- 하네스 케이스  *추가만, 삭제 금지*

이유: 양방향을 허용하면 사용자 동의 없이 시스템이 결정을 바꿀 수 있는 경로가 생긴다.

### 3-2. 단일 진실 (Single Source of Truth)
- 마스킹 정규식 → `lib/security/masking.ts`
- service_role 키 → `lib/supabase/admin.ts`
- 디자인 토큰 → `tailwind.config.ts` + `globals.css`
- 마이그레이션 이력 → `supabase/migrations/`
- 사용자 메모리 → `~/.claude/.../memory/MEMORY.md`
- 검증 게이트 → `harness/verify.mjs` (1차) + `harness/loop.mjs` (5회)

이유: 같은 정보가 두 곳에 있으면 결국 한쪽이 거짓말한다.

### 3-3. 게이트 강제 (검증 없는 종료 금지)
- Sentinel — 사전 가드 (위험 작업 시작 차단)
- Verifier — 1차 사후 게이트
- loop-validator — 5회 연속 통과 강제
- Curator — 인프라 갱신 게이트

이유: PDF §22 의 4가지 안티패턴 중 가장 위험한 것이 "검증 없는 종료". 자동화는 게이트 강제로만 안전해진다.

### 3-4. 정직 기록 (실수 감추지 않기)
- `harness/runbook.md` — 검증/테스트 실수 영구 기록
- `docs/PITFALLS.md` — 과거 함정 (UI/모바일/API)
- `docs/KNOWN_RISKS.md` — 알려진 리스크
- `docs/execute-plans/<plan>.md` 결과 섹션 — 거짓 채움 금지

이유: 동일 실수의 재발 방지 + 다음 세션의 학습 자료.
**자만은 실수를 가린다 → 다음 사람이 같은 실수를 한다 → 시스템 전체가 약해진다.**

---

## 4. PDF 4요소와의 매핑

[하네스 엔지니어링 요약](../../harness/references/하네스엔지니어링-요약.md) 의 4요소 (Tools / Action Loop / State / Memory) 를 시스템에 어떻게 박았는가:

| PDF 요소 | 본 시스템에서 |
|---|---|
| **Tools** | services/ + scripts/ + harness/lib/adapters — 입출력 zod 검증, 매직넘버 금지 |
| **Action Loop** | 메타 7단계 흐름 + 각 영역 에이전트의 Action Loop 섹션 + loop-validator 5회 |
| **State** | candidate 상태 모델 + IMPLEMENTATION_STATUS + execute-plans 결과 누적 + runbook |
| **Memory** | analysis_cache, learning_rules, ~/.claude/memory, RAG 인덱스 |

---

## 5. 무엇을 의도적으로 안 만들었나 (비-목표)

설계 의도를 보존하려면 비-목표를 같이 적어야 한다.

- **AI 자동 승인 모드 없음** (CONTRACT §2-1) — 후보는 항상 사람이 본다
- **외부 분석 API 연동 없음** — 마스킹 후만, 옵트아웃 확인 후
- **결제/구독 시스템 없음** — 지인 운영 모드 (ADMIN_GUIDE.md)
- **모바일 푸시 자동 도입 없음** — [모바일 트리거 가이드](../../harness/references/모바일트리거-아키텍처.md) 단계적 검토 후
- **에이전트 간 직접 메모리 공유 없음** — 모든 흐름은 메타 흐름 번호 순서로

이 비-목표들이 무너지는 PR 은 CONTRACT 갱신 + 사용자 명시 승인이 없으면 머지 금지.

---

## 6. 이 폴더의 운영 규칙

- 추가만, 절대 삭제 금지
- 뒤집기(설계 변경)는 새 파일 `99-revised-2026-12-XX-<주제>.md` 로 — 원본 그대로 두고 갱신 이유 기록
- 각 파일 ≤ 200줄 (길어지면 분할)
- 의견·사후 회고는 별도 섹션 `## 회고` 로 분리

---

## 7. 다른 design-log 문서

- [01-meta-agents.md](./01-meta-agents.md) — conductor / orchestrator / sentinel / verifier / loop-validator / curator
- [02-area-agents.md](./02-area-agents.md) — ai-extraction / finance-core / collab-security / ux-design / qa-harness
- [03-harness.md](./03-harness.md) — run.mjs / verify.mjs / loop.mjs / 어댑터 / 케이스 형식
- [04-rag.md](./04-rag.md) — BM25-ish / 토크나이저 / 인덱싱 정책
- [05-flow.md](./05-flow.md) — 7단계 흐름의 분기 / 환송 / 한도

운영 가이드 (실수 기록, 행동 규범):
- [`/harness/runbook.md`](../../harness/runbook.md) — 검증/테스트 실수 누적
- [`/docs/AGENT_BEHAVIOR.md`](../AGENT_BEHAVIOR.md) — 냉정 판단 + 자만 금지 + 대안 제시 규범
