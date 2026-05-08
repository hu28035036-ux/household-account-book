# Design Log 03 — 하네스

세 층 구조: `harness/run.mjs` (도메인 회귀) + `harness/verify.mjs` (1차 게이트) + `harness/loop.mjs` (5회 안정성).
서로 책임이 다르고, 중첩되지 않는다.

---

## 1. 왜 vitest/Playwright 와 별도로 두는가

vitest 는 **단위 / 통합 테스트** — 함수 시그니처 회귀 잡음.
Playwright 는 **E2E** — UI 흐름 회귀 잡음.

하네스가 잡는 것은 **도메인 콘텐츠 회귀**:
- *"이 영수증이 이 후보로 변환되는가"*
- *"이 카드 명세가 이 마스킹 결과를 만드는가"*
- *"이 자연어 입력이 이 어시스턴트 의도로 분류되는가"*

vitest 로도 가능하지만:
- 케이스 추가 비용이 vitest 작성보다 낮아야 누적이 됨 (JSON 한 장)
- 어댑터 dispatch 로 도메인 추가 시 코어 코드 변경 0
- 라이브 LLM 호출과 mock 모드를 같은 파이프라인에서 운영

→ **하네스는 도메인 콘텐츠 누적 전용 프레임워크**.

---

## 2. 세 스크립트의 책임 분리

### harness/run.mjs — 도메인 회귀 진입점

**역할**: cases/<도메인>/*.json 을 어댑터 통해 실행, expected vs actual 비교.

**핵심 설계**:
- id prefix 가 곧 어댑터 이름 (`extraction-001` → `adapters/extraction.mjs`)
- runner 코어는 도메인 추가 시 변경 0
- mock 모드: LLM 호출 없이 파이프라인 자체 검증 가능

**왜 이 구조**:
- "새 도메인 추가에 어댑터 1개 + cases 폴더 1개" 가 PDF 4요소 *"Tools — 입출력 예측 가능"* 의 가장 깨끗한 구현
- 케이스 JSON 은 사람이 직접 손으로 추가하는 게 자연 — 어댑터/런너에 도메인 지식이 박히면 추가 비용 ↑

### harness/verify.mjs — 1차 빠른 게이트

**역할**: typecheck + vitest + harness/run + smoke + RLS audit 를 정해진 순서로 실행. 첫 실패에서 즉시 break.

**핵심 설계**:
- 저렴한 단계(typecheck) → 비싼 단계(smoke) 순서 — 빠른 차단
- `--full / --smoke / --rls / --no-vitest` 플래그로 부분 실행
- 첫 실패 메시지에 CONTRACT §9-A-3 인용 — 게이트가 왜 존재하는지 매번 상기

**왜 첫 실패에서 break**:
- 실패한 단계 이후의 결과는 추가 정보가 적음 (이미 모르는 상태로 진행한다는 의미)
- 노이즈 줄이고 원인 명확화

### harness/loop.mjs — 5회 연속 안정성 게이트

**역할**: 5회차 점진 누적 검증, 어느 회차든 실패 시 카운터 리셋.

**핵심 설계**:
- 각 회차가 다른 검증 모드 (회수 강제 + 의미 부여)
- 회차 별 디버그(`--round N`) 가능
- `--diagnose` 모드로 비결정성 힌트 제공

**왜 5회**:
- 사용자 명시 명령
- 한 번 통과 = 우연 가능. 5회 = 안정성 신호
- flaky 검출

**왜 점진 누적 (같은 검증 5회 아님)**:
- 같은 검증 5회는 비효율 + 5회의 의미가 단순 회수만 됨
- 점진 누적은 각 회차가 다른 면을 보고, 5회차 통과 = 모든 단계 안정

---

## 3. 어댑터 dispatch 메커니즘

### 패턴
```js
const domain = (case.id || '').split('-')[0];
const adapter = await import(`./adapters/${domain}.mjs`);
const actual = await adapter.run(case, opts);
```

### 왜
- **컨벤션 > 설정**: id 의 prefix 가 곧 dispatch 키 → 별도 라우팅 테이블 불필요
- 새 도메인 = 폴더 + 어댑터 파일 — 코어 변경 0
- 어댑터는 라이브/mock 모드 분기 책임만 가짐

### 비교기는 왜 분리했나
- 어댑터마다 비교 룰을 다시 짜면 비교 일관성 깨짐
- 비교기는 **expected 트리 + tolerances** 만 보면 됨 — 도메인 무지
- 도메인 특수 룰(`merchant_match`, `confidence_min`)은 비교기에 박았지만, 트리거는 키 이름

---

## 4. 케이스 형식의 의도

```json
{
  "id": "extraction-001",
  "tags": ["receipt", "cafe"],
  "input":     { "text": "...", "user_hints": {...} },
  "expected":  { "candidates": [...] },
  "tolerances":{ "amount_pct": 0, "merchant_match": "exact-or-alias" }
}
```

**왜 input/expected/tolerances 3분할**:
- input 만 다르고 expected 같은 케이스 → 회귀 그물 두텁게
- expected 만 다르고 input 같은 케이스 → 도메인 변경 시 영향 분석
- tolerances 분리 → 같은 입력에 도메인별 허용오차 다르게 (가맹점은 alias OK / 금액은 0%)

**왜 .skip 마킹은 파일명**:
- JSON 안 플래그면 실행 시점에야 무시 결정
- 파일명 이면 빌드/검색 단계에서 필터링 — 더 빠름

---

## 5. 어댑터 종류와 미러링 정책

### masking.mjs — 로컬 정규식 미러
**왜 직접 정규식**: 외부 호출 없이 빠른 회귀. 단점: `src/lib/security/masking.ts` 변경 시 수동 동기화 필요.
**관리 정책**: 파일 상단에 **미러 날짜** 명시. 본 코드 변경 시 같은 PR에 어댑터도 갱신.

### extraction.mjs — 라이브 / mock 분기
**왜 라이브 호출**: 실제 LLM 응답까지 회귀 잡으려면 dev 서버 + `/api/extraction/preview` 필요.
**왜 mock 모드**: CI / dev 환경 / 라이브 LLM 비용 절감 시 — 파서/매핑 로직만 검증.

### 향후 어댑터 후보
- `category` — 가맹점 → 카테고리 추정 회귀
- `assistant` — 자연어 → intent + slots 분류
- `import-mapping` — 카드/계좌 명세 헤더 → 컬럼 매핑

추가 시 cases 폴더 + 어댑터 파일만 → 코어 변경 0.

---

## 6. anti-pattern-grep — round 3 의 정적 점검

`harness/lib/anti-pattern-grep.mjs` — CONTRACT §9-A 패턴을 코드 레벨에서 grep.

**잡는 것**:
- 침묵 fallback (catch → return [] / null)
- service_role 외부 노출
- dangerouslySetInnerHTML 무단 사용
- 후보 우회 transactions insert

**왜 별도 스크립트**:
- ESLint 룰로 만들 수도 있지만, ESLint 설정 변경은 ux-design / qa-harness 영역 충돌
- Node 단독 실행 가능 → CI 외 환경에서도 운영 가능
- ripgrep 있으면 사용, 없으면 Node fallback (Windows 환경 호환)

**allowList 운영**:
- 정당한 사용 (예: theme init script 의 dangerouslySetInnerHTML) 은 명시 화이트리스트
- 화이트리스트 추가 시 사용자 승인 + 룰 narrow

---

## 7. 비-목표 / 의도적 한계

- **GUI dashboard 없음**: 콘솔 출력 + JSON 산출. 1인 빌더 시나리오에선 충분.
- **자동 케이스 생성 없음**: 사용자가 손으로 추가 — 도메인 사고를 사람이 본 만큼만 누적
- **실패 케이스 자동 fix 없음**: 결함은 영역 에이전트가 수정. 하네스는 검증만.
- **임베딩 기반 의미 비교 없음**: 현재는 정규식/문자열 비교. 임베딩 도입은 비용 vs 정확도 트레이드오프 평가 후.

---

## 회고용 메모

- 어댑터 dispatch 가 `.split('-')[0]` 으로 prefix 추출 — 도메인 이름에 하이픈이 있으면 깨짐 (현재 도메인은 단어 1개라 안전)
- mock 모드는 expected 를 그대로 echo — 실제 파서/마스킹 로직을 mock 안에서 돌리는 형태로 발전 가능
- round 3 의 anti-pattern grep 은 false positive 가 늘면 신뢰 하락 — allowList 늘리는 PR마다 사용자 검토 필수
