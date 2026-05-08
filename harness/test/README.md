# Harness self-test

하네스/RAG **도구 자체** 의 회귀를 잡는 안전망.

`harness/cases/*.json` 이 *도메인 콘텐츠* 회귀를 잡는다면, 이 폴더는 *도구 자체* 회귀를 잡는다.
[runbook incident-0002](../runbook.md#incident-0002) 에서 도구 자체 회귀 안전망 부재가 식별 → 이 폴더가 그 답.

운영 책임: `qa-harness` (운영) + `curator` (실패 시 incident 기록)

---

## 무엇을 잡나

| 케이스 그룹 | 잡는 회귀 |
|---|---|
| `compare.mjs` | 비교기 (단순 동등 / 톨러런스 / confidence_min / merchant_match / 배열 길이) |
| `runner.mjs` | runAll dispatch / 도메인별 결과 셰이프 |
| `masking.mjs` | masking adapter 정규식 순서 (incident-0001 직접 회귀 케이스) |
| `anti-pattern.mjs` | anti-pattern-grep 의 룰 매칭 / excludePaths / allowList / Windows 경로 정규화 (incident-0003) |
| `tokenize.mjs` | 한국어 + 영문 토크나이저 / stopword / 단일자 드롭 |

---

## 실행

```bash
node harness/test/self-test.mjs
```

종료 코드:
- `0` — 모든 케이스 통과
- `1` — 어느 케이스든 실패

verify 게이트와 loop-validator 가 이걸 호출해서 도구 자체 회귀가 흐름 안에서 즉시 잡히게 한다.

---

## 새 케이스 추가 가이드

1. **runbook 에서 incident 발생** 했고
2. 같은 회귀가 코드 변경 시 즉시 잡혀야 하면,
3. 해당 도구 케이스 그룹에 함수를 1개 추가하고 `runXCases()` 의 배열에 push.

각 케이스는 `{ ok: boolean, name: string, message?: string }` 반환.

새 도구를 만들었다면:
- `cases/<도구>.mjs` 추가
- `self-test.mjs` 의 `groups` 배열에 1줄 추가

---

## 의도적 한계

- **fixture 는 .fixture 확장자**: TypeScript / ESLint / vitest 가 잡지 않도록. 실제 src/ 빌드/테스트와 분리.
- **runner 의 cases 트리는 진짜 cases/ 사용**: tmp 디렉토리에 dispatch 만 시험하려면 runner.mjs 가 root override 를 받아야 함 → 현재는 사용하지 않고 빈-매칭/도메인-매칭 두 케이스로 dispatch 안전성만 확인.
- **LLM 호출 없음**: 모든 케이스가 결정적 — flaky 차단.

---

## 실패 시 행동 (AGENT_BEHAVIOR §3)

self-test 실패 = 하네스 도구 자체가 깨짐. 이건 가계부 src/ 결함보다 위험 — 다른 검증을 모두 못 믿게 됨.

1. 자만 금지. "재실행하면 통과할 것 같다" 표현 사용 금지.
2. 즉시 [runbook](../runbook.md) 에 incident 추가.
3. 수정 시도 ≤ 3회 후에도 실패면 대안 제시 (스코프 축소 / 사용자 결정 요청).

---

## 폴더 구조

```
harness/test/
├── README.md
├── self-test.mjs           ← 진입점
├── cases/
│   ├── compare.mjs
│   ├── runner.mjs
│   ├── masking.mjs
│   ├── anti-pattern.mjs
│   └── tokenize.mjs
└── fixtures/
    └── anti-pattern/
        └── src/
            ├── silent-fallback.fixture
            ├── clean.fixture
            ├── admin-allowed/admin.fixture
            └── components/layout-allowlist.fixture
```
