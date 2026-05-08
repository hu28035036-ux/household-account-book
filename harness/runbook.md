# Harness Runbook — 검증/테스트 실수 영구 기록

이 문서는 **하네스 / Verifier / loop-validator / 도메인 회귀 / RAG 검증 시도에서 발생한 모든 실수의 영구 기록**이다.

운영 책임: `qa-harness` (운영) + `curator` (기록 갱신).

---

## 0. 왜 이 문서가 존재하는가

PDF [하네스 엔지니어링 요약](./references/하네스엔지니어링-요약.md) §8 — 에이전트 사용 시 피해야 할 4가지 패턴 중:

> **3. 검증 없는 종료 막기** — 하네스가 검증 절차를 강제

검증이 강제되어도, 검증 자체가 잘못 만들어지면 의미 없다.
**같은 검증 실수를 두 번 이상 하지 않으려면 영구 기록이 필요**.

또한 사용자 명시 행동 규범([`AGENT_BEHAVIOR.md`](../docs/AGENT_BEHAVIOR.md)):
- 자만하지 않고 냉정 판단
- 수정 불가 판단 시 대안 제시

이 규범을 **사후 검증 가능한 형태**로 만들기 위해 모든 검증 실수가 여기 누적된다.

---

## 1. 기록 형식

각 항목은 다음 양식을 그대로 채운다. **거짓 채움 금지** (CONTRACT §9-A-3 위반).

```markdown
### incident-NNNN — <한 줄 제목>
- 발생 시점: YYYY-MM-DD HH:MM (대략)
- 단계: harness/run | verify | loop round N | rag build | rag search | sentinel | other
- 사용자 영향: yes/no/unknown
- 발견자: 본인 / 사용자 지적 / CI / 기타

**무엇이 일어났나** (객관 사실)
- ...

**왜 일어났나** (원인 분석)
- ...

**시도한 수정과 결과**
1. ... → 통과/실패
2. ...

**최종 해결**
- ... 또는 *해결 못 함 → 대안: ...*

**재발 방지**
- 추가한 회귀 케이스: ...
- 갱신한 룰/문서: ...
- 모니터링 지표: ...
```

### 기록 의무
- 검증이 처음에 실패한 경우 — **수정해서 통과해도** 기록 (자만 방지)
- 같은 회차/단계에서 두 번 이상 실패한 경우
- 흐름 위반 신호 ([05-flow.md §6](../docs/design-log/05-flow.md)) 발견
- 가짜 양성 / 가짜 음성 발견
- 환경 의존(Windows/Mac, dev 서버 다운 등) 으로 검증 모호한 경우

### 기록 금지
- 사용자가 명시 인정한 known-flaky 케이스 (`.skip` 처리한 것)
- 디버그 중 만든 임시 실패 (PR로 들어가지 않은 것)

---

## 2. 시드 항목 — 본 시스템 구축 중 발생한 실수

### incident-0001 — masking adapter 정규식 순서 오류
- 발생 시점: 2026-05-08 (메타 흐름 / 하네스 초기 구축 세션)
- 단계: harness/run (domain: masking)
- 사용자 영향: no (본 시스템 구축 중, src 코드 영향 없음)
- 발견자: 본인 (실행 결과 자체 점검 중)

**무엇이 일어났나**
- `harness/lib/adapters/masking.mjs` 의 PATTERNS 배열이 다음 순서:
  1. 카드번호 (4-4-4-4)
  2. 계좌번호 generic (8–14자리)
  3. 주민등록번호
  4. 전화번호
  5. 사업자등록번호
- masking-001 케이스 (`010-1234-5678` 전화번호) 가 generic 계좌 패턴에 먼저 매칭되어 `*********5678` 로 마스킹됨
- 기대값은 `***-****-5678` (전화번호 마스킹 형식)
- masking-002 케이스 (주민등록번호) 도 같은 이유로 실패

**왜 일어났나**
- 정규식 우선순위 설계 시 specific → general 순서 원칙 미준수
- generic 계좌번호 패턴이 너무 wide 했음 (`\d{2,6}-?\d{2,6}-?\d{2,6}`)
- masking 의 진실은 `src/lib/security/masking.ts` 인데, 어댑터는 별도로 정규식을 가지고 있어 두 곳에서 다르게 작동할 수 있는 구조

**시도한 수정과 결과**
1. PATTERNS 순서를 카드 → 주민 → 사업자 → 전화 로 재정렬, generic 계좌 패턴 제거 → 통과
   - 근거: 계좌번호는 컨텍스트(은행명/레이블) 와 함께 처리해야 안전. wide 패턴이 다른 PII 를 가로채는 위험이 더 큼.

**최종 해결**
- masking adapter 의 PATTERNS 재정렬 + generic 계좌 패턴 제거
- 어댑터 파일 상단에 *"Mirrored from src/lib/security/masking.ts as of 2026-05-08"* 명시
- masking-001, masking-002 통과 확인

**재발 방지**
- 추가한 회귀 케이스: masking-001 (전화번호), masking-002 (주민/사업자) — 정규식 순서 회귀 즉시 잡힘
- 갱신한 룰/문서: harness/lib/adapters/masking.mjs 상단 주석에 미러 정책 명시
- 모니터링 지표: `src/lib/security/masking.ts` 변경 시 어댑터 동기화 누락 위험 — 수동 점검 (자동화 후보)

### incident-0002 — anti-pattern-grep.mjs 의 destructuring 버그
- 발생 시점: 2026-05-08 (loop-validator round 3 첫 시험 실행 중)
- 단계: loop round 3 (eslint + §9-A grep)
- 사용자 영향: no
- 발견자: 본인 (round 3 실행 결과 자체 확인 중)

**무엇이 일어났나**
- ripgrep 폴백 코드 작성 시 다음 코드 사용:
  ```js
  const { glob } = await import('node:fs/promises')
    .then(() => import('node:fs'))
    .then(() => null)
    .catch(() => ({ glob: null }));
  ```
- `.then(() => null)` 의 결과가 `null` → null 에서 destructuring 시도 → TypeError
- round 3 실패 → loop.mjs 가 카운터 리셋 메시지 출력

**왜 일어났나**
- 의도: ripgrep 없을 때 Node 내장 readdir 만으로 파일 walk
- 잘못된 구현: import chain 을 잘못 작성. `glob` 함수는 실제로 사용하지 않는데 destructuring 만 해놓음
- 사실상 *불필요한 코드를 작성하면서 그 안에 버그를 만든 케이스* — PDF 4패턴 §1 *"추상적 코드 작성 줄이기"* 위반

**시도한 수정과 결과**
1. destructuring 자체 제거. readdir 만 import 해서 walk 함수 직접 작성 → 통과

**최종 해결**
- jsScan 함수에서 의도하지 않은 destructuring 제거
- readdir + 단순 재귀 walk 로 단순화
- round 3 통과 확인

**재발 방지**
- 갱신한 룰/문서: 본 runbook 항목 추가 (자만 방지)
- 모니터링 지표: anti-pattern-grep.mjs 자체에 대한 회귀 케이스는 *없음* — 도구 자체의 회귀는 다음 사용 시점에서 잡힘
- **개선 후보**: harness 도구들 자체에 대한 self-test 추가 (예: `harness/test/self-test.mjs`)

### incident-0002-followup — harness 도구 self-test 안전망 도입
- 발생 시점: 2026-05-08 (incident-0002 의 재발 방지 후속 조치)
- 단계: 인프라 보강
- 사용자 영향: no
- 발견자: 본인 (incident-0002 의 *"개선 후보"* 메모를 진행)

**무엇을 했나**
- `harness/test/self-test.mjs` + `harness/test/cases/*` + `harness/test/fixtures/anti-pattern/` 신설
- 5개 그룹 26 케이스: compare / runner / masking adapter / anti-pattern-grep / rag tokenize
- `harness/lib/anti-pattern-grep.mjs` 를 `RULES`/`runScan`/`isExcluded`/`jsScan` export + main guard 형태로 리팩터해 테스트 가능하게
- `harness/verify.mjs` 첫 stage 로 self-test 추가 — 도구 자체가 깨지면 다른 검증을 신뢰 못 함
- `harness/loop.mjs` round 1 첫 step 으로 self-test 추가 — 5회 게이트도 도구 회귀 즉시 차단

**왜 이렇게 설계했나**
- self-test 가 verify/loop 의 **첫** stage — 깨진 도구가 다른 stage 의 통과/실패 판정을 오염시키는 것을 차단
- fixture 는 `.fixture` 확장자 — vitest / TypeScript / ESLint 가 잡지 않게
- 도구 자체 변경 시 self-test 회귀 케이스가 즉시 깨져 보임 (PDF 4요소 *Tools — 입출력 예측 가능*)

### incident-0003 — anti-pattern-grep allowList Windows 경로 미스매치
- 발생 시점: 2026-05-08 (incident-0002 수정 직후)
- 단계: loop round 3
- 사용자 영향: no
- 발견자: 본인

**무엇이 일어났나**
- excludePath 가 unix 경로 형태(`src/lib/supabase/admin`) 로 작성됨
- Windows 환경에서 fallback walk 가 백슬래시 경로 출력(`src\lib\supabase\admin\admin.ts`)
- 정당한 service_role 키 사용 (admin.ts 자체) 이 false positive 로 잡힘
- layout.tsx 의 themeInitScript 도 정당한 dangerouslySetInnerHTML 사용 — 룰에 allowList 없어 false positive

**왜 일어났나**
- Windows 경로 정규화 미고려
- 룰 설계 시 정당한 사용 케이스 명시 화이트리스트 부재

**시도한 수정과 결과**
1. `normalizeSlashes()` + `excludePaths`(배열) + `allowList` 도입 → 통과
   - excludePaths: 정규 경로 매치 시 제외 (admin.ts 자체)
   - allowList: 정당한 사용 명시 (layout.tsx 의 theme init)

**최종 해결**
- 룰 객체에 `excludePaths: string[]` + `allowList: string[]` 추가
- `isExcluded()` 함수가 슬래시 정규화 후 두 목록 검사

**재발 방지**
- 새 allowList 추가 시 사용자 승인 필수 명시
- 룰 추가/변경은 가능한 한 narrow 하게 — wide 룰이 false positive 을 키운다

---

### incident-0004 — compare.mjs 의 confidence_min 분기 순서 버그
- 발생 시점: 2026-05-08 (self-test 첫 실행, incident-0002-followup 작업 중)
- 단계: harness self-test (compare.mjs 케이스)
- 사용자 영향: no (가계부 src 영향 없음 — 도메인 회귀 케이스가 우연히 confidence_min 검증을 거치지 않은 입력만 사용했음)
- 발견자: 본인 (self-test 추가 후 첫 실행에서 즉시 감지)

**무엇이 일어났나**
- `harness/lib/compare.mjs` 의 `walk()` 함수에서 분기 순서가:
  1. 숫자 비교 (amount_pct 적용)
  2. confidence_min 처리
- expected 가 `{ confidence_min: 0.7 }` 이고 actual 이 `{ confidence_min: 0.85 }` 일 때, `confidence_min` 키의 값이 숫자라 **숫자 비교 분기에 먼저 잡힘** → amount_pct=0 으로 0.7 ≠ 0.85 fail
- 결과: confidence_min 의 `>=` 의미 (실제로 통과해야 할 케이스) 가 항상 fail. 실패해야 할 케이스도 다른 메시지로 fail.

**왜 일어났나**
- 분기 설계 시 *특수 의미 키(`confidence_min`)는 일반 숫자 처리 전에* 라는 원칙 미준수
- 도메인 회귀 케이스(`extraction-001.json`) 는 `confidence_min: 0.6` 으로 actual `0.85` 같은 형태였지만, mock 모드가 expected 를 그대로 echo 해서 같은 숫자 → 우연히 통과
- self-test 가 *명시적으로* confidence_min 검증을 하니 즉시 노출

**시도한 수정과 결과**
1. `walk()` 안에서 `path.endsWith('confidence_min')` 분기를 숫자 분기 **앞으로** 이동 → self-test 통과

**최종 해결**
- compare.mjs 의 분기 재정렬 + 주석에 incident-0004 참조
- self-test 26/26 통과 확인

**재발 방지**
- 추가한 회귀 케이스: `harness/test/cases/compare.mjs` 의 confidence_min 통과/실패 케이스 2건
- 갱신한 룰/문서: compare.mjs 의 inline 주석에 incident-0004 명시 — 향후 분기 순서 변경 시 경고

### incident-0005 — anti-pattern-grep 의 ripgrep .gitignore 가 fixture 무시
- 발생 시점: 2026-05-08 (self-test anti-pattern 케이스 첫 실행)
- 단계: harness self-test (anti-pattern-grep 케이스)
- 사용자 영향: no
- 발견자: 본인

**무엇이 일어났나**
- self-test 가 `runScan({ root: FIXTURE_ROOT, rules: ... })` 호출
- ripgrep 이 PATH 에 있어 `rg` 분기로 진입 → fixture 디렉토리는 `.gitignore` 또는 `.fixture` 확장자 처리 정책으로 무시됨
- jsScan 폴백 미진입 → fixture 매치 0 → "silent-fallback fixture is flagged" 케이스 fail

**왜 일어났나**
- `runScan` 의 ripgrep/jsScan 선택이 *환경 의존적* — 같은 코드가 환경에 따라 다른 결과
- fixture 가 .gitignore 영향을 받는지 확인하지 않은 채 ripgrep 사용

**시도한 수정과 결과**
1. `runScan` 에 `forceJsScan` 옵션 추가 → self-test 가 명시적으로 jsScan 사용 → 통과

**최종 해결**
- `runScan({ ..., forceJsScan: true })` 옵션
- self-test 의 모든 anti-pattern 케이스가 forceJsScan 사용
- production CLI 동작은 변경 없음 (rg 우선)

**재발 방지**
- self-test 케이스 — fixture 가 ripgrep 정책에 의해 무시되는 시나리오 즉시 잡힘
- 도구 옵션 주석에 incident-0005 명시

### incident-0013 — 단위화 3차: 자체 결합점(C-11/12/13) 즉시 해소
- 발생 시점: 2026-05-08
- 단계: 인프라 단위화 (자체 점검 후 보강)
- 사용자 영향: no
- 발견자: 사용자 명시 명령 — *"단위화 수정진행해"*

**무엇을 했나**
- 직전 단위화 작업이 만든 새 결합점 3개 자가 진단 후 즉시 해소.
- C-11: `harness/lib/protected-paths.mjs` 신설. CONTRACT §9-B-1 표는 사람용 미러로 강등. meta-isolation.mjs 가 lib 을 import.
- C-12: runner.mjs runCase 상단에 dispatch 정책 주석 (PRIMARY=폴더 / FALLBACK=id-prefix). runner self-test 에 *compound-domain dispatch* 회귀 케이스 추가.
- C-13: discover.mjs 의 `CASE_EXPORT_PATTERN` export + 헤더 컨벤션 주석. discovery self-test 에 정규식 양·음성 테스트 + 라벨-파일명 일치 테스트 추가.

**자기 점검 시 발견한 부산물**
- 새 회귀 케이스 *"group label uses filename"* 의 첫 정규식이 너무 wide (`/^run/`) — 파일 `runner.mjs` 의 정상 라벨(`runner`) 도 잡힘 → narrow (`CASE_EXPORT_PATTERN` 직접 사용) 후 통과
- 자기 점검 케이스가 *자기 자신을 잡은 사례* — 회귀 케이스 작성 시 정규식 너무 wide 하면 false positive 라는 일반적 함정의 직접 사례

**검증**
- self-test: 71 → **74 통과** (compound dispatch 1 + 컨벤션 정규식 1 + 라벨-파일명 1 추가)
- harness/run.mjs --mock: 8/8 통과
- harness/verify.mjs: self-test ✅ + verify-citations ✅
- 06-coupling.md §1-6 추가 (단위화로 새로 생긴 결합점 정직 기록) + §3-9~3-11 이력

**남은 결합점**
- C-10 (문서 cross-reference) — 의도적 유지

**재발 방지**
- 06-coupling.md §1-6 + §3 누적 — 단위화가 새 결합 만들 수 있음 명시
- 자기 점검 회귀 케이스 작성 시 정규식 narrow 원칙 (이번 fail 사례가 산 증거)

### incident-0012 — 메타 작업 격리 원칙 영구화 (CONTRACT §9-B)
- 발생 시점: 2026-05-08
- 단계: 안전 원칙 명시
- 사용자 영향: no
- 발견자: 사용자 명시 명령 — *"절대 현재 기능에서 기능 이상이 발생하면 안 된다"*

**검증 결과 (사실 그대로)**
- `git diff --stat HEAD -- src/` 비어있음 — 본 시스템 구축 전 상태와 동일
- `git diff --stat HEAD -- e2e/` 비어있음
- `git diff --stat HEAD -- supabase/ public/ samples/ scripts/ package.json next.config.mjs vercel.json tsconfig.json tailwind.config.ts postcss.config.js playwright.config.ts vitest.config.ts next-env.d.ts` 모두 비어있음
- 본 시스템 구축으로 가계부 src 영역 변경 0
- npm run typecheck 결과 2건 에러: `e2e/assistant.spec.ts` 의 implicit any — **본 작업 이전부터 존재한 기존 에러** (commit `c7b7cc0` 시점 — 우리 작업 전), 우리가 도입한 회귀 아님

**무엇을 했나**
- CONTRACT.md §9-B 신설 — 메타 작업 격리 원칙 5개 조항 (영역 정의 / 허용 영역 / 검증 의무 / 본 영역 변경 절차 / 위반 시 절차)
- `.claude/agents/sentinel.md` 위험 신호 카탈로그에 "메타 격리 위반" 추가
- `harness/test/cases/meta-isolation.mjs` 신설 — git diff --stat 으로 본 영역 변경 자동 검출 (2 케이스)
- 결과: self-test 가 메타 작업 후 본 기능 영역 변경 즉시 차단

**왜 이 형태**
- 사용자 명령은 *원칙 선언* — 한 번 위반하면 신뢰 회복 어려움
- 자동 게이트만이 사람 실수 막음. 문서로만 적으면 잊혀진다.
- Sentinel = 사전 게이트, self-test/meta-isolation = 사후 게이트. 양면 방어.

**알려진 한계**
- `tsconfig.tsbuildinfo` 는 자동 재생성 파일이라 게이트 검사에서 의도적 제외 (필터 명시)
- 본 게이트는 git 환경 의존 — git 없으면 skip (자동 false negative). 가계부는 git 저장소이므로 실용적
- 영역 에이전트가 src 변경하는 것은 정상 — 이 게이트는 *메타 작업* 한정 (메타 흐름 1·2·3·5·6·7 단계). 영역 작업(4단계) 은 다른 검증 흐름

**재발 방지**
- meta-isolation 케이스 2건 — verify.mjs / loop.mjs round 1 에서 즉시 차단
- CONTRACT §9-B 가 영역 에이전트의 Forbidden 과 명시 매핑

### incident-0011 — 단위화 2차: 결합점 7개 모두 해소
- 발생 시점: 2026-05-08
- 단계: 인프라 단위화 (전체)
- 사용자 영향: no
- 발견자: 사용자 명시 명령 — *"전체적인 단위화를 진행해줘"*

**무엇을 했나 — 결합점 C-03~C-09 모두 해소**

- C-05 — masking adapter mirror policy 강화 (`MIRROR_DATE` 마커 + self-test)
- C-07 + C-06 — `harness/lib/schema.mjs` lightweight validator + 모든 adapter 의 `inputSchema`/`expectedSchema` + runner 검증
- C-03 — anti-pattern RULES 단일 진실 (self-test 가 production `RULES.find()` 로 가져옴)
- C-04 — citation kind 5개를 `rag/hallucination/lib/kinds/*.mjs` 로 분리 + 자동 디스커버리
- C-09 — `harness/lib/stages.mjs` STAGES 객체로 verify/loop 통합
- C-08 — compare.mjs 의 분기를 `{ priority, match, apply }` 룰 배열로

**검증**
- self-test: 54 → **69 통과** (schema 12 + masking-mirror 3 추가)
- harness/run.mjs --mock: 8/8 통과
- harness/verify.mjs: self-test ✅ + verify-citations ✅
- harness/loop.mjs --round 2: PASS

**부산물 — 단위화 작업이 잡은 추가 결함**
- `extractCitations()` async 전환으로 호출처 3곳 await 추가 (verify-citations, hallucination self-test 2곳)
- adapter schema 도입 시 기존 어댑터 모두 input/output 형식 명시 — 그동안 *암묵적*이었던 계약이 *명시적*

**남은 결합점**
- C-01, C-02 (1차 incident-0010 에서 해소됨)
- C-10 (문서 cross-reference) — verify-citations 가 사후 검출하므로 유지

**재발 방지**
- 06-coupling.md §3 에 7개 단위화 작업 모두 이력 기록
- 새 결합점 발견 시 C-XX 부여 후 카탈로그 추가
- self-test 가 자동 디스커버리 되어 새 회귀 케이스 추가 비용 0

### incident-0010 — 단위화 1차: self-test 자동 디스커버리 + walk.mjs 컨벤션 기반
- 발생 시점: 2026-05-08
- 단계: 인프라 단위화
- 사용자 영향: no
- 발견자: 사용자 명시 우려 — *"한 곳을 고치면 다른 게 깨질 것 같은 느낌"*

**무엇을 했나**
- `docs/design-log/06-coupling.md` 작성 — 9개 결합점(C-01~C-10) 영구 카탈로그
- A) self-test cases 자동 디스커버리: `harness/test/self-test.mjs` 의 groups 배열 제거. `harness/test/cases/*.mjs` 가 `runXCases` 함수를 export 하면 자동 등록. 디스커버리 로직은 `harness/test/lib/discover.mjs` 분리. 회귀: `harness/test/cases/discovery.mjs` 3 케이스.
- B) `rag/lib/walk.mjs` INCLUDE 정규식 → EXCLUDE 폴더 셋. 새 .md 폴더 자동 인덱싱. `fixtures/` 는 의도적 가짜 인용 포함이라 명시 제외.

**왜 이 두 개부터**
- 결합점 카탈로그에서 C-01, C-02 가 **수동 등록 패턴** — 가장 자주 잊는 곳
- C-02 는 본 시스템 구축 중 4번 발생 (harness, harness/references, harness/test, rag/hallucination 추가 시 매번)
- 둘 다 위험 낮음 (자동 디스커버리가 잘못 작동해도 self-test 자체가 잡음)

**검증**
- self-test: 51 → 54 통과 (discovery 회귀 3개 추가)
- harness/run.mjs --mock: 8/8 통과 (extraction-hallucination 5 + masking 2 + extraction 1)
- harness/verify.mjs: self-test ✅ + harness ✅ + verify-citations ✅
- RAG: 60 → 61 docs (06-coupling.md 자동 인덱싱 — 컨벤션 기반 동작 입증)

**남은 결합점 (사용자 결정)**
- 🟡 C-03: anti-pattern RULES 단일 진실 (1시간)
- 🟡 C-07: case JSON schema 명시 (1시간)
- 🟡 C-04: citation kind 단일 정의 (1.5시간)
- 🟢 C-05/C-09: masking 미러 점검 / verify stage 공통 모듈 (각 30분-1.5시간)
- ⚪ C-08/C-06: compare 분기 / adapter 시그니처 schema (각 2시간, 위험 높음)

**재발 방지**
- 06-coupling.md §3 에 단위화 이력 누적 — 새 결합점 발견 시 카탈로그 추가
- discovery.mjs 회귀 케이스 — 자동 디스커버리 자체가 깨지면 즉시 알림

### incident-0008 — extractor 의 .js / .json alternation 순서 버그
- 발생 시점: 2026-05-08 (verify-citations 자기 검증 시 노이즈 분석 중)
- 단계: rag/hallucination/lib/extractors.mjs (FILE_PATH_RE)
- 사용자 영향: no (자기 검증 단계에서 즉시 발견)
- 발견자: 본인 — incidents.md 본문의 `.json` 인용이 `.js` 로 추출되며 가짜 인용 알림이 잘못 떴음

**무엇이 일어났나**
- `FILE_EXT = '(?:ts|tsx|js|mjs|json|md|...)'` — alternation 의 `js` 가 `json` 보다 앞
- ECMAScript 정규식 alternation 은 leftmost-match → `agent-fake-citations-001.json` 이 `agent-fake-citations-001.js` 로 잘못 매치
- 검증 결과: 실재 파일이지만 `.js` 형태로 추출되어 file not found

**수정**
- alternation 길이 내림차순 정렬: `(?:tsx|ts|mts|mjs|json|cjs|js|md|sql|css|sh)`
- 정규식 끝에 `\b` 단어 경계 추가
- self-test 회귀 케이스 추가: `harness/test/cases/hallucination.mjs` 의 *json extension not truncated to js*

**재발 방지**
- self-test 가 .json 추출 형식 검증 — 룰 변경 시 즉시 깨짐
- 룰 주석에 incident-0008 명시

### incident-0009 — hallucination 인프라 확장 (verify.mjs 통합 + extraction 도메인 + search --min-score)
- 발생 시점: 2026-05-08
- 단계: 인프라 확장
- 사용자 영향: no
- 발견자: 사용자 명시 명령 ("순서대로 진행해" — A/B/C 후속 작업)

**무엇을 했나 — A/B/C 세 갈래**

A. verify-citations 자동 호출 통합
- `--dir`, `--files`, `--repo-defaults` 옵션 추가
- `harness/verify.mjs` 마지막 stage 로 `--repo-defaults` 자동 호출
- self-test 의 hallucination 그룹에 markdown-aware 추출 (백틱 무시) + .json 확장자 회귀 케이스 2건 추가
- 부산물: incidents.md 시드의 raw text 를 백틱으로 감싸 의도적 예시가 verify 노이즈로 안 잡히게
- 부산물: `.claude/agents/curator.md` frontmatter 의 `MEMORY.md` 표현을 `사용자 memory(~/.claude/.../memory)` 로 정정 (가계부 루트에 `MEMORY.md` 없음 → false hallucinated 알림)

B. extraction-hallucination 어댑터 + 회귀 케이스
- `harness/lib/adapters/extraction-hallucination.mjs` — 4가지 검증 (merchant_in_ocr / amount_in_ocr / category_consistent / pii_clean)
- `harness/cases/extraction-hallucination/eh-001~005.json` — clean / merchant fabricated / amount fabricated / category mismatch / PII leak
- `harness/lib/runner.mjs` 에 폴더 기반 dispatch 추가 — 복합 도메인 이름 (`extraction-hallucination`) 의 id-prefix split 오류 차단
- self-test 의 extraction-hallucination 그룹 16 케이스 추가

C. rag/search.mjs 옵션 추가
- `--min-score X` — score < X 결과 자동 제외
- `--warn-below X` — score < X 결과는 유지하되 [WARN] 태그
- self-test 의 rag search CLI 그룹 4 케이스 추가 (CLI를 child process 로 spawn)

**검증 결과**
- self-test: 51/51 통과 (29 → 47 → 51 단계적 증가)
- harness/run.mjs 도메인 기존 회귀 케이스 모두 통과 (extraction / masking / extraction-hallucination)
- harness/verify.mjs --repo-defaults 통합: 99 인용 모두 검증 통과

**재발 방지**
- self-test 가 도구 자체의 회귀를 즉시 노출 (incident-0008 도 self-test 가 잡음)
- 폴더 기반 dispatch — 새 복합 도메인 추가 시 id 모호함 없음

### incident-0007 — hallucination 검증 인프라 도입 (RAG 측)
- 발생 시점: 2026-05-08
- 단계: 인프라 신설
- 사용자 영향: no
- 발견자: 사용자 명시 명령

**무엇을 했나**
- `rag/hallucination/` 신설 — verify-citations.mjs CLI + extractors/checkers + patterns.json + cases/* + incidents.md
- 답변 텍스트에서 file / §section / incident / commit / pdf-page 인용 자동 추출 → 실재 검증
- self-test 그룹 `harness/test/cases/hallucination.mjs` 추가 (29 케이스 통과)

**왜 별도로 만들었나**
- runbook = 도구 게이트 실수 / hallucination incidents.md = 사용자에게 도달한/도달할 뻔한 가짜 인용 — 분리해야 책임/우선순위 명확
- hallucination 은 PDF 안티패턴 §2 "불확실한 fallback" 의 변종 — 모르는 것을 그럴듯하게 채워 넣음. 명시 가드 필요.

**self-test 케이스 추가 후 발견한 도구 결함**
- `extractors.mjs` 가 루트 .md (`AGENTS.md` / `CONTRACT.md`) 미검출 → false negative. ROOT_FILE_RE 추가로 수정.
- 케이스 파일의 `total` 가 실제 추출 개수와 안 맞아 self-test 실패 한 번 → 케이스 정정.

**재발 방지**
- 새 incident 발생 시 hi-NNNN 으로 `rag/hallucination/incidents.md` 에 기록
- 새 hallucination 패턴 등록 시 `patterns.json` + `cases/*.json` 동시 갱신
- verifier (메타 흐름 5단계) 의 작업 로그 / commit 메시지 / plan 결과 점검에 verify-citations 호출 추가 권고 (이번 PR 에서는 도구만 추가, 강제 호출은 후속)

### incident-0006 — anti-pattern-grep multi-line catch fallback 미검출 + 룰 narrow
- 발생 시점: 2026-05-08 (self-test anti-pattern fixture 검증 중)
- 단계: harness self-test → production grep 회귀
- 사용자 영향: 가계부 src 의 일부 패턴이 그동안 검출되지 않았을 가능성 (multi-line `catch (e) { return [] }`)
- 발견자: 본인

**무엇이 일어났나 — 두 가지 사건이 한 번에**

A) jsScan 이 라인별 검사라서 `catch (e) {` 와 `return [];` 가 다른 줄에 있는 패턴 미검출.
B) jsScan 을 multi-line 으로 강화하니 가계부 src/services 의 `from('transactions').insert` 3건이 새로 발견됨 — 다만 모두 정당한 사용 (사용자 직접 입력 / 반복지출 / 후보 승인 실제 insert 위치).

**왜 일어났나**
- A: jsScan 이 `for (lines) { re.test(line) }` 구조 — multi-line 패턴 본질적 검출 불가
- B: 룰의 excludePaths 가 `src/app/api/candidates` 만 잡았음. 실제 transactions insert 는 services layer 에서 일어나는 게 정당한데 누락. 전 코드(line-by-line)는 한 줄짜리 패턴만 잡아 우연히 false positive 가 안 났음 — 강화로 드러남.

**시도한 수정과 결과**
1. jsScan 을 multi-line 으로 변경: `RegExp(rule.pattern, 'gm')` + 전체 파일 텍스트 검사 + 라인 번호 계산 → multi-line catch fallback 잡힘
2. transactions insert 룰의 excludePaths 에 정당한 services 4개 추가 (candidateService / recurringService / transactionService / importService) → false positive 해소
3. self-test 26/26 + production grep 통과

**최종 해결**
- jsScan multi-line 매칭 (incident-0006 주석 명시)
- transactions insert 룰 narrow (의도 주석 명시 — *진짜 위협은 ai-extraction 영역에서의 직접 insert*)
- production grep 다시 clean

**재발 방지**
- self-test 의 silent-fallback fixture (multi-line) — 라인별 검사로 회귀 시 즉시 깨짐
- 룰의 inline 주석 — 새 ai-extraction 파일이 transactions insert 하면 excludePaths 외라 잡힘
- **알려진 한계 (정직 기록)**: ripgrep CLI 분기는 multiline 적용 안 됨 — `-U` 옵션 추가 후속 작업 후보. 현재는 jsScan 폴백에서만 multi-line. ripgrep 환경에서 production grep 실행 시 multi-line 패턴 누락 위험 존재 — runbook 알림.

## 3. 자만 / 가짜 통과 패턴 (자기 점검 체크리스트)

검증 실행 후 다음 패턴 보이면 **결과를 의심**:

- [ ] "통과했지만 환경이 부재해서 일부 stage skip" — 진짜 통과인가, optional 처리로 회피했나?
- [ ] "재시도하니 통과" — flaky 아닌가? 비결정성 원인 분석 안 한 채 넘기지 않았나?
- [ ] "큰 결함 없을 것 같다" — 실제로 검증했나, 추측했나?
- [ ] "이건 false positive 같다" — 룰 narrow 후 통과시켰나, 그냥 넘겼나?
- [ ] "수정 비용이 높아 지금은 못 함" — 대안 제시했나? 사용자 결정 받았나?

이 중 하나라도 yes 면 **본 runbook 에 incident 로 기록 + 사용자에게 보고**.

---

## 4. 수정 불가 판단의 운영 (CRITICAL)

검증 실패 후 수정 시도가 N회(권장 3회) 실패한 경우:

1. **자만 금지**: "조금만 더 하면 될 것 같다" 가 가장 위험한 신호
2. **냉정 분석**:
   - 실패가 *환경* 문제인가, *코드* 문제인가, *설계* 문제인가?
   - 같은 실패가 반복되면 **현재 접근이 잘못됐을 가능성** 우선 고려
3. **대안 제시 의무** ([`AGENT_BEHAVIOR.md §3`](../docs/AGENT_BEHAVIOR.md)):
   - 스코프 축소: 일부만 적용
   - 흐름 변경: plan-first 로 사용자 승인 후 다른 접근
   - 일시 보류: 다음 작업 단위로 분리
   - 사용자 결정 요청: 명시적 차단

대안 제시 없이 자동 재시도 무한 반복 → CONTRACT §9-A-3 위반 + loop-validator 한도 도달.

---

## 5. 통계 / 회고 (분기마다 갱신)

| 분기 | 누적 incident | 가장 흔한 단계 | 가장 흔한 원인 |
|---|---|---|---|
| 2026-Q2 | 13 + 1 followup | self-test / verify-citations 자기 검증 시 도구 결함 노출 + 단위화 3회 + 메타 격리 원칙 | 분기 순서 / 환경 의존 / multi-line / alternation / 수동 등록 누락 / 분산 정의 / 격리 원칙 / 단위화 자체의 새 결합 |

---

## 운영 메모

- incident 번호는 4자리 zero-pad — 0001, 0002, ...
- 새 항목은 **하단 추가**, 기존 항목 수정 금지 (영구 기록)
- 잘못 기록한 incident 는 새 항목 *"incident-NNNN-correction"* 으로 정정
- 분기별 통계는 §5 갱신만 — 본 항목 자체는 보존
