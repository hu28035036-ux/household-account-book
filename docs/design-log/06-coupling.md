# Design Log 06 — 결합점과 단위화 이력

작성: 2026-05-08
사유: 사용자 우려 — *"한 곳을 고치면 다른 게 깨질 것 같은 느낌"*

이 문서는 **현재 시스템의 결합점(fragility)** 과 *단위화 작업의 이력* 을 영구 기록한다.
같은 결합점이 두 번 이상 깨지면 같은 incident 가 반복된다 — 그래서 보존.

---

## 1. 결합점 카탈로그

### 1-1. 수동 등록 패턴 (가장 잊기 쉬운)

| ID | 결합점 | 증상 |
|---|---|---|
| C-01 | `harness/test/self-test.mjs` 의 `groups` 배열 ↔ `cases/*.mjs` | 새 케이스 파일 추가 시 import + groups push 동시 필요 |
| C-02 | `rag/lib/walk.mjs` INCLUDE 정규식 ↔ 새 .md 폴더 | 새 폴더 만들 때 인덱싱 패턴 추가 잊음 |

**증거**: 본 시스템 구축 중 C-02 가 4번 발생 — `harness/`, `harness/references/`, `harness/test/`, `rag/hallucination/` 추가 시 매번 walk.mjs 갱신 필요.

### 1-2. 지식 이중화 (두 곳에 같은 정보)

| ID | 결합점 | 증상 |
|---|---|---|
| C-03 | `anti-pattern-grep.mjs` 의 `RULES` ↔ self-test 의 `FIXTURE_RULES_*` | 룰 추가 시 두 곳 동시 갱신. 누락 시 self-test 의미 없음 |
| C-04 | `extractors.mjs` 정규식 ↔ `checkers.mjs` 검증기 ↔ `patterns.json` 카탈로그 | 새 인용 종류 추가 시 3곳 동시 갱신 |
| C-05 | `lib/security/masking.ts` ↔ `harness/lib/adapters/masking.mjs` | masking 로직이 src 와 harness 양쪽에 존재 (의도적 mirror) |

**증거**: incident-0001 (masking adapter 정규식 순서) — src 와 harness 의 mirror 가 어긋난 사례.

### 1-3. 암묵적 계약 (인터페이스 무명시)

| ID | 결합점 | 증상 |
|---|---|---|
| C-06 | `runner.mjs` adapter 시그니처 (`run(case, opts) → result`) | 5개 어댑터가 암묵적 계약 — schema 무명시 |
| C-07 | case JSON 형식이 도메인마다 다름 (`extraction.input.text` vs `extraction-hallucination.input.ocr_text+candidate`) | 새 케이스 만들 때 기존 케이스 참조해서 추측 |
| C-08 | `compare.mjs` walk 함수의 **분기 순서** | path-based 룰의 위치가 의미 결정 (incident-0004 가 직접 사례) |

### 1-4. 분산된 stage 정의

| ID | 결합점 | 증상 |
|---|---|---|
| C-09 | verify.mjs / loop.mjs / verify-citations 의 stage 가 3곳 분산 | stage 추가 시 일관성 깨질 수 있음 |

### 1-5. 문서 간 cross-reference

| ID | 결합점 | 증상 |
|---|---|---|
| C-10 | CONTRACT §X ↔ AGENTS ↔ AGENT_BEHAVIOR ↔ design-log 의 §번호 인용 | 한 문서 §번호 변경 시 다른 문서 인용 깨짐 |

**완화**: verify-citations 가 사후 검출. 단 이미 변경된 후라 fix forward.

### 1-6. 단위화로 새로 생긴 결합 (정직 기록)

| ID | 결합점 | 증상 |
|---|---|---|
| C-11 | PROTECTED_PATHS — CONTRACT §9-B-1 (사람용) ↔ meta-isolation.mjs (코드) | 보호 경로 추가 시 두 곳 동시 갱신 — 누락 시 게이트 의미 없음 |
| C-12 | runner.mjs dispatch 정책 (folder vs id-prefix) | 작성자가 어느 게 진실인지 추측. 주석 부족. |
| C-13 | self-test export 명명 컨벤션 (regex) | discover.mjs 정규식에만 박혀 있음. 컨벤션 위반 시 silent fail |
| C-14 | meta-isolation 게이트가 영역 작업도 차단 | qa-harness/* 같은 영역 브랜치에서 e2e 변경 시 게이트 fail — 정상 영역 작업이 막힘 |

**의도**: 이 표는 "단위화가 *완벽*이 아니다" 를 정직 기록. 단위화 자체가 새 결합점을 만들 수 있음 — CONTRACT §9-A-1 (추상화 과잉 회피) 와 긴장. 모든 신규 결합은 즉시 §3 이력에 해소 작업이 따라야 한다.

---

## 2. 단위화 우선순위

| 우선 | ID | 작업 | 비용 | 위험 |
|---|---|---|---|---|
| 🔴 1 | C-01 | self-test cases 자동 디스커버리 | 30분 | 낮음 |
| 🔴 2 | C-02 | walk.mjs 컨벤션 기반 INCLUDE | 30분 | 낮음 |
| 🟡 3 | C-03 | anti-pattern RULES 단일 진실 (production import) | 1시간 | 중간 |
| 🟡 4 | C-07 | case JSON schema 명시 (도메인별) | 1시간 | 낮음 |
| 🟡 5 | C-04 | citation kind 단일 정의 (extractors+checkers+patterns 통합) | 1.5시간 | 중간 |
| 🟢 6 | C-05 | masking adapter 자동 미러 점검 (CI step) | 30분 | 낮음 |
| 🟢 7 | C-09 | verify/loop stage 공통 모듈 | 1.5시간 | 중간 |
| ⚪ 8 | C-08 | compare.mjs 분기 등록 가능 룰 | 2시간 | 높음 |
| ⚪ 9 | C-06 | adapter 시그니처 zod schema | 2시간 | 중간 |

🔴 즉시 가치 / 🟡 중기 / 🟢 운영 / ⚪ 큰 구조 변경

---

## 3. 단위화 작업 이력

새 단위화 진행 시 본 섹션에 기록.

### 3-1. C-01 — self-test cases 자동 디스커버리 (2026-05-08)
- 목적: 새 케이스 파일 추가 시 self-test.mjs 수정 불필요
- 변경: self-test.mjs 가 `harness/test/cases/` 폴더 walk → 동적 import → 함수 자동 호출
- 케이스 파일 컨벤션: `cases/<name>.mjs` 가 `runXCases()` export
- 회귀 방지: self-test 자체가 자동 디스커버리 동작 케이스 1개 추가
- 결과: groups 배열 제거. 새 케이스 추가 = 파일 생성만.

### 3-2. C-02 — walk.mjs 컨벤션 기반 INCLUDE (2026-05-08)
- 목적: 새 .md 폴더 추가 시 INCLUDE 갱신 불필요
- 변경: 명시 *제외* 폴더 (node_modules, .next, dist, build, test-results, .git) 외 모든 .md 자동 인덱싱
- 보존: 인덱싱 대상이 너무 많아지면 명시 제외 추가
- 결과: 4번 잊었던 패턴 추가 누락 위험 제거.

### 3-3. C-05 — masking adapter mirror policy 강화 (2026-05-08)
- 목적: src/lib/security/masking.ts 변경 시 adapter 동기화 누락 자동 감지
- 변경: adapter 헤더에 `MIRROR_DATE` / `MIRROR_SOURCE` 마커 명시 + self-test (`harness/test/cases/masking-mirror.mjs`) 가 마커 존재 + src mtime > MIRROR_DATE 검사
- 결과: 동기화 누락 시 self-test 가 사후 경고 (차단은 아님 — 운영 신호)

### 3-4. C-07 + C-06 — case JSON schema + adapter 시그니처 schema (2026-05-08)
- 목적: 새 case 만들 때 도메인별 schema 추측 제거, 어댑터 input/output 변경 시 사일런트 깨짐 방지
- 변경:
  - `harness/lib/schema.mjs` — 외부 의존성 0 의 lightweight validator
  - 모든 adapter 가 `inputSchema` / `expectedSchema` export
  - runner 가 case 로딩 시 input 검증, adapter 실행 후 output 검증 — 미스매치는 'error' 상태
- self-test: `harness/test/cases/schema.mjs` — 12 케이스 (validator 자체 회귀)
- 결과: case 작성 시 schema 가이드, adapter 변경 시 즉시 알림

### 3-5. C-03 — anti-pattern RULES 단일 진실 (2026-05-08)
- 목적: production RULES vs self-test FIXTURE_RULES 이중 정의 제거
- 변경: self-test 의 `anti-pattern.mjs` 가 `RULES.find(r => r.label.includes(...))` 로 base 룰을 가져온 뒤 path/excludes 만 fixture 용으로 override
- 결과: production 패턴 변경 시 self-test 가 자동으로 같은 패턴 사용 — drift 불가능

### 3-6. C-04 — citation kind 단일 정의 + 자동 디스커버리 (2026-05-08)
- 목적: extractors/checkers/patterns 의 분산 정의를 하나의 kind 모듈로
- 변경:
  - `rag/hallucination/lib/kinds/{file,section,incident,commit,pdf-page}.mjs` — 각 모듈이 `extract()` + `check()` 둘 다 export
  - `extractors.mjs` / `checkers.mjs` 가 `kinds/*.mjs` 자동 디스커버리 (캐시 1회)
- 부산물: `extractCitations()` 가 async 가 됨 → 모든 호출처 await 처리
- 결과: 새 citation kind 추가 = `kinds/<name>.mjs` 1 파일. extractors/checkers 변경 0.

### 3-7. C-09 — verify / loop stage 공통 모듈 (2026-05-08)
- 목적: verify.mjs 와 loop.mjs 의 stage 정의 분산 통합
- 변경:
  - `harness/lib/stages.mjs` — STAGES 객체 (selfTest / typecheck / vitest / harnessMock / eslint / antiPatternGrep / smokeAll / auditRls / responsive / verifyCitations)
  - verify.mjs 와 loop.mjs 가 STAGES 를 import. label/cmd/args 중복 제거.
- 결과: stage 추가/변경 = stages.mjs 1곳. 두 진입점 자동 동기화.

### 3-9. C-11 — PROTECTED_PATHS 단일 진실 (2026-05-08)
- 목적: 메타 격리 게이트가 만들어진 직후 등장한 새 이중 정의 즉시 해소
- 변경: `harness/lib/protected-paths.mjs` 신설 — `PROTECTED_PATHS` + `AUTO_GENERATED` export. meta-isolation.mjs 가 import. CONTRACT §9-B-1 가 *코드 단일 진실은 이 파일* 이라 명시.
- 결과: 보호 경로 추가 = lib 1곳 수정. CONTRACT 표는 사람용 미러 (drift 시 verify-citations 가 사후 검출).

### 3-10. C-12 — runner dispatch 정책 명시 + 회귀 (2026-05-08)
- 목적: 폴더 vs id-prefix 정책 모호함 제거
- 변경: runner.mjs 의 runCase 상단 주석에 정책 문서화 (PRIMARY = 폴더 / FALLBACK = id-prefix). harness/test/cases/runner.mjs 에 *컴파운드 도메인 dispatch* 회귀 케이스 추가 — `extraction-hallucination` 폴더의 케이스가 extraction 어댑터로 잘못 가지 않음을 매 self-test마다 입증.
- 결과: 새 컴파운드 도메인 추가 시 정책 의심 0.

### 3-12. C-14 (신규) — meta-isolation 게이트의 영역 작업 차단 해소 (2026-05-08)
- 발견 시점: PR #3 작업 중 — qa-harness/* 브랜치에서 e2e/assistant.spec.ts 변경 시 메타 격리 게이트가 fail
- 결합점 본질: 게이트가 *모든* self-test 실행에서 strict 였음. 영역 작업도 차단됨.
- 단위화: 브랜치 prefix 기반 자동 모드 전환
  - `meta/*` 또는 prefix 없음 → strict (변경 시 fail)
  - `<area>/*` (5개 영역 prefix) → informational (변경 보고만, 통과)
- 코드: `meta-isolation.mjs` 의 `gitCurrentBranch()` + `isAreaBranch()` + `AREA_PREFIXES` 추가
- 명시: CONTRACT §9-B-4 *브랜치 컨벤션* 단락
- 결과: 영역 에이전트가 본 시스템 게이트 우회용 환경변수 없이도 작업 가능 + 메타 작업 격리 보장 유지

이건 *단위화 작업* 이라기보다 *원칙(§9-B 격리)의 정밀화* — 실용적으로 결합점 카탈로그에 C-14 로 등록.

### 3-11. C-13 — self-test 컨벤션 명시 + 회귀 (2026-05-08)
- 목적: `runXxxCases` 명명 컨벤션이 정규식에만 박혀있어 컨벤션 위반 시 silent fail
- 변경: `discover.mjs` 의 `CASE_EXPORT_PATTERN` 을 export. 헤더 주석에 컨벤션 명시. discovery.mjs 회귀 케이스 2건 추가 — (a) 정규식이 정상 이름 수락 + 변형 거부, (b) 그룹 라벨이 *파일명* 임을 입증 (export 이름이 라벨로 새지 않음).
- 결과: 컨벤션 위반 시 self-test 가 즉시 노출.

### 3-8. C-08 — compare.mjs 분기 priority 룰 (2026-05-08)
- 목적: walk 함수 내부 분기 순서 의존성 (incident-0004 의 직접 사례) 제거
- 변경: primitive 비교를 `{ name, priority, match, apply }` 룰 배열로. 모듈 로드 시 priority 내림차순 정렬, 매칭 첫 룰 적용.
  - confidence_min (priority 100) > merchant (80) > number (50) > strict-eq (0)
- 결과: 새 path-keyed 의미 추가 = 룰 객체 1개 push. 분기 순서 사람 판단 불필요.

---

## 4. 운영 원칙

- 새 결합점 발견 시 §1 카탈로그에 ID 부여 후 추가
- 단위화 시 §3 에 결과 기록 (변경/회귀 방지/결과)
- 단위화로 결합점이 *더 늘어나면* 그것도 정직 기록 — 좋은 의도가 새 결합점을 만들 수 있음

---

## 5. 비-목표

- 모든 결합 제거 — 일부 결합은 의도적 (예: C-05 masking mirror 는 *src 가 진실, harness 는 회귀용 미러* 라는 명시 의도)
- 추상화 레이어 추가 — CONTRACT §9-A-1 *"추상적 코드 작성 줄이기"* 위반 회피
- 100% 자동화 — 자동 디스커버리가 모든 곳에 옳지는 않음 (예: AGENTS.md 의 §우선순위 표는 손으로 정렬)
