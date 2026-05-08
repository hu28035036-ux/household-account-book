# Design Log 02 — 영역 에이전트 5개

메타 흐름 4단계의 실제 작업자들. 파일 시스템 경계 + 변경 위험도 + 검증 무게로 잘랐다.

각 항목 형식: **분할 이유** / **경계가 어디로 그어졌는가** / **충돌 가능 영역** / **이 에이전트의 가장 위험한 실수**.

---

## ai-extraction (OCR / Vision / LLM 추출 / 학습)

**분할 이유**:
- 영수증 → 후보 단방향 파이프라인은 **하나의 일관 흐름** — 도중 분할 시 책임 분산
- 마스킹·zod·환각 검증·중복 검사는 모두 같은 트랜잭션의 단계
- 학습 규칙(`merchant_learning_rules`, `correction_logs`)은 추출과 같은 사용자 컨텍스트

**경계**:
- 가짐: `lib/{ocr,ollama,ai,learning,duplicate}` + `services/{extraction,ocr,learning,candidate}` + `api/{ocr,extraction,candidates,upload,learning}` + `components/{upload,candidates,ai-history}`
- 안 가짐: `lib/security/masking.ts` (collab-security) / `transactions` 테이블 직접 insert (단방향 위반)

**충돌 가능 영역**:
- 마스킹 정규식 변경 필요 → collab-security 위임
- 후보 페이지 UI 디자인 → ux-design
- 거래 테이블 스키마 → collab-security

**가장 위험한 실수**:
- AI 환각으로 만든 후보를 사용자 승인 없이 transactions 에 자동 insert (CONTRACT §1)
- 마스킹 안 된 OCR 원문을 외부 LLM에 전송
- `global_learning_rules` 에 PII 누출

---

## finance-core (거래 / 예산 / 가져오기)

**분할 이유**:
- 사용자가 **직접** 입력하거나 가져오는 거래의 CRUD — AI 추출과 흐름 분리
- 예산·통계·반복지출은 사용자 거래 데이터 위에서 동작 — 같은 데이터 모델 공유
- 은행/CSV 가져오기도 미리보기 → commit 흐름이라 후보(candidates) 와 비슷하지만, AI 추정 없이 매핑 휴리스틱만 사용 → 별도

**경계**:
- 가짐: `services/{transaction,budget,category,paymentMethod,recurring,import,dashboard,analytics,...}` + `lib/{budgets,import,banking,insights,formatting}` + 같은 이름 API/컴포넌트
- 안 가짐: AI 추정 후보 흐름 (ai-extraction) / RLS 정책 (collab-security)

**충돌 가능 영역**:
- 새 테이블/컬럼 → collab-security
- AI 자동 분류 로직 → ai-extraction
- UI 디자인 / 반응형 → ux-design

**가장 위험한 실수**:
- 다른 사용자/household 멤버 거래를 본인 거래처럼 수정·삭제
- 금액 단위 혼동 (원/백원/천원)
- 가져오기 결과를 미리보기 없이 자동 commit

---

## collab-security (RLS / 마스킹 / households)

**분할 이유 — 단독 실행이어야 하는 근거**:

1. **RLS 정책은 글로벌 자원** — 한 줄 약화가 모든 영역의 데이터 노출 경로 만듦
2. **마이그레이션 번호 = 글로벌 카운터** — 동시 작업 시 충돌
3. **마스킹 단일 진실** — 정규식 분산 시 사용자 데이터 새는 경로 다양해짐
4. **service_role 키는 `lib/supabase/admin.ts` 외부 노출 금지** — 다른 영역에서 임시로라도 쓰면 grep 점검 깨짐

이 4가지가 동시에 만족돼야 보안 유지 → 한 명이 책임지는 게 안전.

**경계**:
- 가짐: `lib/{security,supabase,auth,active-household,admin}` + `services/{household,admin,notification(가족 알림)}` + 모든 보안/관리/인증/개인정보 API + `supabase/migrations` + audit 스크립트
- 안 가짐: 비즈니스 로직 (다른 영역들), UI 시각 (ux-design)

**충돌 가능 영역**:
- 마이그레이션 후 비즈니스 로직 갱신 → finance-core / ai-extraction 위임
- 보안 화면 UI → ux-design

**가장 위험한 실수**:
- RLS 정책 약화 PR을 단독 머지 (CONTRACT 갱신 + 사용자 명시 승인 없이)
- service_role 키를 `lib/supabase/admin.ts` 외부에서 참조 신설
- down 마이그레이션 누락 (롤백 5분 룰 위반)
- 마스킹 정규식 분산 작성

---

## ux-design (UI / 디자인 토큰 / 반응형 / PWA)

**분할 이유**:
- 컴포넌트 시각 일관성 + 반응형 + PWA 는 **모든 영역의 데이터를 사용자 보이는 형태로 변환** — 도메인보다 표현 책임
- 디자인 토큰 분산은 시각 회귀의 가장 큰 원인 → 한 곳에서 관리
- 모바일 우선(영수증 카메라 흐름)이 1순위 사용 시나리오

**경계**:
- 가짐: 페이지 셸/UI/디자인 토큰/반응형/PWA — `app/(app)/**/page.tsx`, `components/{layout,common,upload,calendar,charts,...}`, `tailwind.config.ts`, `globals.css`, `public/`
- 안 가짐: services 시그니처 변경 (호출만), 새 npm 의존성 추가 (사용자 승인)

**충돌 가능 영역**:
- 데이터 모양 변경 → finance-core / ai-extraction
- 권한별 UI 분기 (admin / 멤버) → collab-security
- 시각 회귀 스냅샷 갱신 → qa-harness

**가장 위험한 실수**:
- services 호출 시 인자 변형 (비즈니스 로직 침범)
- `dangerouslySetInnerHTML` sanitize-html 없이 사용
- 모바일 input 16px 이하 (iOS 자동 zoom 유발) — 과거 함정 (commit `9376907`)
- 디자인 토큰 우회 인라인 스타일

---

## qa-harness (검증 인프라 운영, read-only)

**분할 이유**:
- 도메인 회귀 케이스·E2E·smoke·시각 스냅샷·RAG는 모두 **검증 인프라** — 작성/유지가 별도 책임
- read-only 원칙으로 다른 모든 영역과 병행 가능 → 1인 빌더 시나리오에서 시간 효율
- 결함 발견 시 **본인이 안 고친다** — 검증자가 수정자도 되면 confirmation bias

**경계**:
- 가짐: `src/tests`, `e2e/`, `scripts/{run-smoke,test-*,audit-rls,...}`, `harness/`, `rag/`, `playwright.config.ts`, `vitest.config.ts`
- 안 가짐: 비즈니스 로직 (`src/lib`, `src/services`, `src/app/api`, `src/components`), 마이그레이션

**충돌 가능 영역**:
- 결함 발견 → 해당 영역 에이전트로 패치 위임 (qa-harness 가 직접 수정 금지)

**가장 위험한 실수**:
- 결함 발견 후 직접 코드 수정 (read-only 위반 → confirmation bias)
- 시각 스냅샷 무단 업데이트 (`--update-snapshots`)
- 회귀 케이스 임의 삭제 (사용자 승인 없이)
- 실패 케이스를 의도 없이 `.skip` 처리

---

## 분할 안 된 영역 (의도적)

다음은 별도 에이전트로 만들지 않은 이유:

- **데이터 분석/BI**: 현재는 finance-core 의 analytics 에 흡수. 분리 시점은 BI가 별도 도구(외부 dashboard 등)로 빠질 때.
- **외부 API 연동(은행)**: finance-core 의 banking 에 흡수. 외부 API 가 5개 이상으로 늘면 분리 후보.
- **결제/구독**: 비-목표 (CONTRACT §6 — 지인 운영 모드)
- **i18n**: 현재 한국어 단일. 다국어 도입 시점에 ux-design 안에서 다룰지, 별도 에이전트로 뺄지 재검토.

분리 트리거: 한 영역 안에 **다른 위험도** 의 작업이 같이 있을 때.

---

## 회고용 메모

- 5개 영역 분할은 현재 가계부 규모(services 21개 / api 70개 / components 25개)에 적정
- 100명 사용자 / 1000명 사용자 전환점에서 collab-security 가 인프라 영역(scaling, 캐시, 모니터링)으로 더 분리될 가능성
- ux-design 이 컴포넌트 라이브러리화 되면 **디자인 시스템 에이전트** 별도 분리 검토
